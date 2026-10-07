"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  accommodationIncomeCode,
  catalogByCode,
  platformFeeCode,
} from "@/domain/catalog";
import {
  ALLOWED_UPLOAD_EXTENSIONS,
  BOOKING_PLATFORM,
  DEFAULT_DOCUMENT_RETENTION_YEARS,
  DOCUMENT_KIND,
  EXPENSE_NATURE,
  INCOME_CODE,
  MAX_UPLOAD_BYTES,
  MESSAGE,
  MIN_PASSWORD_LENGTH,
  PAYMENT_METHOD,
  USER_ROLE,
  type BookingPlatform,
  type PaymentMethod,
} from "@/domain/constants";
import { assertExternalBookingReference, assertStay, calculateBookingFinancials } from "@/domain/accounting";
import { assertIsoDate, dateToIso } from "@/domain/dates";
import { contentTypeForStorageKey, extensionAllowed, resolveStoragePath } from "@/domain/files";
import { completedForm, invalidForm, inviteReady, type FormState } from "@/domain/form-state";
import { inviteExpiresAt, inviteIsOpen, isUserRole, memberCreateErrors, membershipChangeBlock, normaliseEmail } from "@/domain/membership";
import { homeForRole } from "@/domain/navigation";
import { organizationPath } from "@/domain/organization";
import { localityFromPostcodePayload, normaliseUkPostcode, postcodeLookupStatus, propertyCreateErrors } from "@/domain/property";
import { applyPayment, invoiceCollectionStatus, outstandingBalance } from "@/domain/invoices";
import { DomainError, parsePoundsToPence } from "@/domain/money";
import { canConfigureBank, canMutateFinance, canPostExpense, canManageSettings } from "@/domain/permissions";
import { isExactAllocation } from "@/domain/reconciliation";
import { parseBankCsv } from "@/domain/csv";
import { appendAuditLog } from "@/server/audit";
import { readUkPostcode } from "@/server/uk-address";
import { prisma } from "@/server/db";
import { hashInviteToken, newInviteToken } from "@/server/invite-token";
import { fromPence, toPence } from "@/server/money";
import { logServerError, nextReference } from "@/server/reference";
import { createOrganizationWithOwner } from "@/server/provision-organization";
import { appOrigin } from "@/server/app-origin";
import { clearLoginFailures, loginAttemptBlocked, recordLoginFailure } from "@/server/login-throttle";
import { clearSessionCookie, createSessionToken, getAuthenticatedUser, landingPathForUser, organizationScope, requireSession, userCanCreateOrganization, writeSessionCookie } from "@/server/session";

const LOGIN_TIMING_HASH = bcrypt.hashSync("login-timing-placeholder", 12);

function rethrowRedirect(error: unknown): void {
  if (typeof error === "object" && error !== null && "digest" in error) {
    const digest = String((error as { digest: unknown }).digest);
    if (digest.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
  }
}

async function guard(work: () => Promise<FormState>, scope: string): Promise<FormState> {
  try {
    return await work();
  } catch (error) {
    rethrowRedirect(error);
    if (error instanceof DomainError) {
      return invalidForm(error.message);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return invalidForm("That reference is already in use.");
    }
    logServerError(scope, error);
    return invalidForm("Something went wrong. Nothing was saved.");
  }
}

function isPlatform(value: string): value is BookingPlatform {
  return Object.values(BOOKING_PLATFORM).includes(value as BookingPlatform);
}

function isPaymentMethod(value: string): value is PaymentMethod {
  return Object.values(PAYMENT_METHOD).includes(value as PaymentMethod);
}

function moneyField(formData: FormData, name: string, label: string): number | FormState {
  const parsed = parsePoundsToPence(String(formData.get(name) ?? ""));
  if (parsed === null) {
    return invalidForm(MESSAGE.VALIDATION, { [name]: `Enter ${label} in pounds, up to 2 decimal places.` });
  }
  return parsed;
}

function clientAddress(headerStore: Headers): string {
  const forwarded = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const address = forwarded || headerStore.get("x-real-ip") || "unknown";
  return address.slice(0, 64);
}

export async function loginAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const email = normaliseEmail(String(formData.get("email") ?? "")) ?? "";
  const password = String(formData.get("password") ?? "");
  const address = clientAddress(await headers());
  const now = Date.now();
  if (loginAttemptBlocked(email, address, now)) {
    return invalidForm(MESSAGE.LOGIN_LIMITED);
  }
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const matches = await bcrypt.compare(password, user?.passwordHash ?? LOGIN_TIMING_HASH);
  if (!user || !matches || !user.isActive) {
    recordLoginFailure(email, address, now);
    return invalidForm(MESSAGE.INVALID_CREDENTIALS);
  }
  clearLoginFailures(email, address);
  const memberships = await prisma.organizationMembership.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    include: { organization: true },
    orderBy: { organization: { tradingName: "asc" } },
  });
  const first = memberships[0];
  const activeOrganizationId = memberships.length === 1 && first ? first.organizationId : null;
  const token = await createSessionToken({ userId: user.id, organizationId: activeOrganizationId });
  await writeSessionCookie(token);
  redirect(await landingPathForUser(user.id));
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

