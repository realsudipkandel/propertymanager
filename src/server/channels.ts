import { capabilitiesForProvider, CAPABILITY_LABEL, type ChannelCapabilities } from "@/domain/channels/capabilities";
import { channelShare } from "@/domain/channels/channel-kpis";
import { channelPricePence } from "@/domain/channels/reservation";
import { CHANNEL_PROVIDER_LABEL, isChannelProviderCode, type ChannelProviderCode } from "@/domain/channels/registry";
import { addDays, dateToIso, todayIso } from "@/domain/dates";
import { calculatePropertyKpis } from "@/domain/kpis";
import { prisma } from "@/server/db";
import { organizationScope, type Session } from "@/server/session";

function scope(session: Session) {
  return organizationScope(session);
}

export async function listChannelAccounts(session: Session) {
  const accounts = await prisma.channelAccount.findMany({
    where: scope(session),
    include: { mappings: true },
    orderBy: { createdAt: "asc" },
  });
  return accounts.map((account) => {
    const capabilities = account.capabilities as ChannelCapabilities;
    return {
      id: account.id,
      provider: account.provider,
      providerLabel: CHANNEL_PROVIDER_LABEL[account.provider as ChannelProviderCode] ?? account.provider,
      displayName: account.displayName,
      status: account.status,
      listingCount: account.mappings.length,
      lastSyncAt: account.lastSyncAt ? dateToIso(account.lastSyncAt) : null,
      capabilities: Object.entries(capabilities)
        .filter(([, enabled]) => enabled)
        .map(([key]) => CAPABILITY_LABEL[key as keyof ChannelCapabilities]),
    };
  });
}

export async function connectableProviders() {
  const providers: ChannelProviderCode[] = ["MOCK_AIRBNB", "MOCK_BOOKING_COM", "MOCK_VRBO", "DIRECT"];
  return providers.map((provider) => ({
    provider,
    label: CHANNEL_PROVIDER_LABEL[provider],
    capabilities: Object.entries(capabilitiesForProvider(provider))
      .filter(([, enabled]) => enabled)
      .map(([key]) => CAPABILITY_LABEL[key as keyof ChannelCapabilities]),
  }));
}

export async function listListingMappings(session: Session) {
  const mappings = await prisma.listingMapping.findMany({
    where: scope(session),
    include: { property: true, channelAccount: true },
    orderBy: { createdAt: "asc" },
  });
  return mappings.map((mapping) => ({
    id: mapping.id,
    property: mapping.property.name,
    propertyId: mapping.propertyId,
    provider: CHANNEL_PROVIDER_LABEL[mapping.channelAccount.provider as ChannelProviderCode] ?? mapping.channelAccount.provider,
    channelAccountId: mapping.channelAccountId,
    externalListingId: mapping.externalListingId,
    syncMode: mapping.syncMode,
    markupBps: mapping.markupBps,
    isActive: mapping.isActive,
  }));
}

export async function mappingFormOptions(session: Session) {
  const [properties, accounts] = await Promise.all([
    prisma.property.findMany({ where: scope(session), orderBy: { name: "asc" } }),
    prisma.channelAccount.findMany({ where: scope(session), orderBy: { createdAt: "asc" } }),
  ]);
  return {
    properties: properties.map((property) => ({ id: property.id, name: property.name })),
    accounts: accounts.map((account) => ({
      id: account.id,
      name: `${CHANNEL_PROVIDER_LABEL[account.provider as ChannelProviderCode] ?? account.provider} · ${account.displayName}`,
    })),
  };
}

export async function listReservations(session: Session) {
  const rows = await prisma.reservation.findMany({
    where: scope(session),
    include: { property: true, channelAccount: true },
    orderBy: { checkInDate: "desc" },
    take: 200,
  });
  return rows.map((reservation) => ({
    id: reservation.id,
    property: reservation.property.name,
    provider: CHANNEL_PROVIDER_LABEL[reservation.provider as ChannelProviderCode] ?? reservation.provider,
    channel: reservation.channelAccount.displayName,
    externalReservationId: reservation.externalReservationId,
    guestName: reservation.guestName,
    status: reservation.status,
    checkIn: dateToIso(reservation.checkInDate),
    checkOut: dateToIso(reservation.checkOutDate),
    nights: reservation.nights,
    grossPence: reservation.grossPence,
    commissionPence: reservation.commissionPence,
  }));
}

export async function getReservation(session: Session, id: string) {
  const reservation = await prisma.reservation.findFirst({
    where: { id, ...scope(session) },
    include: { property: true, channelAccount: true },
  });
  if (!reservation) {
    return null;
  }
  return {
    id: reservation.id,
    property: reservation.property.name,
    propertyId: reservation.propertyId,
    provider: CHANNEL_PROVIDER_LABEL[reservation.provider as ChannelProviderCode] ?? reservation.provider,
    channel: reservation.channelAccount.displayName,
    externalReservationId: reservation.externalReservationId,
    guestName: reservation.guestName,
    guestEmail: reservation.guestEmail,
    status: reservation.status,
    checkIn: dateToIso(reservation.checkInDate),
    checkOut: dateToIso(reservation.checkOutDate),
    nights: reservation.nights,
    guests: reservation.guests,
    accommodationPence: reservation.accommodationPence,
    cleaningPence: reservation.cleaningPence,
    otherPence: reservation.otherPence,
    grossPence: reservation.grossPence,
    commissionPence: reservation.commissionPence,
    netPence: reservation.grossPence - reservation.commissionPence,
    canCancel: reservation.status !== "CANCELLED" && reservation.status !== "CHECKED_OUT",
  };
}

