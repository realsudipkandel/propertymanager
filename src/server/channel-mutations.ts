"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { capabilitiesForProvider } from "@/domain/channels/capabilities";
import { nightsOccupied, reservationFinancials, assertReservationTransition } from "@/domain/channels/reservation";
import { adapterForProvider, CHANNEL_PROVIDER_LABEL, type ChannelProviderCode } from "@/domain/channels/registry";
import { addDays, assertIsoDate, daysBetween } from "@/domain/dates";
import { completedForm, invalidForm, type FormState } from "@/domain/form-state";
import { MESSAGE } from "@/domain/constants";
import { DomainError, parsePoundsToPence } from "@/domain/money";
import { canMutateFinance } from "@/domain/permissions";
import { organizationPath } from "@/domain/organization";
import { appendAuditLog } from "@/server/audit";
import { assertKnownProvider } from "@/server/channels";
import { prisma } from "@/server/db";
import { logServerError } from "@/server/reference";
import { organizationScope, requireSession } from "@/server/session";

async function guard(work: () => Promise<FormState>, scope: string): Promise<FormState> {
  try {
    return await work();
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error) {
      const digest = String((error as { digest: unknown }).digest);
      if (digest.startsWith("NEXT_REDIRECT")) {
        throw error;
      }
    }
    if (error instanceof DomainError) {
      return invalidForm(error.message);
    }
    logServerError(scope, error);
    return invalidForm("Something went wrong. Nothing was saved.");
  }
}

export async function connectChannelAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return guard(async () => {
    const session = await requireSession();
    if (!canMutateFinance(session.role)) {
      return invalidForm(MESSAGE.UNAUTHORISED);
    }
    const providerRaw = String(formData.get("provider") ?? "");
    const displayName = String(formData.get("displayName") ?? "").trim();
    if (displayName.length < 2) {
      return invalidForm(MESSAGE.VALIDATION, { displayName: "Name this connection, e.g. the account email or company name." });
    }
    const provider = assertKnownProvider(providerRaw);
    const account = await prisma.channelAccount.create({
      data: {
        ...organizationScope(session),
        provider,
        displayName,
        // Real adapters would sit in AUTHORIZING/PENDING_PROVIDER until OAuth
        // completes (PRD §94). The mock adapters have nothing to authorise,
        // so the connection goes straight to ACTIVE.
        status: "ACTIVE",
        capabilities: capabilitiesForProvider(provider) as unknown as Prisma.InputJsonValue,
        lastSyncAt: new Date(),
      },
    });
    await appendAuditLog(prisma, session, {
      action: "CHANNEL_CONNECTED",
      entityType: "channel_account",
      entityId: account.id,
      summary: `Connected ${CHANNEL_PROVIDER_LABEL[provider as ChannelProviderCode]} (${displayName}).`,
    });
    redirect(organizationPath(session.organizationSlug, "/channels/connections"));
  }, "connect-channel");
}

export async function disconnectChannelAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return guard(async () => {
    const session = await requireSession();
    if (!canMutateFinance(session.role)) {
      return invalidForm(MESSAGE.UNAUTHORISED);
    }
    const channelAccountId = String(formData.get("channelAccountId") ?? "");
    const updated = await prisma.channelAccount.updateMany({
      where: { id: channelAccountId, ...organizationScope(session) },
      data: { status: "DISCONNECTED" },
    });
    if (updated.count !== 1) {
      return invalidForm(MESSAGE.NOT_FOUND);
    }
    await appendAuditLog(prisma, session, {
      action: "CHANNEL_DISCONNECTED",
      entityType: "channel_account",
      entityId: channelAccountId,
      summary: "Channel connection disconnected.",
    });
    redirect(organizationPath(session.organizationSlug, "/channels/connections"));
  }, "disconnect-channel");
}

export async function createListingMappingAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return guard(async () => {
    const session = await requireSession();
    if (!canMutateFinance(session.role)) {
      return invalidForm(MESSAGE.UNAUTHORISED);
    }
    const propertyId = String(formData.get("propertyId") ?? "");
    const channelAccountId = String(formData.get("channelAccountId") ?? "");
    const externalListingId = String(formData.get("externalListingId") ?? "").trim();
    const markupPercent = Number(formData.get("markupPercent") ?? "0");
    const syncMode = String(formData.get("syncMode") ?? "ARI_ONLY");
    if (externalListingId.length < 1) {
      return invalidForm(MESSAGE.VALIDATION, { externalListingId: "Enter the external listing id." });
    }
    if (!Number.isFinite(markupPercent) || markupPercent < -100 || markupPercent > 200) {
      return invalidForm(MESSAGE.VALIDATION, { markupPercent: "Markup must be between -100% and 200%." });
    }
    const scope = organizationScope(session);
    const [property, account] = await Promise.all([
      prisma.property.findFirst({ where: { id: propertyId, ...scope } }),
      prisma.channelAccount.findFirst({ where: { id: channelAccountId, ...scope } }),
    ]);
    if (!property || !account) {
      return invalidForm(MESSAGE.NOT_FOUND);
    }
    const mapping = await prisma.listingMapping.create({
      data: {
        ...scope,
        propertyId,
        channelAccountId,
        externalListingId,
        markupBps: Math.round(markupPercent * 100),
        syncMode: syncMode === "FULL_SYNC" || syncMode === "RESERVATIONS_ONLY" ? syncMode : "ARI_ONLY",
      },
    });
    await appendAuditLog(prisma, session, {
      action: "LISTING_MAPPED",
      entityType: "listing_mapping",
      entityId: mapping.id,
      summary: `Mapped ${property.name} to ${account.displayName} listing ${externalListingId}.`,
    });
    redirect(organizationPath(session.organizationSlug, "/channels/mapping"));
  }, "create-listing-mapping");
}