export async function createBookingAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return guard(async () => {
    const session = await requireSession();
    if (!canMutateFinance(session.role)) {
      return invalidForm(MESSAGE.UNAUTHORISED);
    }
    const propertyId = String(formData.get("propertyId") ?? "");
    const customerId = String(formData.get("customerId") ?? "");
    const platformValue = String(formData.get("platform") ?? "");
    if (!isPlatform(platformValue)) {
      return invalidForm(MESSAGE.VALIDATION, { platform: "Choose a booking channel." });
    }
    const externalBookingId = assertExternalBookingReference(String(formData.get("externalBookingId") ?? ""));
    const checkIn = assertIsoDate(String(formData.get("checkIn") ?? ""));
    const checkOut = assertIsoDate(String(formData.get("checkOut") ?? ""));
    const guests = Number(formData.get("guests") ?? "0");
    const nights = assertStay(checkIn, checkOut, guests);
    const amounts = {
      accommodationPence: moneyField(formData, "accommodation", "accommodation"),
      cleaningFeePence: moneyField(formData, "cleaning", "the cleaning fee"),
      extraGuestPence: moneyField(formData, "extraGuest", "the extra guest fee"),
      parkingPence: moneyField(formData, "parking", "parking"),
      otherRevenuePence: moneyField(formData, "other", "other revenue"),
      platformCommissionPence: moneyField(formData, "commission", "the platform fee"),
      paymentProcessingFeePence: moneyField(formData, "processing", "the processing fee"),
      refundsPence: moneyField(formData, "refunds", "refunds"),
      adjustmentsPence: moneyField(formData, "adjustments", "adjustments"),
    };
    for (const value of Object.values(amounts)) {
      if (typeof value !== "number") {
        return value;
      }
    }
    const financials = calculateBookingFinancials({
      accommodationPence: amounts.accommodationPence as number,
      cleaningFeePence: amounts.cleaningFeePence as number,
      extraGuestPence: amounts.extraGuestPence as number,
      parkingPence: amounts.parkingPence as number,
      otherRevenuePence: amounts.otherRevenuePence as number,
      platformCommissionPence: amounts.platformCommissionPence as number,
      paymentProcessingFeePence: amounts.paymentProcessingFeePence as number,
      refundsPence: amounts.refundsPence as number,
      adjustmentsPence: amounts.adjustmentsPence as number,
    });
    if (financials.grossRevenuePence <= 0) {
      return invalidForm(MESSAGE.VALIDATION, { accommodation: "Enter the guest charges." });
    }
    if (financials.grossRevenuePence <= 0) {
      return invalidForm(MESSAGE.VALIDATION, { accommodation: "Enter the guest charges." });
    }
    const scope = organizationScope(session);
    const [property, customer] = await Promise.all([
      prisma.property.findFirst({ where: { id: propertyId, ...scope } }),
      prisma.customer.findFirst({ where: { id: customerId, ...scope } }),
    ]);
    if (!property || !customer) {
      return invalidForm(MESSAGE.NOT_FOUND);
    }
    const bookingId = await prisma.$transaction(async (tx) => {
      const latest = await tx.booking.findFirst({
        where: { organizationId: session.organizationId },
        orderBy: { reference: "desc" },
        select: { reference: true },
      });
      const reference = nextReference("MIRA-B-", latest?.reference ?? null, 5);
      const booking = await tx.booking.create({
        data: {
          ...scope,
          propertyId,
          customerId,
          reference,
          platform: platformValue,
          externalBookingId,
          status: checkOut < dateToIso(new Date()) ? "COMPLETED" : "CONFIRMED",
          checkInDate: new Date(`${checkIn}T00:00:00.000Z`),
          checkOutDate: new Date(`${checkOut}T00:00:00.000Z`),
          numberOfNights: nights,
          numberOfGuests: guests,
          accommodationRevenue: fromPence(amounts.accommodationPence as number),
          cleaningRevenue: fromPence(amounts.cleaningFeePence as number),
          extraGuestRevenue: fromPence(amounts.extraGuestPence as number),
          parkingRevenue: fromPence(amounts.parkingPence as number),
          otherRevenue: fromPence(amounts.otherRevenuePence as number),
          grossRevenue: fromPence(financials.grossRevenuePence),
          platformCommission: fromPence(amounts.platformCommissionPence as number),
          paymentProcessingFee: fromPence(amounts.paymentProcessingFeePence as number),
          refunds: fromPence(amounts.refundsPence as number),
          adjustments: fromPence(amounts.adjustmentsPence as number),
          netPayout: fromPence(financials.netPayoutPence),
          vatAmount: fromPence(0),
          reconciliationStatus: "UNMATCHED",
          notes: String(formData.get("notes") ?? "") || null,
          createdById: session.userId,
        },
      });
      const incomeParts: Array<[string, number]> = [
        [accommodationIncomeCode(platformValue), amounts.accommodationPence as number],
        [INCOME_CODE.CLEANING_FEE, amounts.cleaningFeePence as number],
        [INCOME_CODE.EXTRA_GUEST_FEE, amounts.extraGuestPence as number],
        [INCOME_CODE.PARKING_FEE, amounts.parkingPence as number],
        [INCOME_CODE.OTHER_GUEST_FEE, amounts.otherRevenuePence as number],
      ];
      for (const [code, amount] of incomeParts) {
        if (amount <= 0) {
          continue;
        }
        const category = await tx.incomeCategory.findFirst({ where: { organizationId: session.organizationId, code } });
        if (!category) {
          throw new DomainError("Income categories are not set up.");
        }
        await tx.income.create({
          data: {
            ...scope,
            propertyId,
            bookingId: booking.id,
            customerId,
            categoryId: category.id,
            channel: platformValue,
            grossAmount: fromPence(amount),
            vatAmount: fromPence(0),
            netAmount: fromPence(amount),
            transactionDate: booking.checkOutDate,
            serviceDate: booking.checkInDate,
            paymentStatus: "ISSUED",
            createdById: session.userId,
          },
        });
      }
      if (financials.platformCostsPence > 0) {
        const feeCode = platformFeeCode(platformValue);
        const feeCategory = await tx.expenseCategory.findFirst({ where: { organizationId: session.organizationId, code: feeCode } });
        if (!feeCategory) {
          throw new DomainError("Platform fee categories are not set up.");
        }
        const latestExpense = await tx.expense.findFirst({
          where: { organizationId: session.organizationId },
          orderBy: { reference: "desc" },
          select: { reference: true },
        });
        await tx.expense.create({
          data: {
            ...scope,
            propertyId,
            bookingId: booking.id,
            categoryId: feeCategory.id,
            reference: nextReference("EXP-", latestExpense?.reference ?? null, 5),
            description: `Platform fee for ${reference}`,
            transactionDate: booking.checkOutDate,
            netAmount: fromPence(financials.platformCostsPence),
            vatAmount: fromPence(0),
            grossAmount: fromPence(financials.platformCostsPence),
            paymentMethod: "PLATFORM_PAYOUT",
            taxClassification: "ALLOWABLE",
            vatTreatment: "UNKNOWN",
            vatRecoverable: "UNKNOWN",
            isCapitalExpense: false,
            businessPercentage: new Prisma.Decimal(100),
            createdById: session.userId,
          },
        });
      }
      if ((amounts.refundsPence as number) > 0) {
        const count = await tx.refund.count({ where: { organizationId: session.organizationId } });
        await tx.refund.create({
          data: {
            ...scope,
            bookingId: booking.id,
            customerId,
            propertyId,
            reference: `REF-${String(count + 1).padStart(4, "0")}`,
            amount: fromPence(amounts.refundsPence as number),
            reason: "OTHER",
            refundedOn: booking.checkOutDate,
            method: "PLATFORM_PAYOUT",
          },
        });
      }
      await appendAuditLog(tx, session, {
        action: "BOOKING_CREATED",
        entityType: "booking",
        entityId: booking.id,
        summary: `${reference} posted. Gross ${financials.grossRevenuePence} pence, payout ${financials.netPayoutPence} pence.`,
      });
      return booking.id;
    });
    redirect(organizationPath(session.organizationSlug, `/bookings/${bookingId}`));
  }, "create-booking");
}

