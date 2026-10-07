import { BILL_HORIZON_DAYS, BOOKING_PLATFORM, INVOICE_STATUS, LEDGER_KIND, PARENT_CATEGORY, RECONCILIATION_STATUS, SUPPLIER_BILL_STATUS, type BookingPlatform, type ReconciliationStatus } from "@/domain/constants";
import { assembleDashboard, ledgerWindow, previousMatchingPeriod, resolveDashboardPeriod, type DashboardView } from "@/domain/dashboard";
import { addDays, calendarMonthContaining, dateToIso, formatDisplayDate, todayIso, trailingMonths, type DatePeriod } from "@/domain/dates";
import { buildAlerts } from "@/domain/alerts";
import { invoiceCollectionStatus, supplierBillStatus } from "@/domain/invoices";
import { suggestUniqueAmountMatch } from "@/domain/reconciliation";
import { buildProfitAndLoss } from "@/domain/reports";
import { activeTaxConfig, assessVatThreshold } from "@/domain/vat";
import { prisma } from "@/server/db";
import { toPence } from "@/server/money";
import { loadLedgerLines } from "@/server/queries";
import { organizationScope, type Session } from "@/server/session";

export type DashboardQuery = {
  range?: string;
  basis?: string;
  from?: string;
  to?: string;
};

function periodBounds(period: DatePeriod): { gte: Date; lt: Date } {
  return {
    gte: new Date(`${period.start}T00:00:00.000Z`),
    lt: new Date(`${period.endExclusive}T00:00:00.000Z`),
  };
}

function collectedPence(totalPence: number, paidPence: number): { paid: number; balance: number } {
  const paid = Math.min(Math.max(paidPence, 0), Math.max(totalPence, 0));
  return { paid, balance: Math.max(totalPence, 0) - paid };
}

function asPlatform(value: string): BookingPlatform {
  const known = Object.values(BOOKING_PLATFORM);
  return known.find((platform) => platform === value) ?? BOOKING_PLATFORM.OTHER;
}

function asReconciliation(value: string): ReconciliationStatus {
  if (value === RECONCILIATION_STATUS.MATCHED || value === RECONCILIATION_STATUS.RECONCILED || value === RECONCILIATION_STATUS.PARTIALLY_MATCHED) {
    return value;
  }
  return RECONCILIATION_STATUS.UNMATCHED;
}

