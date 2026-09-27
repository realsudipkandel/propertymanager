"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
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
  PAYMENT_METHOD,
  type BookingPlatform,
  type PaymentMethod,
} from "@/domain/constants";
import { assertExternalBookingReference, assertStay, calculateBookingFinancials } from "@/domain/accounting";
import { assertIsoDate, dateToIso } from "@/domain/dates";
import { extensionAllowed, resolveStoragePath } from "@/domain/files";
import { invalidForm, type FormState } from "@/domain/form-state";
import { applyPayment, invoiceCollectionStatus, outstandingBalance } from "@/domain/invoices";
import { DomainError, parsePoundsToPence } from "@/domain/money";
import { canConfigureBank, canMutateFinance, canPostExpense, canManageSettings } from "@/domain/permissions";
import { isExactAllocation } from "@/domain/reconciliation";
import { parseBankCsv } from "@/domain/csv";
import { appendAuditLog } from "@/server/audit";
import { prisma } from "@/server/db";
import { fromPence, toPence } from "@/server/money";
import { logServerError, nextReference } from "@/server/reference";
import { clearSessionCookie, companyScope, createSessionToken, requireSession, writeSessionCookie } from "@/server/session";

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

export async function loginAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  const matches = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !matches || !user.isActive) {
    return invalidForm(MESSAGE.INVALID_CREDENTIALS);
  }
  const token = await createSessionToken({
    userId: user.id,
    tenantId: user.tenantId,
    companyId: user.companyId,
  });
  await writeSessionCookie(token);
  redirect("/");
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
    const scope = companyScope(session);
    const [property, customer] = await Promise.all([
      prisma.property.findFirst({ where: { id: propertyId, ...scope } }),
      prisma.customer.findFirst({ where: { id: customerId, ...scope } }),
    ]);
    if (!property || !customer) {
      return invalidForm(MESSAGE.NOT_FOUND);
    }
    const bookingId = await prisma.$transaction(async (tx) => {
      const latest = await tx.booking.findFirst({
        where: { companyId: session.companyId },
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
        const category = await tx.incomeCategory.findFirst({ where: { companyId: session.companyId, code } });
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
        const feeCategory = await tx.expenseCategory.findFirst({ where: { companyId: session.companyId, code: feeCode } });
        if (!feeCategory) {
          throw new DomainError("Platform fee categories are not set up.");
        }
        const latestExpense = await tx.expense.findFirst({
          where: { companyId: session.companyId },
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
        const count = await tx.refund.count({ where: { companyId: session.companyId } });
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
    redirect(`/bookings/${bookingId}`);
  }, "create-booking");
}

export async function createExpenseAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return guard(async () => {
    const session = await requireSession();
    const scope = companyScope(session);
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
        where: { companyId: session.companyId },
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
    redirect(`/expenses?created=${expenseId}`);
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
  const storageKey = `${session.companyId}/${randomUUID()}.${extension}`;
  const absolute = resolveStoragePath(path.join(process.cwd(), "storage"), storageKey);
  if (!absolute) {
    throw new DomainError(MESSAGE.FILE_TYPE);
  }
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, Buffer.from(await file.arrayBuffer()));
  await tx.document.create({
    data: {
      tenantId: session.tenantId,
      companyId: session.companyId,
      expenseId,
      kind: DOCUMENT_KIND.RECEIPT,
      title: file.name,
      storageKey,
      mimeType: file.type || "application/octet-stream",
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
    const scope = companyScope(session);
    const [customer, company] = await Promise.all([
      prisma.customer.findFirst({ where: { id: customerId, ...scope } }),
      prisma.company.findFirst({ where: { id: session.companyId, tenantId: session.tenantId } }),
    ]);
    if (!customer || !company) {
      return invalidForm(MESSAGE.NOT_FOUND);
    }
    const vat = company.vatRegistered ? Math.round(net * 0.2) : 0;
    const gross = net + vat;
    const invoiceId = await prisma.$transaction(async (tx) => {
      const latest = await tx.invoice.findFirst({
        where: { companyId: session.companyId },
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
    redirect(`/invoices/${invoiceId}`);
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
        where: { id: invoiceId, ...companyScope(session) },
        include: { payments: true },
      });
      if (!invoice || invoice.status === "VOID") {
        throw new DomainError(MESSAGE.NOT_FOUND);
      }
      const total = toPence(invoice.grossAmount);
      const alreadyPaid = invoice.payments.reduce((sum, payment) => sum + toPence(payment.amount), 0);
      const balance = outstandingBalance(total, Math.min(alreadyPaid, total));
      const nextBalance = applyPayment(balance, amount);
      const count = await tx.payment.count({ where: { companyId: session.companyId } });
      await tx.payment.create({
        data: {
          ...companyScope(session),
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
    redirect(`/invoices/${invoiceId}`);
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
      const scope = companyScope(session);
      const transaction = await tx.bankTransaction.findFirst({
        where: { id: bankTransactionId, tenantId: scope.tenantId, companyId: scope.companyId, direction: "CREDIT" },
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
    redirect("/reconciliation");
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
    const account = await prisma.bankAccount.findFirst({ where: companyScope(session), orderBy: { createdAt: "asc" } });
    if (!account) {
      return invalidForm("Add a bank account before importing transactions.");
    }
    await prisma.$transaction(async (tx) => {
      for (const row of parsed.rows) {
        await tx.bankTransaction.create({
          data: {
            tenantId: session.tenantId,
            companyId: session.companyId,
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
    redirect("/banking");
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
        ...companyScope(session),
        name,
        email: String(formData.get("email") ?? "") || null,
        phone: String(formData.get("phone") ?? "") || null,
        companyName: String(formData.get("companyName") ?? "") || null,
      },
    });
    redirect("/customers");
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
        ...companyScope(session),
        name,
        category,
        email: String(formData.get("email") ?? "") || null,
        phone: String(formData.get("phone") ?? "") || null,
        vatNumber: String(formData.get("vatNumber") ?? "") || null,
      },
    });
    redirect("/suppliers");
  }, "create-supplier");
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
    await prisma.company.update({
      where: { id: session.companyId },
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
      entityId: session.companyId,
      summary: "Company settings updated.",
    });
    redirect("/settings");
  }, "update-settings");
}