export async function createExpenseAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return guard(async () => {
    const session = await requireSession();
    const scope = organizationScope(session);
    const categoryId = String(formData.get("categoryId") ?? "");
    const category = await prisma.expenseCategory.findFirst({
      where: { id: categoryId, ...scope },
      include: { parent: true },
    });
    if (!category) {
      return invalidForm(MESSAGE.VALIDATION, { categoryId: "Choose a category." });
    }
    if (!canPostExpense(session.role, category.parent?.code ?? null)) {
      return invalidForm(MESSAGE.UNAUTHORISED);
    }
    const net = moneyField(formData, "net", "the net amount");
    const vat = moneyField(formData, "vat", "the VAT");
    const gross = moneyField(formData, "gross", "the gross amount");
    if (typeof net !== "number") return net;
    if (typeof vat !== "number") return vat;
    if (typeof gross !== "number") return gross;
    if (net + vat !== gross) {
      return invalidForm(MESSAGE.VALIDATION, { gross: "Gross must equal net plus VAT." });
    }
    const transactionDate = assertIsoDate(String(formData.get("transactionDate") ?? ""));
    const description = String(formData.get("description") ?? "").trim();
    if (description.length < 3) {
      return invalidForm(MESSAGE.VALIDATION, { description: "Describe the business purpose." });
    }
    const propertyId = String(formData.get("propertyId") ?? "");
    const supplierId = String(formData.get("supplierId") ?? "");
    const bookingId = String(formData.get("bookingId") ?? "");
    const methodValue = String(formData.get("paymentMethod") ?? "BANK_TRANSFER");
    if (!isPaymentMethod(methodValue)) {
      return invalidForm(MESSAGE.VALIDATION, { paymentMethod: "Choose a payment method." });
    }
    const catalog = catalogByCode(category.code);
    const expenseId = await prisma.$transaction(async (tx) => {
      const latest = await tx.expense.findFirst({
        where: { organizationId: session.organizationId },
        orderBy: { reference: "desc" },
        select: { reference: true },
      });
      const expense = await tx.expense.create({
        data: {
          ...scope,
          propertyId: propertyId || null,
          supplierId: supplierId || null,
          bookingId: bookingId || null,
          categoryId: category.id,
          reference: nextReference("EXP-", latest?.reference ?? null, 5),
          description,
          invoiceNumber: String(formData.get("invoiceNumber") ?? "") || null,
          transactionDate: new Date(`${transactionDate}T00:00:00.000Z`),
          netAmount: fromPence(net),
          vatAmount: fromPence(vat),
          grossAmount: fromPence(gross),
          paymentMethod: methodValue,
          taxClassification: catalog?.taxClassification ?? category.defaultTaxClassification,
          vatTreatment: vat > 0 ? "STANDARD" : "OUTSIDE_SCOPE",
          vatRecoverable: "UNKNOWN",
          expenseNature: catalog?.expenseNature ?? EXPENSE_NATURE.UNKNOWN,
          accountingClass: catalog?.accountingClassification ?? undefined,
          isCapitalExpense: (catalog?.taxClassification ?? category.defaultTaxClassification) === "CAPITAL",
          businessPercentage: new Prisma.Decimal(100),
          notes: String(formData.get("notes") ?? "") || null,
          createdById: session.userId,
        },
      });
      await storeReceipt(formData, session, expense.id, tx);
      await appendAuditLog(tx, session, {
        action: "EXPENSE_CREATED",
        entityType: "expense",
        entityId: expense.id,
        summary: `${expense.reference} created for ${gross} pence.`,
      });
      return expense.id;
    });
    redirect(organizationPath(session.organizationSlug, `/expenses?created=${expenseId}`));
  }, "create-expense");
}