export async function getDashboard(session: Session, query: DashboardQuery): Promise<DashboardView> {
  const scope = organizationScope(session);
  const today = todayIso();
  const company = await prisma.organization.findFirstOrThrow({
    where: { id: session.organizationId, tenantId: session.tenantId },
  });
  const resolved = resolveDashboardPeriod({
    range: query.range,
    today,
    financialYearStartMonth: company.financialYearStartMonth,
    financialYearStartDay: company.financialYearStartDay,
    customStart: query.from,
    customEnd: query.to,
  });
  const previous = previousMatchingPeriod(resolved.period);
  const window = ledgerWindow(today, resolved.period, previous);
  const bounds = periodBounds(window);
  const month = calendarMonthContaining(today);
  const [lines, properties, bookings, invoices, accounts, recurring, bills, documents, contracts, taxSettings, payouts, supplierGroups] =
    await Promise.all([
      loadLedgerLines(session, window),
      prisma.property.findMany({ where: scope, orderBy: { name: "asc" } }),
      prisma.booking.findMany({
        where: {
          ...scope,
          status: { not: "CANCELLED" },
          checkInDate: { lt: bounds.lt },
          checkOutDate: { gt: bounds.gte },
        },
        include: { property: { select: { name: true } }, customer: { select: { name: true } } },
      }),
      prisma.invoice.findMany({ where: scope, include: { payments: true } }),
      prisma.bankAccount.findMany({
        where: scope,
        include: { transactions: { include: { payout: { select: { platform: true } } } } },
      }),
      prisma.recurringExpense.findMany({ where: { ...scope, isActive: true }, orderBy: { nextDueOn: "asc" } }),
      prisma.supplierBill.findMany({ where: scope, include: { supplier: true, payments: true } }),
      prisma.document.findMany({ where: scope, include: { property: { select: { name: true } } } }),
      prisma.propertyContract.findMany({ where: scope, include: { property: true } }),
      prisma.taxSetting.findMany({ where: scope, orderBy: { effectiveFrom: "desc" } }),
      prisma.payout.findMany({
        where: { ...scope, paidOn: { gte: bounds.gte, lt: bounds.lt } },
        include: { allocations: true },
      }),
      prisma.expense.groupBy({
        by: ["supplierId"],
        where: { ...scope, supplierId: { not: null }, transactionDate: periodBounds(resolved.period) },
        _sum: { grossAmount: true },
      }),
    ]);

  let openingBalancePence = 0;
  let unmatchedBank = 0;
  const movements = accounts.flatMap((account) => {
    openingBalancePence += toPence(account.openingBalance);
    return account.transactions.map((transaction) => {
      if (transaction.reconciliationStatus === RECONCILIATION_STATUS.UNMATCHED) {
        unmatchedBank += 1;
      }
      return {
        occurredOn: dateToIso(transaction.occurredOn),
        direction: transaction.direction,
        amountPence: toPence(transaction.amount),
        status: asReconciliation(transaction.reconciliationStatus),
        payoutPlatform: transaction.payout ? asPlatform(transaction.payout.platform) : null,
      };
    });
  });

  const receivables: Array<{ dueOn: string; balancePence: number }> = [];
  const funnel = { draft: 0, issued: 0, partial: 0, paid: 0, overdue: 0 };
  let outstandingPence = 0;
  let overdueInvoiceCount = 0;
  for (const invoice of invoices) {
    if (invoice.status === INVOICE_STATUS.VOID) {
      continue;
    }
    const total = toPence(invoice.grossAmount);
    const paidRaw = invoice.payments.reduce((totalPaid, payment) => totalPaid + toPence(payment.amount), 0);
    const collected = collectedPence(total, paidRaw);
    outstandingPence += collected.balance;
    const status = invoiceCollectionStatus({
      totalPence: total,
      paidPence: collected.paid,
      dueOn: dateToIso(invoice.dueDate),
      today,
      isVoid: false,
      isDraft: invoice.status === INVOICE_STATUS.DRAFT,
    });
    if (status === INVOICE_STATUS.OVERDUE) {
      overdueInvoiceCount += 1;
      funnel.overdue += 1;
    } else if (status === INVOICE_STATUS.DRAFT) {
      funnel.draft += 1;
    } else if (status === INVOICE_STATUS.PARTIALLY_PAID) {
      funnel.partial += 1;
    } else if (status === INVOICE_STATUS.PAID) {
      funnel.paid += 1;
    } else {
      funnel.issued += 1;
    }
    if (status !== INVOICE_STATUS.DRAFT && status !== INVOICE_STATUS.PAID && collected.balance > 0) {
      receivables.push({ dueOn: dateToIso(invoice.dueDate), balancePence: collected.balance });
    }
  }

  const payables: Array<{ dueOn: string; balancePence: number }> = [];
  let supplierBillsDue = 0;
  for (const bill of bills) {
    const total = toPence(bill.grossAmount);
    const paidRaw = bill.payments.reduce((totalPaid, payment) => totalPaid + toPence(payment.amount), 0);
    const collected = collectedPence(total, paidRaw);
    const status = supplierBillStatus({
      totalPence: total,
      paidPence: collected.paid,
      dueOn: dateToIso(bill.dueDate),
      today,
      isVoid: bill.status === SUPPLIER_BILL_STATUS.VOID,
      isDraft: bill.status === SUPPLIER_BILL_STATUS.DRAFT,
      isDisputed: bill.status === SUPPLIER_BILL_STATUS.DISPUTED,
    });
    if (status === SUPPLIER_BILL_STATUS.DUE || status === SUPPLIER_BILL_STATUS.OVERDUE || status === SUPPLIER_BILL_STATUS.PARTIALLY_PAID) {
      supplierBillsDue += 1;
    }
    if (collected.balance > 0 && status !== SUPPLIER_BILL_STATUS.VOID && status !== SUPPLIER_BILL_STATUS.DRAFT) {
      payables.push({ dueOn: dateToIso(bill.dueDate), balancePence: collected.balance });
    }
  }

  const horizon = addDays(today, BILL_HORIZON_DAYS);
  const upcoming = recurring
    .filter((item) => {
      const due = dateToIso(item.nextDueOn);
      return due >= today && due <= horizon;
    })
    .map((item) => ({
      dateLabel: formatDisplayDate(dateToIso(item.nextDueOn)),
      name: item.name,
      amountPence: toPence(item.amount),
    }));
  const rentDue = recurring.filter((item) => item.name.toLowerCase().includes("rent") && dateToIso(item.nextDueOn) <= horizon).length;

  const unmatchedPayouts = payouts.filter((payout) => payout.reconciliationStatus === RECONCILIATION_STATUS.UNMATCHED);
  const payoutCandidates = unmatchedPayouts.map((payout) => ({ id: payout.id, amountPence: toPence(payout.amount) }));
  const usedPayouts = new Set<string>();
  let suggestedMatches = 0;
  for (const movement of movements) {
    if (movement.direction !== "CREDIT" || movement.status !== RECONCILIATION_STATUS.UNMATCHED) {
      continue;
    }
    const available = payoutCandidates.filter((candidate) => !usedPayouts.has(candidate.id));
    const match = suggestUniqueAmountMatch(movement.amountPence, available);
    if (match) {
      suggestedMatches += 1;
      usedPayouts.add(match.id);
    }
  }

  const rollingStart = addDays(today, -365);
  const rolling = buildProfitAndLoss(
    lines.filter((line) => line.occurredOn >= rollingStart),
    { start: rollingStart, endExclusive: addDays(today, 1), label: "Rolling" },
  );
  const config = activeTaxConfig(
    taxSettings.map((setting) => ({
      thresholdPence: toPence(setting.thresholdAmount),
      effectiveFrom: dateToIso(setting.effectiveFrom),
      effectiveTo: setting.effectiveTo ? dateToIso(setting.effectiveTo) : null,
    })),
    today,
  );
  const vat = config ? assessVatThreshold(Math.max(0, rolling.netRevenuePence), config.thresholdPence) : null;
  const previousMonth = trailingMonths(today, 2)[0];
  const utilityThis = lines
    .filter((line) => line.kind === LEDGER_KIND.EXPENSE && line.parentCategoryCode === PARENT_CATEGORY.UTILITIES && line.occurredOn >= month.start && line.occurredOn < month.endExclusive)
    .reduce((total, line) => total + line.amountPence, 0);
  const utilityPrevious = previousMonth
    ? lines
        .filter((line) => line.kind === LEDGER_KIND.EXPENSE && line.parentCategoryCode === PARENT_CATEGORY.UTILITIES && line.occurredOn >= previousMonth.start && line.occurredOn < previousMonth.endExclusive)
        .reduce((total, line) => total + line.amountPence, 0)
    : 0;

  const alerts = buildAlerts({
    today,
    overdueInvoices: overdueInvoiceCount,
    supplierBillsDue,
    rentDue,
    unmatchedBankTransactions: unmatchedBank,
    unmatchedPayouts: unmatchedPayouts.length,
    vatWarning: vat?.warning ?? "NONE",
    certificateExpiries: documents
      .filter((document) => document.kind === "COMPLIANCE_CERTIFICATE" && document.expiresOn)
      .map((document) => ({
        name: document.title,
        propertyName: document.property?.name ?? "Company",
        expiresOn: dateToIso(document.expiresOn ?? new Date()),
      })),
    leaseEnds: contracts.map((contract) => ({
      propertyName: contract.property.name,
      endsOn: dateToIso(contract.leaseEnd),
    })),
    renewals: recurring
      .filter((item) => item.renewalOn)
      .map((item) => ({ name: item.name, renewsOn: dateToIso(item.renewalOn ?? item.nextDueOn) })),
    insuranceExpiries: documents
      .filter((document) => document.kind === "INSURANCE" && document.expiresOn)
      .map((document) => ({ name: document.title, expiresOn: dateToIso(document.expiresOn ?? new Date()) })),
    utilityThisMonthPence: utilityThis,
    utilityPreviousMonthPence: utilityPrevious,
  });

  const supplierIds = supplierGroups.flatMap((row) => (row.supplierId ? [row.supplierId] : []));
  const supplierNames = await prisma.supplier.findMany({
    where: { ...scope, id: { in: supplierIds } },
    select: { id: true, name: true },
  });
  const supplierName = new Map(supplierNames.map((supplier) => [supplier.id, supplier.name]));

  return assembleDashboard({
    companyName: company.tradingName,
    today,
    range: query.range,
    basis: query.basis,
    customStart: query.from,
    customEnd: query.to,
    financialYearStartMonth: company.financialYearStartMonth,
    financialYearStartDay: company.financialYearStartDay,
    lines,
    bookings: bookings.map((booking) => ({
      propertyId: booking.propertyId,
      propertyName: booking.property.name,
      platform: asPlatform(booking.platform),
      checkIn: dateToIso(booking.checkInDate),
      checkOut: dateToIso(booking.checkOutDate),
      nights: booking.numberOfNights,
      guest: booking.customer.name,
      accommodationPence: toPence(booking.accommodationRevenue),
      cleaningPence: toPence(booking.cleaningRevenue),
      extraGuestPence: toPence(booking.extraGuestRevenue),
      parkingPence: toPence(booking.parkingRevenue),
      otherPence: toPence(booking.otherRevenue),
      grossPence: toPence(booking.grossRevenue),
      commissionPence: toPence(booking.platformCommission),
      processingPence: toPence(booking.paymentProcessingFee),
    })),
    properties: properties.map((property) => ({ id: property.id, name: property.name })),
    accountCount: accounts.length,
    openingBalancePence,
    movements,
    receivables,
    payables,
    outstandingPence,
    overdueInvoiceCount,
    funnel,
    payouts: payouts.map((payout) => ({
      id: payout.id,
      platform: asPlatform(payout.platform),
      reference: payout.reference,
      amountPence: toPence(payout.amount),
      allocatedPence: payout.allocations.reduce((total, allocation) => total + toPence(allocation.amount), 0),
      paidOn: dateToIso(payout.paidOn),
    })),
    suggestedMatches,
    upcoming,
    suppliers: supplierGroups.flatMap((row) => {
      if (!row.supplierId) {
        return [];
      }
      return [{ id: row.supplierId, name: supplierName.get(row.supplierId) ?? "Supplier", amountPence: toPence(row._sum.grossAmount) }];
    }),
    documents: documents.map((document) => ({
      propertyId: document.propertyId,
      kind: document.kind,
      expiresOn: document.expiresOn ? dateToIso(document.expiresOn) : null,
    })),
    alerts,
    vat,
  });
}