/**
 * Pulls reservations from a mapped channel and commits them with the
 * idempotency + double-booking guard described in the PRD (§20, §36,
 * §128): every provider event is deduplicated on (provider,
 * externalEventId) before it is processed, and every confirmed reservation
 * reserves its nights inside one transaction by inserting one
 * ReservationNightLock row per night. If another reservation already holds
 * any of those nights, the unique index collides, the whole transaction
 * rolls back, and the conflict is reported — never silently dropped or
 * silently overwritten.
 */
export async function importReservationsAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return guard(async () => {
    const session = await requireSession();
    if (!canMutateFinance(session.role)) {
      return invalidForm(MESSAGE.UNAUTHORISED);
    }
    const mappingId = String(formData.get("mappingId") ?? "");
    const scope = organizationScope(session);
    const mapping = await prisma.listingMapping.findFirst({
      where: { id: mappingId, ...scope },
      include: { channelAccount: true, property: true },
    });
    if (!mapping) {
      return invalidForm(MESSAGE.NOT_FOUND);
    }
    const provider = assertKnownProvider(mapping.channelAccount.provider);
    const adapter = adapterForProvider(provider);
    const inbound = await adapter.pullReservations(mapping.externalListingId);

    let imported = 0;
    let duplicates = 0;
    let conflicts = 0;

    for (const candidate of inbound) {
      const existingEvent = await prisma.syncEvent.findUnique({
        where: { organizationId_provider_externalEventId: { organizationId: session.organizationId, provider, externalEventId: candidate.externalEventId } },
      });
      if (existingEvent) {
        duplicates += 1;
        continue;
      }
      const financials = reservationFinancials({
        accommodationPence: candidate.accommodationPence,
        cleaningPence: candidate.cleaningPence,
        otherPence: candidate.otherPence,
        commissionPence: candidate.commissionPence,
      });
      // Recorded outside the reservation transaction below: a rolled-back
      // transaction would otherwise take this raw-event record down with
      // it, silently erasing the audit trail for exactly the double-booking
      // conflicts it most needs to capture.
      const syncEvent = await prisma.syncEvent.create({
        data: {
          tenantId: session.tenantId,
          organizationId: session.organizationId,
          channelAccountId: mapping.channelAccountId,
          provider,
          externalEventId: candidate.externalEventId,
          eventType: "RESERVATION_CREATED",
          payload: candidate as unknown as Prisma.InputJsonValue,
        },
      });
      try {
        await prisma.$transaction(async (tx) => {
          const reservation = await tx.reservation.create({
            data: {
              ...scope,
              propertyId: mapping.propertyId,
              channelAccountId: mapping.channelAccountId,
              provider,
              externalReservationId: candidate.externalReservationId,
              status: "CONFIRMED",
              guestName: candidate.guestName,
              guestEmail: candidate.guestEmail,
              checkInDate: new Date(`${candidate.checkIn}T00:00:00.000Z`),
              checkOutDate: new Date(`${candidate.checkOut}T00:00:00.000Z`),
              nights: nightsOccupied(candidate.checkIn, candidate.checkOut).length,
              guests: candidate.guests,
              accommodationPence: candidate.accommodationPence,
              cleaningPence: candidate.cleaningPence,
              otherPence: candidate.otherPence,
              grossPence: financials.grossPence,
              commissionPence: candidate.commissionPence,
              currency: candidate.currency,
            },
          });
          // The atomic inventory lock: one row per occupied night, guarded by
          // a unique (propertyId, date) index. A colliding insert throws
          // P2002 and aborts the whole transaction below.
          await tx.reservationNightLock.createMany({
            data: nightsOccupied(candidate.checkIn, candidate.checkOut).map((date) => ({
              organizationId: session.organizationId,
              propertyId: mapping.propertyId,
              date: new Date(`${date}T00:00:00.000Z`),
              reservationId: reservation.id,
            })),
          });
        });
        await prisma.syncEvent.update({ where: { id: syncEvent.id }, data: { processedAt: new Date() } });
        imported += 1;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          conflicts += 1;
          await prisma.syncEvent.update({ where: { id: syncEvent.id }, data: { conflict: true } });
          continue;
        }
        throw error;
      }
    }

    await prisma.channelAccount.update({ where: { id: mapping.channelAccountId }, data: { lastSyncAt: new Date() } });
    await appendAuditLog(prisma, session, {
      action: "RESERVATIONS_IMPORTED",
      entityType: "listing_mapping",
      entityId: mapping.id,
      summary: `Pulled ${inbound.length} reservations from ${mapping.channelAccount.displayName}: ${imported} imported, ${duplicates} already known, ${conflicts} double-booking conflicts.`,
    });
    revalidatePath(organizationPath(session.organizationSlug, "/channels"));
    revalidatePath(organizationPath(session.organizationSlug, "/channels/reservations"));
    revalidatePath(organizationPath(session.organizationSlug, "/channels/calendar"));
    if (conflicts > 0) {
      return invalidForm(
        `${imported} reservation(s) imported, ${duplicates} already known. ${conflicts} conflicted with existing nights and were NOT imported — resolve manually.`,
      );
    }
    return completedForm(`${imported} reservation(s) imported, ${duplicates} already known.`);
  }, "import-reservations");
}