async function storeReceipt(
  formData: FormData,
  session: Awaited<ReturnType<typeof requireSession>>,
  expenseId: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const file = formData.get("receipt");
  if (!(file instanceof File) || file.size === 0) {
    return;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new DomainError(MESSAGE.FILE_SIZE);
  }
  if (!extensionAllowed(file.name, ALLOWED_UPLOAD_EXTENSIONS)) {
    throw new DomainError(MESSAGE.FILE_TYPE);
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const storageKey = `${session.organizationId}/${randomUUID()}.${extension}`;
  const absolute = resolveStoragePath(path.join(process.cwd(), "storage"), storageKey);
  if (!absolute) {
    throw new DomainError(MESSAGE.FILE_TYPE);
  }
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, Buffer.from(await file.arrayBuffer()));
  await tx.document.create({
    data: {
      tenantId: session.tenantId,
      organizationId: session.organizationId,
      expenseId,
      kind: DOCUMENT_KIND.RECEIPT,
      title: file.name,
      storageKey,
      mimeType: contentTypeForStorageKey(storageKey) ?? "application/octet-stream",
      byteSize: file.size,
      createdById: session.userId,
    },
  });
}

export async function createInvoiceAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return guard(async () => {
    const session = await requireSession();
    if (!canMutateFinance(session.role)) {
      return invalidForm(MESSAGE.UNAUTHORISED);
    }
    const customerId = String(formData.get("customerId") ?? "");
    const description = String(formData.get("description") ?? "").trim();
    const net = moneyField(formData, "net", "the net amount");
    if (typeof net !== "number") return net;
    if (net <= 0 || description.length < 3) {
      return invalidForm(MESSAGE.VALIDATION, { description: "Add a description and a positive amount." });
    }
    const issueDate = assertIsoDate(String(formData.get("issueDate") ?? ""));
    const dueDate = assertIsoDate(String(formData.get("dueDate") ?? ""));
    if (dueDate < issueDate) {
      return invalidForm(MESSAGE.VALIDATION, { dueDate: "Due date cannot be before the issue date." });
    }
    const scope = organizationScope(session);
    const [customer, company] = await Promise.all([
      prisma.customer.findFirst({ where: { id: customerId, ...scope } }),
      prisma.organization.findFirst({ where: { id: session.organizationId, tenantId: session.tenantId } }),
    ]);
    if (!customer || !company) {
      return invalidForm(MESSAGE.NOT_FOUND);
    }
    const vat = company.vatRegistered ? Math.round(net * 0.2) : 0;
    const gross = net + vat;
    const invoiceId = await prisma.$transaction(async (tx) => {
      const latest = await tx.invoice.findFirst({
        where: { organizationId: session.organizationId },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      const number = nextReference("INV-", latest?.number ?? null, 5);
      const invoice = await tx.invoice.create({
        data: {
          ...scope,
          customerId,
          number,
          status: "ISSUED",
          issueDate: new Date(`${issueDate}T00:00:00.000Z`),
          dueDate: new Date(`${dueDate}T00:00:00.000Z`),
          netAmount: fromPence(net),
          vatAmount: fromPence(vat),
          grossAmount: fromPence(gross),
          notes: company.vatRegistered ? null : "Not a VAT invoice. Mira Properties is not VAT registered.",
          createdById: session.userId,
          items: {
            create: {
              description,
              quantity: new Prisma.Decimal(1),
              unitAmount: fromPence(net),
              vatRateBps: company.vatRegistered ? 2000 : 0,
              netAmount: fromPence(net),
              vatAmount: fromPence(vat),
              grossAmount: fromPence(gross),
            },
          },
        },
      });
      await appendAuditLog(tx, session, {
        action: "INVOICE_ISSUED",
        entityType: "invoice",
        entityId: invoice.id,
        summary: `${number} issued for ${gross} pence.`,
      });
      return invoice.id;
    });
    redirect(organizationPath(session.organizationSlug, `/invoices/${invoiceId}`));
  }, "create-invoice");
}

export async function recordPaymentAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return guard(async () => {
    const session = await requireSession();
    if (!canMutateFinance(session.role)) {
      return invalidForm(MESSAGE.UNAUTHORISED);
    }
    const invoiceId = String(formData.get("invoiceId") ?? "");
    const amount = moneyField(formData, "amount", "the payment");
    if (typeof amount !== "number") return amount;
    const paidOn = assertIsoDate(String(formData.get("paidOn") ?? ""));
    const methodValue = String(formData.get("method") ?? "BANK_TRANSFER");
    if (!isPaymentMethod(methodValue)) {
      return invalidForm(MESSAGE.VALIDATION, { method: "Choose a payment method." });
    }
    await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, ...organizationScope(session) },
        include: { payments: true },
      });
      if (!invoice || invoice.status === "VOID") {
        throw new DomainError(MESSAGE.NOT_FOUND);
      }
      const total = toPence(invoice.grossAmount);
      const alreadyPaid = invoice.payments.reduce((sum, payment) => sum + toPence(payment.amount), 0);
      const balance = outstandingBalance(total, Math.min(alreadyPaid, total));
      const nextBalance = applyPayment(balance, amount);
      const count = await tx.payment.count({ where: { organizationId: session.organizationId } });
      await tx.payment.create({
        data: {
          ...organizationScope(session),
          direction: "RECEIVED",
          method: methodValue,
          amount: fromPence(amount),
          paidOn: new Date(`${paidOn}T00:00:00.000Z`),
          reference: `PAY-${String(count + 1).padStart(4, "0")}`,
          invoiceId: invoice.id,
          createdById: session.userId,
        },
      });
      const status = invoiceCollectionStatus({
        totalPence: total,
        paidPence: total - nextBalance,
        dueOn: dateToIso(invoice.dueDate),
        today: paidOn,
        isVoid: false,
        isDraft: false,
      });
      await tx.invoice.update({ where: { id: invoice.id }, data: { status } });
      await appendAuditLog(tx, session, {
        action: "PAYMENT_RECORDED",
        entityType: "invoice",
        entityId: invoice.id,
        summary: `${invoice.number} payment of ${amount} pence. Balance ${nextBalance} pence.`,
      });
    });
    redirect(organizationPath(session.organizationSlug, `/invoices/${invoiceId}`));
  }, "record-payment");
}