export async function channelOverview(session: Session) {
  const today = todayIso();
  const horizonStart = addDays(today, -30);
  const scopeWhere = scope(session);
  const [reservations, properties] = await Promise.all([
    prisma.reservation.findMany({
      where: { ...scopeWhere, status: { not: "CANCELLED" }, checkInDate: { gte: new Date(`${horizonStart}T00:00:00.000Z`) } },
      include: { channelAccount: true },
    }),
    prisma.property.count({ where: scopeWhere }),
  ]);
  const shareRows = channelShare(
    reservations.map((reservation) => ({
      provider: CHANNEL_PROVIDER_LABEL[reservation.provider as ChannelProviderCode] ?? reservation.provider,
      label: reservation.channelAccount.displayName,
      nights: reservation.nights,
      grossPence: reservation.grossPence,
      commissionPence: reservation.commissionPence,
    })),
  );
  const occupiedNights = reservations.reduce((sum, reservation) => sum + reservation.nights, 0);
  const grossRevenuePence = reservations.reduce((sum, reservation) => sum + reservation.grossPence, 0);
  const accommodationPence = reservations.reduce((sum, reservation) => sum + reservation.accommodationPence, 0);
  const commissionPence = reservations.reduce((sum, reservation) => sum + reservation.commissionPence, 0);
  const availableNights = properties * 30;
  const kpis = calculatePropertyKpis({
    availableNights,
    occupiedNights: Math.min(occupiedNights, availableNights),
    accommodationRevenuePence: accommodationPence,
    grossRevenuePence,
    bookingCount: reservations.length,
    cleaningCostPence: 0,
    otaFeesPence: commissionPence,
    operatingProfitPence: grossRevenuePence - commissionPence,
  });
  const [connectedAccounts, totalAccounts, mappedListings] = await Promise.all([
    prisma.channelAccount.count({ where: { ...scopeWhere, status: "ACTIVE" } }),
    prisma.channelAccount.count({ where: scopeWhere }),
    prisma.listingMapping.count({ where: { ...scopeWhere, isActive: true } }),
  ]);
  return {
    windowLabel: "Trailing 30 days",
    bookingCount: reservations.length,
    occupiedNights,
    grossRevenuePence,
    commissionPence,
    netRevenuePence: grossRevenuePence - commissionPence,
    kpis,
    channelShare: shareRows,
    connectivity: { connectedAccounts, totalAccounts, mappedListings },
  };
}

export async function multiCalendar(session: Session) {
  const today = todayIso();
  const endExclusive = addDays(today, 21);
  const scopeWhere = scope(session);
  const [properties, reservations] = await Promise.all([
    prisma.property.findMany({ where: scopeWhere, orderBy: { name: "asc" } }),
    prisma.reservation.findMany({
      where: {
        ...scopeWhere,
        status: { not: "CANCELLED" },
        checkInDate: { lt: new Date(`${endExclusive}T00:00:00.000Z`) },
        checkOutDate: { gt: new Date(`${today}T00:00:00.000Z`) },
      },
      include: { channelAccount: true },
    }),
  ]);
  const dates: string[] = [];
  let cursor = today;
  while (cursor < endExclusive) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return {
    dates,
    rows: properties.map((property) => {
      const propertyReservations = reservations.filter((reservation) => reservation.propertyId === property.id);
      const cells = dates.map((date) => {
        const match = propertyReservations.find(
          (reservation) => dateToIso(reservation.checkInDate) <= date && date < dateToIso(reservation.checkOutDate),
        );
        if (!match) {
          return { date, occupied: false, label: null as string | null, provider: null as string | null };
        }
        return {
          date,
          occupied: true,
          label: match.guestName,
          provider: CHANNEL_PROVIDER_LABEL[match.provider as ChannelProviderCode] ?? match.provider,
        };
      });
      return { propertyId: property.id, property: property.name, cells };
    }),
  };
}

export async function dailyRates(session: Session, propertyId: string) {
  const today = todayIso();
  const endExclusive = addDays(today, 21);
  const property = await prisma.property.findFirst({ where: { id: propertyId, ...scope(session) } });
  if (!property) {
    return null;
  }
  const [rates, mappings] = await Promise.all([
    prisma.dailyRate.findMany({
      where: { ...scope(session), propertyId, date: { gte: new Date(`${today}T00:00:00.000Z`), lt: new Date(`${endExclusive}T00:00:00.000Z`) } },
      orderBy: { date: "asc" },
    }),
    prisma.listingMapping.findMany({ where: { ...scope(session), propertyId, isActive: true }, include: { channelAccount: true } }),
  ]);
  const byDate = new Map(rates.map((rate) => [dateToIso(rate.date), rate]));
  const dates: string[] = [];
  let cursor = today;
  while (cursor < endExclusive) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return {
    propertyId,
    property: property.name,
    channels: mappings.map((mapping) => ({
      mappingId: mapping.id,
      provider: CHANNEL_PROVIDER_LABEL[mapping.channelAccount.provider as ChannelProviderCode] ?? mapping.channelAccount.provider,
      markupBps: mapping.markupBps,
    })),
    days: dates.map((date) => {
      const rate = byDate.get(date);
      const basePricePence = rate?.basePricePence ?? null;
      return {
        date,
        basePricePence,
        minStay: rate?.minStay ?? 1,
        stopSell: rate?.stopSell ?? false,
        channelPrices: basePricePence === null
          ? []
          : mappings.map((mapping) => ({
              provider: CHANNEL_PROVIDER_LABEL[mapping.channelAccount.provider as ChannelProviderCode] ?? mapping.channelAccount.provider,
              pricePence: channelPricePence(basePricePence, mapping.markupBps),
            })),
      };
    }),
  };
}

export function assertKnownProvider(value: string): ChannelProviderCode {
  if (!isChannelProviderCode(value)) {
    throw new Error(`Unknown channel provider: ${value}`);
  }
  return value;
}