export async function cancelReservationAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return guard(async () => {
    const session = await requireSession();
    if (!canMutateFinance(session.role)) {
      return invalidForm(MESSAGE.UNAUTHORISED);
    }
    const reservationId = String(formData.get("reservationId") ?? "");
    const scope = organizationScope(session);
    const reservation = await prisma.reservation.findFirst({ where: { id: reservationId, ...scope } });
    if (!reservation) {
      return invalidForm(MESSAGE.NOT_FOUND);
    }
    assertReservationTransition(reservation.status, "CANCELLED");
    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({ where: { id: reservation.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      // Freeing the night locks is what actually re-opens the inventory for
      // other channels to sell.
      await tx.reservationNightLock.deleteMany({ where: { reservationId: reservation.id } });
    });
    await appendAuditLog(prisma, session, {
      action: "RESERVATION_CANCELLED",
      entityType: "reservation",
      entityId: reservation.id,
      summary: `Cancelled reservation ${reservation.externalReservationId} and released its nights.`,
    });
    revalidatePath(organizationPath(session.organizationSlug, "/channels"));
    revalidatePath(organizationPath(session.organizationSlug, "/channels/calendar"));
    redirect(organizationPath(session.organizationSlug, `/channels/reservations/${reservation.id}`));
  }, "cancel-reservation");
}

export async function updateDailyRatesAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return guard(async () => {
    const session = await requireSession();
    if (!canMutateFinance(session.role)) {
      return invalidForm(MESSAGE.UNAUTHORISED);
    }
    const propertyId = String(formData.get("propertyId") ?? "");
    const fromIso = assertIsoDate(String(formData.get("from") ?? ""));
    const toIso = assertIsoDate(String(formData.get("to") ?? ""));
    const basePrice = parsePoundsToPence(String(formData.get("basePrice") ?? ""));
    const minStay = Number(formData.get("minStay") ?? "1");
    if (basePrice === null || basePrice <= 0) {
      return invalidForm(MESSAGE.VALIDATION, { basePrice: "Enter the base nightly rate in pounds." });
    }
    if (!Number.isInteger(minStay) || minStay < 1 || minStay > 30) {
      return invalidForm(MESSAGE.VALIDATION, { minStay: "Minimum stay must be 1 to 30 nights." });
    }
    if (toIso < fromIso) {
      return invalidForm(MESSAGE.VALIDATION, { to: "End date cannot be before the start date." });
    }
    if (daysBetween(fromIso, toIso) > 365) {
      return invalidForm(MESSAGE.VALIDATION, { to: "Update at most 365 days at a time." });
    }
    const scope = organizationScope(session);
    const property = await prisma.property.findFirst({ where: { id: propertyId, ...scope } });
    if (!property) {
      return invalidForm(MESSAGE.NOT_FOUND);
    }
    const dates: string[] = [];
    let cursor = fromIso;
    while (cursor <= toIso) {
      dates.push(cursor);
      cursor = addDays(cursor, 1);
    }
    await prisma.$transaction(
      dates.map((date) =>
        prisma.dailyRate.upsert({
          where: { propertyId_date: { propertyId, date: new Date(`${date}T00:00:00.000Z`) } },
          create: { ...scope, propertyId, date: new Date(`${date}T00:00:00.000Z`), basePricePence: basePrice, minStay },
          update: { basePricePence: basePrice, minStay },
        }),
      ),
    );
    await appendAuditLog(prisma, session, {
      action: "RATES_UPDATED",
      entityType: "property",
      entityId: propertyId,
      summary: `Updated the base rate for ${property.name} across ${dates.length} date(s).`,
    });
    revalidatePath(organizationPath(session.organizationSlug, "/channels/rates"));
    redirect(organizationPath(session.organizationSlug, `/channels/rates?propertyId=${propertyId}`));
  }, "update-daily-rates");
}