export async function reconcileAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return guard(async () => {
    const session = await requireSession();
    if (!canMutateFinance(session.role)) {
      return invalidForm(MESSAGE.UNAUTHORISED);
    }
    const bankTransactionId = String(formData.get("bankTransactionId") ?? "");
    const payoutId = String(formData.get("payoutId") ?? "");
    await prisma.$transaction(async (tx) => {
      const scope = organizationScope(session);
      const transaction = await tx.bankTransaction.findFirst({
        where: { id: bankTransactionId, tenantId: scope.tenantId, organizationId: scope.organizationId, direction: "CREDIT" },
      });
      const payout = await tx.payout.findFirst({
        where: { id: payoutId, ...scope },
        include: { allocations: true },
      });
      if (!transaction || !payout) {
        throw new DomainError(MESSAGE.NOT_FOUND);
      }
      const payoutPence = toPence(payout.amount);
      const parts = payout.allocations.map((allocation) => toPence(allocation.amount));
      if (toPence(transaction.amount) !== payoutPence || !isExactAllocation(payoutPence, parts)) {
        throw new DomainError(MESSAGE.PAYOUT_MISMATCH);
      }
      await tx.bankTransaction.update({
        where: { id: transaction.id },
        data: { reconciliationStatus: "RECONCILED", payoutId: payout.id },
      });
      await tx.payout.update({ where: { id: payout.id }, data: { reconciliationStatus: "RECONCILED" } });
      await tx.booking.updateMany({
        where: { id: { in: payout.allocations.map((allocation) => allocation.bookingId) }, ...scope },
        data: { reconciliationStatus: "RECONCILED" },
      });
      await appendAuditLog(tx, session, {
        action: "PAYOUT_RECONCILED",
        entityType: "payout",
        entityId: payout.id,
        summary: `${payout.reference} matched to ${transaction.description}.`,
      });
    });
    redirect(organizationPath(session.organizationSlug, "/reconciliation"));
  }, "reconcile");
}

export async function importBankCsvAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return guard(async () => {
    const session = await requireSession();
    if (!canMutateFinance(session.role)) {
      return invalidForm(MESSAGE.UNAUTHORISED);
    }
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return invalidForm(MESSAGE.VALIDATION, { file: "Choose a CSV file." });
    }
    const parsed = parseBankCsv(await file.text());
    if ("errors" in parsed) {
      return invalidForm(`${MESSAGE.CSV_REJECTED} ${parsed.errors.join(" ")}`);
    }
    const account = await prisma.bankAccount.findFirst({ where: organizationScope(session), orderBy: { createdAt: "asc" } });
    if (!account) {
      return invalidForm("Add a bank account before importing transactions.");
    }
    await prisma.$transaction(async (tx) => {
      for (const row of parsed.rows) {
        await tx.bankTransaction.create({
          data: {
            tenantId: session.tenantId,
            organizationId: session.organizationId,
            bankAccountId: account.id,
            occurredOn: new Date(`${row.occurredOn}T00:00:00.000Z`),
            description: row.description,
            amount: fromPence(row.amountPence),
            direction: row.direction,
            reference: row.reference || null,
            reconciliationStatus: "UNMATCHED",
          },
        });
      }
      await appendAuditLog(tx, session, {
        action: "BANK_IMPORTED",
        entityType: "bank_account",
        entityId: account.id,
        summary: `Imported ${parsed.rows.length} bank transactions.`,
      });
    });
    redirect(organizationPath(session.organizationSlug, "/banking"));
  }, "import-bank");
}

export async function createCustomerAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return guard(async () => {
    const session = await requireSession();
    if (!canMutateFinance(session.role)) {
      return invalidForm(MESSAGE.UNAUTHORISED);
    }
    const name = String(formData.get("name") ?? "").trim();
    if (name.length < 2) {
      return invalidForm(MESSAGE.VALIDATION, { name: "Enter the guest or company name." });
    }
    await prisma.customer.create({
      data: {
        ...organizationScope(session),
        name,
        email: String(formData.get("email") ?? "") || null,
        phone: String(formData.get("phone") ?? "") || null,
        companyName: String(formData.get("companyName") ?? "") || null,
      },
    });
    redirect(organizationPath(session.organizationSlug, "/customers"));
  }, "create-customer");
}

export async function createSupplierAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return guard(async () => {
    const session = await requireSession();
    if (!canMutateFinance(session.role)) {
      return invalidForm(MESSAGE.UNAUTHORISED);
    }
    const name = String(formData.get("name") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    if (name.length < 2 || category.length < 2) {
      return invalidForm(MESSAGE.VALIDATION, { name: "Enter a supplier name and category." });
    }
    await prisma.supplier.create({
      data: {
        ...organizationScope(session),
        name,
        category,
        email: String(formData.get("email") ?? "") || null,
        phone: String(formData.get("phone") ?? "") || null,
        vatNumber: String(formData.get("vatNumber") ?? "") || null,
      },
    });
    redirect(organizationPath(session.organizationSlug, "/suppliers"));
  }, "create-supplier");
}

export async function createPropertyAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return guard(async () => {
    const session = await requireSession();
    if (!canMutateFinance(session.role)) {
      return invalidForm(MESSAGE.UNAUTHORISED);
    }
    const name = String(formData.get("name") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim();
    const cityInput = String(formData.get("city") ?? "").trim();
    const postcode = normaliseUkPostcode(String(formData.get("postcode") ?? "")) ?? "";
    const bedroomsRaw = String(formData.get("bedrooms") ?? "").trim();
    const postcodePayload = postcode ? await readUkPostcode(postcode) : null;
    if (postcodePayload && postcodeLookupStatus(postcodePayload) === "invalid") {
      return invalidForm(MESSAGE.VALIDATION, { postcode: MESSAGE.PROPERTY_POSTCODE_UNKNOWN });
    }
    const locality = postcodePayload ? localityFromPostcodePayload(postcodePayload) : null;
    const city = cityInput.length >= 2 ? cityInput : locality ?? "";
    const fieldErrors = propertyCreateErrors({ name, address, city, postcode, bedroomsRaw });
    if (Object.keys(fieldErrors).length > 0) {
      return invalidForm(MESSAGE.VALIDATION, fieldErrors);
    }
    const existing = await prisma.property.findFirst({
      where: {
        organizationId: session.organizationId,
        postcode,
        address: { equals: address, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (existing) {
      return invalidForm(MESSAGE.PROPERTY_EXISTS, { address: MESSAGE.PROPERTY_EXISTS });
    }
    const property = await prisma.property.create({
      data: {
        ...organizationScope(session),
        name,
        address,
        city,
        postcode,
        bedrooms: Number(bedroomsRaw),
      },
    });
    await appendAuditLog(prisma, session, {
      action: "PROPERTY_CREATED",
      entityType: "property",
      entityId: property.id,
      summary: `Created property ${property.name}.`,
    });
    redirect(organizationPath(session.organizationSlug, `/properties/${property.id}`));
  }, "create-property");
}

export async function updateSettingsAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return guard(async () => {
    const session = await requireSession();
    if (!canManageSettings(session.role) || !canConfigureBank(session.role)) {
      return invalidForm(MESSAGE.UNAUTHORISED);
    }
    const tradingName = String(formData.get("tradingName") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const retention = Number(formData.get("retentionYears") ?? DEFAULT_DOCUMENT_RETENTION_YEARS);
    if (tradingName.length < 2) {
      return invalidForm(MESSAGE.VALIDATION, { tradingName: "Enter the trading name." });
    }
    if (!Number.isInteger(retention) || retention < DEFAULT_DOCUMENT_RETENTION_YEARS || retention > 15) {
      return invalidForm(MESSAGE.VALIDATION, { retentionYears: "Keep financial documents for at least 7 years." });
    }
    await prisma.organization.update({
      where: { id: session.organizationId },
      data: {
        tradingName,
        phone: phone || null,
        vatRegistered: formData.get("vatRegistered") === "on",
        documentRetentionYears: retention,
      },
    });
    await appendAuditLog(prisma, session, {
      action: "SETTINGS_UPDATED",
      entityType: "company",
      entityId: session.organizationId,
      summary: "Company settings updated.",
    });
    redirect(organizationPath(session.organizationSlug, "/settings"));
  }, "update-settings");
}

const MEMBER_INTENT = {
  ROLE: "role",
  DEACTIVATE: "deactivate",
  ACTIVATE: "activate",
} as const;

function inviteLink(token: string): string {
  return `${appOrigin()}/invite/${token}`;
}

function accessMessage(code: string | null): string | null {
  if (code === "OWN_ACCESS") {
    return MESSAGE.OWN_ACCESS;
  }
  if (code === "LAST_OWNER") {
    return MESSAGE.LAST_OWNER;
  }
  return null;
}

export async function inviteUserAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return guard(async () => {
    const session = await requireSession();
    if (!canManageSettings(session.role)) {
      return invalidForm(MESSAGE.UNAUTHORISED);
    }
    const email = normaliseEmail(String(formData.get("email") ?? ""));
    const roleValue = String(formData.get("role") ?? "");
    if (!email) {
      return invalidForm(MESSAGE.VALIDATION, { email: "Enter a valid email address." });
    }
    if (!isUserRole(roleValue)) {
      return invalidForm(MESSAGE.VALIDATION, { role: "Choose a role." });
    }
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const membership = await prisma.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId: session.organizationId, userId: existingUser.id } },
      });
      if (membership) {
        return invalidForm(MESSAGE.ALREADY_MEMBER, { email: MESSAGE.ALREADY_MEMBER });
      }
    }
    const token = newInviteToken();
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.invitation.updateMany({
        where: {
          tenantId: session.tenantId,
          organizationId: session.organizationId,
          email,
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });
      await tx.invitation.create({
        data: {
          tenantId: session.tenantId,
          organizationId: session.organizationId,
          email,
          role: roleValue,
          tokenHash: hashInviteToken(token),
          expiresAt: inviteExpiresAt(now),
          invitedById: session.userId,
        },
      });
    });
    await appendAuditLog(prisma, session, {
      action: "USER_INVITED",
      entityType: "invitation",
      entityId: email,
      summary: `Invited ${email}.`,
    });
    revalidatePath(organizationPath(session.organizationSlug, "/settings"));
    return inviteReady(inviteLink(token));
  }, "invite-user");
}

export async function createMemberAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return guard(async () => {
    const session = await requireSession();
    if (!canManageSettings(session.role)) {
      return invalidForm(MESSAGE.UNAUTHORISED);
    }
    const name = String(formData.get("name") ?? "").trim();
    const email = normaliseEmail(String(formData.get("email") ?? ""));
    const roleValue = String(formData.get("role") ?? "");
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    const existingUser = email ? await prisma.user.findUnique({ where: { email } }) : null;
    const fieldErrors = memberCreateErrors({
      name,
      email,
      role: roleValue,
      password,
      confirmPassword,
      accountExists: existingUser !== null,
    });
    if (Object.keys(fieldErrors).length > 0 || !email || !isUserRole(roleValue)) {
      return invalidForm(MESSAGE.VALIDATION, fieldErrors);
    }
    if (existingUser && !existingUser.isActive) {
      return invalidForm(MESSAGE.ACCOUNT_DISABLED, { email: MESSAGE.ACCOUNT_DISABLED });
    }
    if (existingUser) {
      const membership = await prisma.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId: session.organizationId, userId: existingUser.id } },
      });
      if (membership) {
        return invalidForm(MESSAGE.ALREADY_MEMBER, { email: MESSAGE.ALREADY_MEMBER });
      }
      await prisma.organizationMembership.create({
        data: {
          organizationId: session.organizationId,
          userId: existingUser.id,
          role: roleValue,
          invitedById: session.userId,
        },
      });
      await appendAuditLog(prisma, session, {
        action: "USER_ADDED",
        entityType: "user",
        entityId: existingUser.id,
        summary: `Added ${existingUser.email} to the organisation.`,
      });
      revalidatePath(organizationPath(session.organizationSlug, "/settings"));
      return completedForm(MESSAGE.USER_ADDED);
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const created = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: { email, name, passwordHash },
      });
      await transaction.organizationMembership.create({
        data: {
          organizationId: session.organizationId,
          userId: user.id,
          role: roleValue,
          invitedById: session.userId,
        },
      });
      return user;
    });
    await appendAuditLog(prisma, session, {
      action: "USER_CREATED",
      entityType: "user",
      entityId: created.id,
      summary: `Created ${created.email}.`,
    });
    revalidatePath(organizationPath(session.organizationSlug, "/settings"));
    return completedForm(MESSAGE.USER_CREATED);
  }, "create-member");
}

export async function revokeInviteAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return guard(async () => {
    const session = await requireSession();
    if (!canManageSettings(session.role)) {
      return invalidForm(MESSAGE.UNAUTHORISED);
    }
    const invitationId = String(formData.get("invitationId") ?? "");
    const now = new Date();
    const updated = await prisma.invitation.updateMany({
      where: {
        id: invitationId,
        ...organizationScope(session),
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });
    if (updated.count !== 1) {
      return invalidForm(MESSAGE.NOT_FOUND);
    }
    await appendAuditLog(prisma, session, {
      action: "INVITE_REVOKED",
      entityType: "invitation",
      entityId: invitationId,
      summary: "Invite revoked.",
    });
    revalidatePath(organizationPath(session.organizationSlug, "/settings"));
    return invalidForm(MESSAGE.SAVED);
  }, "revoke-invite");
}

export async function updateMemberAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return guard(async () => {
    const session = await requireSession();
    if (!canManageSettings(session.role)) {
      return invalidForm(MESSAGE.UNAUTHORISED);
    }
    const userId = String(formData.get("userId") ?? "");
    const intent = String(formData.get("intent") ?? "");
    const member = await prisma.organizationMembership.findFirst({
      where: { userId, organizationId: session.organizationId },
      include: { user: true },
    });
    if (!member || !isUserRole(member.role)) {
      return invalidForm(MESSAGE.NOT_FOUND);
    }
    const requestedRole = String(formData.get("role") ?? member.role);
    if (!isUserRole(requestedRole)) {
      return invalidForm(MESSAGE.VALIDATION, { role: "Choose a role." });
    }
    const nextRole = intent === MEMBER_INTENT.ROLE ? requestedRole : member.role;
    const nextActive = intent === MEMBER_INTENT.DEACTIVATE ? false : intent === MEMBER_INTENT.ACTIVATE ? true : member.status === "ACTIVE";
    if (intent !== MEMBER_INTENT.ROLE && intent !== MEMBER_INTENT.DEACTIVATE && intent !== MEMBER_INTENT.ACTIVATE) {
      return invalidForm(MESSAGE.VALIDATION);
    }
    const owners = await prisma.organizationMembership.findMany({
      where: { organizationId: session.organizationId, role: "OWNER", status: "ACTIVE" },
      select: { userId: true },
    });
    const blocked = accessMessage(membershipChangeBlock({
      actorUserId: session.userId,
      targetUserId: member.userId,
      nextActive,
      nextRole,
      activeOwnerIds: owners.map((owner) => owner.userId),
    }));
    if (blocked) {
      return invalidForm(blocked);
    }
    await prisma.organizationMembership.update({
      where: { id: member.id },
      data: { role: nextRole, status: nextActive ? "ACTIVE" : "SUSPENDED" },
    });
    await appendAuditLog(prisma, session, {
      action: "USER_ACCESS_UPDATED",
      entityType: "user",
      entityId: member.userId,
      summary: nextActive ? `Updated access for ${member.user.email}.` : `Turned off access for ${member.user.email}.`,
    });
    revalidatePath(organizationPath(session.organizationSlug, "/settings"));
    return invalidForm(MESSAGE.SAVED);
  }, "update-member");
}

export async function acceptInviteAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return guard(async () => {
    const token = String(formData.get("token") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    if (name.length < 2 || name.length > 80) {
      return invalidForm(MESSAGE.VALIDATION, { name: "Enter your name." });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return invalidForm(MESSAGE.PASSWORD_SHORT, { password: MESSAGE.PASSWORD_SHORT });
    }
    if (password !== confirmPassword) {
      return invalidForm(MESSAGE.PASSWORD_MISMATCH, { confirmPassword: MESSAGE.PASSWORD_MISMATCH });
    }
    const now = new Date();
    const invitation = await prisma.invitation.findUnique({ where: { tokenHash: hashInviteToken(token) } });
    if (!invitation || !isUserRole(invitation.role) || !inviteIsOpen({
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      revokedAt: invitation.revokedAt,
      now,
    })) {
      return invalidForm(MESSAGE.INVITE_CLOSED);
    }
    const existing = await prisma.user.findUnique({ where: { email: invitation.email } });
    const organization = await prisma.organization.findUnique({ where: { id: invitation.organizationId } });
    if (!organization) {
      return invalidForm(MESSAGE.INVITE_CLOSED);
    }
    if (existing) {
      const passwordMatches = await bcrypt.compare(password, existing.passwordHash);
      if (!passwordMatches || !existing.isActive) {
        return invalidForm(MESSAGE.INVALID_CREDENTIALS);
      }
      const already = await prisma.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId: organization.id, userId: existing.id } },
      });
      if (already) {
        return invalidForm(MESSAGE.ALREADY_MEMBER);
      }
    }
    const passwordHash = existing ? null : await bcrypt.hash(password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const claimed = await tx.invitation.updateMany({
        where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { acceptedAt: now },
      });
      if (claimed.count !== 1) {
        throw new DomainError(MESSAGE.INVITE_CLOSED);
      }
      const account = existing ?? await tx.user.create({
        data: {
          email: invitation.email,
          name,
          passwordHash: passwordHash ?? "",
        },
      });
      await tx.organizationMembership.create({
        data: {
          organizationId: organization.id,
          userId: account.id,
          role: invitation.role,
          invitedById: invitation.invitedById,
        },
      });
      return account;
    });
    await appendAuditLog(prisma, {
      userId: user.id,
      tenantId: organization.tenantId,
      organizationId: organization.id,
      organizationSlug: organization.slug,
      role: invitation.role,
      name: user.name,
      email: user.email,
    }, {
      action: "USER_JOINED",
      entityType: "user",
      entityId: user.id,
      summary: `${user.email} joined ${organization.tradingName}.`,
    });
    const sessionToken = await createSessionToken({
      userId: user.id,
      organizationId: organization.id,
    });
    await writeSessionCookie(sessionToken);
    redirect(organizationPath(organization.slug, homeForRole(invitation.role)));
  }, "accept-invite");
}

export async function createOrganizationAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return guard(async () => {
    const user = await getAuthenticatedUser();
    if (!user) {
      redirect("/login");
    }
    if (!(await userCanCreateOrganization(user.userId))) {
      return invalidForm(MESSAGE.ORGANISATION_CREATE_DENIED);
    }
    const tradingName = String(formData.get("tradingName") ?? "").trim();
    const legalName = String(formData.get("legalName") ?? "").trim();
    const email = normaliseEmail(String(formData.get("email") ?? ""));
    const addressLine1 = String(formData.get("addressLine1") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const postcode = String(formData.get("postcode") ?? "").trim().toUpperCase();
    if (tradingName.length < 2) {
      return invalidForm(MESSAGE.VALIDATION, { tradingName: "Enter the organisation name." });
    }
    if (legalName.length < 2) {
      return invalidForm(MESSAGE.VALIDATION, { legalName: "Enter the legal name." });
    }
    if (!email) {
      return invalidForm(MESSAGE.VALIDATION, { email: "Enter a valid email address." });
    }
    if (addressLine1.length < 2 || city.length < 2 || postcode.length < 5) {
      return invalidForm(MESSAGE.VALIDATION, { addressLine1: "Enter the registered address, city, and postcode." });
    }
    const created = await createOrganizationWithOwner(prisma, {
      userId: user.userId,
      tradingName,
      legalName,
      email,
      addressLine1,
      city,
      postcode,
      role: USER_ROLE.OWNER,
    });
    const sessionToken = await createSessionToken({ userId: user.userId, organizationId: created.organizationId });
    await writeSessionCookie(sessionToken);
    redirect(organizationPath(created.slug));
  }, "create-organization");
}
