import {
  BILL_HORIZON_DAYS,
  COST_BEHAVIOUR,
  FULL_BUSINESS_USE_BPS,
  INVOICE_STATUS,
  LEDGER_KIND,
  PARENT_CATEGORY,
  SUPPLIER_BILL_STATUS,
  TAX_CLASSIFICATION,
} from "@/domain/constants";
import {
  addDays,
  calendarMonthContaining,
  companyFinancialYearContaining,
  dateToIso,
  daysInPeriod,
  formatDisplayDate,
  todayIso,
  trailingMonths,
  ukTaxYearContaining,
  type DatePeriod,
  type IsoDate,
} from "@/domain/dates";
import { postalAddressLines } from "@/domain/address";
import { buildAlerts, type AlertItem } from "@/domain/alerts";
import { calculatePropertyKpis } from "@/domain/kpis";
import { formatGbp, formatMargin } from "@/domain/money";
import { PLATFORM_LABEL, RECONCILIATION_LABEL, TAX_LABEL } from "@/domain/labels";
import { buildProfitAndLoss, linesForProperty, revenueByChannel, summariseCash, type LedgerLine, type ProfitAndLoss } from "@/domain/reports";
import { ageingBucket, invoiceCollectionStatus, outstandingBalance, supplierBillStatus } from "@/domain/invoices";
import { suggestUniqueAmountMatch } from "@/domain/reconciliation";
import { activeTaxConfig, assessVatThreshold } from "@/domain/vat";
import { bookingContributionPence } from "@/domain/accounting";
import { prisma } from "@/server/db";
import { percentToBasisPoints, toPence } from "@/server/money";
import { companyScope, type Session } from "@/server/session";

function periodDates(period: DatePeriod): { gte: Date; lt: Date } {
  return {
    gte: new Date(`${period.start}T00:00:00.000Z`),
    lt: new Date(`${period.endExclusive}T00:00:00.000Z`),
  };
}

async function loadLines(session: Session, period: DatePeriod): Promise<LedgerLine[]> {
  const scope = companyScope(session);
  const range = periodDates(period);
  const [incomes, refunds, expenses] = await Promise.all([
    prisma.income.findMany({
      where: { ...scope, serviceDate: range },
      include: { category: { include: { parent: true } } },
    }),
    prisma.refund.findMany({ where: { ...scope, refundedOn: range } }),
    prisma.expense.findMany({
      where: { ...scope, transactionDate: range },
      include: { category: { include: { parent: true } } },
    }),
  ]);

  const lines: LedgerLine[] = incomes.map((income) => ({
    kind: LEDGER_KIND.INCOME,
    propertyId: income.propertyId,
    bookingId: income.bookingId,
    categoryCode: income.category.code,
    parentCategoryCode: income.category.parent?.code ?? null,
    channel: income.channel,
    amountPence: toPence(income.grossAmount),
    taxClassification: TAX_CLASSIFICATION.ALLOWABLE,
    businessUseBps: FULL_BUSINESS_USE_BPS,
    costBehaviour: COST_BEHAVIOUR.NONE,
    occurredOn: dateToIso(income.serviceDate),
    label: income.category.name,
    groupLabel: income.category.parent?.name ?? income.category.name,
  }));

  for (const refund of refunds) {
    lines.push({
      kind: LEDGER_KIND.REFUND,
      propertyId: refund.propertyId,
      bookingId: refund.bookingId,
      categoryCode: "REFUND",
      parentCategoryCode: null,
      channel: null,
      amountPence: toPence(refund.amount),
      taxClassification: TAX_CLASSIFICATION.ALLOWABLE,
      businessUseBps: FULL_BUSINESS_USE_BPS,
      costBehaviour: COST_BEHAVIOUR.NONE,
      occurredOn: dateToIso(refund.refundedOn),
      label: "Refund",
      groupLabel: "Refund",
    });
  }

  for (const expense of expenses) {
    const parent = expense.category.parent;
    lines.push({
      kind: LEDGER_KIND.EXPENSE,
      propertyId: expense.propertyId,
      bookingId: expense.bookingId,
      categoryCode: expense.category.code,
      parentCategoryCode: parent?.code ?? null,
      channel: null,
      amountPence: toPence(expense.grossAmount),
      taxClassification: expense.isCapitalExpense ? TAX_CLASSIFICATION.CAPITAL : expense.taxClassification,
      businessUseBps: percentToBasisPoints(expense.businessPercentage),
      costBehaviour: expense.category.costBehaviour,
      occurredOn: dateToIso(expense.transactionDate),
      label: expense.category.name,
      groupLabel: parent?.name ?? expense.category.name,
    });
  }
  return lines;
}

export type DashboardModel = {
  companyName: string;
  monthLabel: string;
  revenuePence: number;
  expensesPence: number;
  profitPence: number;
  marginLabel: string;
  outstandingPence: number;
  upcomingPence: number;
  bankPence: number;
  kpis: Array<{ label: string; value: string }>;
  properties: Array<{
    id: string;
    name: string;
    revenuePence: number;
    expensesPence: number;
    profitPence: number;
    marginLabel: string;
  }>;
  upcoming: Array<{ dateLabel: string; name: string; amountPence: number }>;
  alerts: AlertItem[];
  chart: Array<{ month: string; revenue: number; expenses: number }>;
  cash: { inPence: number; outPence: number; netPence: number };
};

export async function getDashboard(session: Session): Promise<DashboardModel> {
  const scope = companyScope(session);
  const today = todayIso();
  const month = calendarMonthContaining(today);
  const months = trailingMonths(today, 6);
  const first = months[0] ?? month;
  const last = months[months.length - 1] ?? month;
  const wide: DatePeriod = { start: first.start, endExclusive: last.endExclusive, label: month.label };
  const [company, lines, properties, bookings, invoices, accounts, recurring, bills, documents, contracts, taxSettings] =
    await Promise.all([
      prisma.company.findFirstOrThrow({ where: { id: session.companyId, tenantId: session.tenantId } }),
      loadLines(session, wide),
      prisma.property.findMany({ where: scope, orderBy: { name: "asc" } }),
      prisma.booking.findMany({ where: { ...scope, checkInDate: periodDates(month) } }),
      prisma.invoice.findMany({ where: scope, include: { payments: true } }),
      prisma.bankAccount.findMany({ where: scope, include: { transactions: true } }),
      prisma.recurringExpense.findMany({ where: { ...scope, isActive: true }, orderBy: { nextDueOn: "asc" } }),
      prisma.supplierBill.findMany({ where: scope, include: { supplier: true, payments: true } }),
      prisma.document.findMany({ where: { ...scope, expiresOn: { not: null } }, include: { property: true } }),
      prisma.propertyContract.findMany({ where: scope, include: { property: true } }),
      prisma.taxSetting.findMany({ where: scope, orderBy: { effectiveFrom: "desc" } }),
    ]);

  const statement = buildProfitAndLoss(lines, month);
  const propertyRows = properties.map((property) => {
    const propertyStatement = buildProfitAndLoss(linesForProperty(lines, property.id), month);
    return {
      id: property.id,
      name: property.name,
      revenuePence: propertyStatement.grossRevenuePence,
      expensesPence: propertyStatement.operatingExpensesPence,
      profitPence: propertyStatement.operatingProfitPence,
      marginLabel: formatMargin(propertyStatement.marginBps),
    };
  });

  let opening = 0;
  let credits = 0;
  let debits = 0;
  let monthCredits = 0;
  let monthDebits = 0;
  let unmatchedBank = 0;
  for (const account of accounts) {
    opening += toPence(account.openingBalance);
    for (const transaction of account.transactions) {
      const amount = toPence(transaction.amount);
      const occurred = dateToIso(transaction.occurredOn);
      if (transaction.direction === "CREDIT") {
        credits += amount;
        if (occurred >= month.start && occurred < month.endExclusive) {
          monthCredits += amount;
        }
      } else {
        debits += amount;
        if (occurred >= month.start && occurred < month.endExclusive) {
          monthDebits += amount;
        }
      }
      if (transaction.reconciliationStatus === "UNMATCHED") {
        unmatchedBank += 1;
      }
    }
  }
  const cashPosition = summariseCash({ openingPence: opening, creditsPence: credits, debitsPence: debits });
  const monthCash = summariseCash({ openingPence: 0, creditsPence: monthCredits, debitsPence: monthDebits });

  let outstanding = 0;
  let overdueInvoices = 0;
  for (const invoice of invoices) {
    if (invoice.status === INVOICE_STATUS.VOID) {
      continue;
    }
    const paid = invoice.payments.reduce((total, payment) => total + toPence(payment.amount), 0);
    const balance = Math.max(0, toPence(invoice.grossAmount) - paid);
    outstanding += balance;
    const status = invoiceCollectionStatus({
      totalPence: toPence(invoice.grossAmount),
      paidPence: Math.min(paid, toPence(invoice.grossAmount)),
      dueOn: dateToIso(invoice.dueDate),
      today,
      isVoid: false,
      isDraft: invoice.status === INVOICE_STATUS.DRAFT,
    });
    if (status === INVOICE_STATUS.OVERDUE) {
      overdueInvoices += 1;
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
  const upcomingPence = upcoming.reduce((total, item) => total + item.amountPence, 0);

  const supplierBillsDue = bills.filter((bill) => {
    const paid = bill.payments.reduce((total, payment) => total + toPence(payment.amount), 0);
    const status = supplierBillStatus({
      totalPence: toPence(bill.grossAmount),
      paidPence: Math.min(paid, toPence(bill.grossAmount)),
      dueOn: dateToIso(bill.dueDate),
      today,
      isVoid: bill.status === SUPPLIER_BILL_STATUS.VOID,
      isDraft: bill.status === SUPPLIER_BILL_STATUS.DRAFT,
      isDisputed: bill.status === SUPPLIER_BILL_STATUS.DISPUTED,
    });
    return status === SUPPLIER_BILL_STATUS.DUE || status === SUPPLIER_BILL_STATUS.OVERDUE || status === SUPPLIER_BILL_STATUS.PARTIALLY_PAID;
  }).length;

  const rentDue = recurring.filter((item) => item.name.toLowerCase().includes("rent") && dateToIso(item.nextDueOn) <= horizon).length;
  const unmatchedPayouts = await prisma.payout.count({ where: { ...scope, reconciliationStatus: "UNMATCHED" } });

  const rollingStart = addDays(today, -365);
  const rolling = buildProfitAndLoss(lines.filter((line) => line.occurredOn >= rollingStart), {
    start: rollingStart,
    endExclusive: addDays(today, 1),
    label: "Rolling",
  });
  const config = activeTaxConfig(
    taxSettings.map((setting) => ({
      thresholdPence: toPence(setting.thresholdAmount),
      effectiveFrom: dateToIso(setting.effectiveFrom),
      effectiveTo: setting.effectiveTo ? dateToIso(setting.effectiveTo) : null,
    })),
    today,
  );
  const vat = config
    ? assessVatThreshold(Math.max(0, rolling.netRevenuePence), config.thresholdPence)
    : null;

  const utilityCodes = new Set(["UTILITIES"]);
  const utilityThis = lines
    .filter((line) => line.kind === LEDGER_KIND.EXPENSE && line.parentCategoryCode && utilityCodes.has(line.parentCategoryCode) && line.occurredOn >= month.start && line.occurredOn < month.endExclusive)
    .reduce((total, line) => total + line.amountPence, 0);
  const previous = trailingMonths(today, 2)[0];
  const utilityPrevious = previous
    ? lines
        .filter((line) => line.kind === LEDGER_KIND.EXPENSE && line.parentCategoryCode === PARENT_CATEGORY.UTILITIES && line.occurredOn >= previous.start && line.occurredOn < previous.endExclusive)
        .reduce((total, line) => total + line.amountPence, 0)
    : 0;

  const alerts = buildAlerts({
    today,
    overdueInvoices,
    supplierBillsDue,
    rentDue,
    unmatchedBankTransactions: unmatchedBank,
    unmatchedPayouts,
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

  const occupiedNights = bookings.reduce((total, booking) => total + booking.numberOfNights, 0);
  const accommodation = lines
    .filter((line) => line.kind === LEDGER_KIND.INCOME && line.parentCategoryCode === PARENT_CATEGORY.ACCOMMODATION && line.occurredOn >= month.start && line.occurredOn < month.endExclusive)
    .reduce((total, line) => total + line.amountPence, 0);
  const cleaning = lines
    .filter((line) => line.kind === LEDGER_KIND.EXPENSE && line.parentCategoryCode === PARENT_CATEGORY.CLEANING && line.occurredOn >= month.start && line.occurredOn < month.endExclusive)
    .reduce((total, line) => total + line.amountPence, 0);
  const kpis = calculatePropertyKpis({
    availableNights: properties.length * daysInPeriod(month),
    occupiedNights,
    accommodationRevenuePence: accommodation,
    grossRevenuePence: statement.grossRevenuePence,
    bookingCount: bookings.length,
    cleaningCostPence: cleaning,
    otaFeesPence: statement.otaFeesPence,
    operatingProfitPence: statement.operatingProfitPence,
  });

  const chart = months.map((item) => {
    const itemStatement = buildProfitAndLoss(lines, item);
    return {
      month: item.label.replace(` ${today.slice(0, 4)}`, ""),
      revenue: itemStatement.grossRevenuePence / 100,
      expenses: itemStatement.operatingExpensesPence / 100,
    };
  });

  return {
    companyName: company.tradingName,
    monthLabel: month.label,
    revenuePence: statement.grossRevenuePence,
    expensesPence: statement.operatingExpensesPence,
    profitPence: statement.operatingProfitPence,
    marginLabel: formatMargin(statement.marginBps),
    outstandingPence: outstanding,
    upcomingPence,
    bankPence: cashPosition.closingPence,
    kpis: [
      { label: "Occupancy", value: formatMargin(kpis.occupancyBps) },
      { label: "ADR", value: kpis.adrPence === null ? "—" : formatGbp(kpis.adrPence) },
      { label: "RevPAR", value: kpis.revparPence === null ? "—" : formatGbp(kpis.revparPence) },
      { label: "Average stay", value: kpis.averageStayNights === null ? "—" : `${kpis.averageStayNights.toFixed(1)} nights` },
      { label: "Bookings", value: String(bookings.length) },
      { label: "Average booking", value: kpis.averageBookingValuePence === null ? "—" : formatGbp(kpis.averageBookingValuePence) },
    ],
    properties: propertyRows,
    upcoming,
    alerts,
    chart,
    cash: { inPence: monthCash.cashInPence, outPence: monthCash.cashOutPence, netPence: monthCash.netPence },
  };
}

export async function listBookings(session: Session) {
  const rows = await prisma.booking.findMany({
    where: companyScope(session),
    include: { property: true, customer: true },
    orderBy: { checkInDate: "desc" },
    take: 200,
  });
  return rows.map((booking) => ({
    id: booking.id,
    reference: booking.reference,
    platform: PLATFORM_LABEL[booking.platform],
    externalBookingId: booking.externalBookingId,
    property: booking.property.name,
    guest: booking.customer.name,
    stay: `${formatDisplayDate(dateToIso(booking.checkInDate))} – ${formatDisplayDate(dateToIso(booking.checkOutDate))}`,
    nights: booking.numberOfNights,
    grossPence: toPence(booking.grossRevenue),
    feePence: toPence(booking.platformCommission) + toPence(booking.paymentProcessingFee),
    payoutPence: toPence(booking.netPayout),
    status: RECONCILIATION_LABEL[booking.reconciliationStatus],
  }));
}

export async function getBooking(session: Session, id: string) {
  const booking = await prisma.booking.findFirst({
    where: { id, ...companyScope(session) },
    include: {
      property: true,
      customer: true,
      incomes: { include: { category: true } },
      expenses: { include: { category: { include: { parent: true } } } },
      refundsRel: true,
      deposits: true,
      payoutLinks: { include: { payout: true } },
    },
  });
  if (!booking) {
    return null;
  }
  const directCosts = booking.expenses
    .filter((expense) => expense.category.parent?.code !== PARENT_CATEGORY.PLATFORM_FEES && expense.category.costBehaviour === COST_BEHAVIOUR.VARIABLE)
    .reduce((total, expense) => total + toPence(expense.grossAmount), 0);
  const contribution = bookingContributionPence({
    grossRevenuePence: toPence(booking.grossRevenue),
    platformCostsPence: toPence(booking.platformCommission) + toPence(booking.paymentProcessingFee),
    refundsPence: toPence(booking.refunds),
    directCostsPence: directCosts,
  });
  return {
    id: booking.id,
    reference: booking.reference,
    platform: PLATFORM_LABEL[booking.platform],
    externalBookingId: booking.externalBookingId,
    property: booking.property.name,
    guest: booking.customer.name,
    checkIn: formatDisplayDate(dateToIso(booking.checkInDate)),
    checkOut: formatDisplayDate(dateToIso(booking.checkOutDate)),
    nights: booking.numberOfNights,
    guests: booking.numberOfGuests,
    accommodationPence: toPence(booking.accommodationRevenue),
    cleaningPence: toPence(booking.cleaningRevenue),
    extraPence: toPence(booking.extraGuestRevenue),
    parkingPence: toPence(booking.parkingRevenue),
    otherPence: toPence(booking.otherRevenue),
    grossPence: toPence(booking.grossRevenue),
    commissionPence: toPence(booking.platformCommission),
    processingPence: toPence(booking.paymentProcessingFee),
    refundPence: toPence(booking.refunds),
    adjustmentPence: toPence(booking.adjustments),
    payoutPence: toPence(booking.netPayout),
    contributionPence: contribution,
    directCostsPence: directCosts,
    reconciliation: RECONCILIATION_LABEL[booking.reconciliationStatus],
    incomes: booking.incomes.map((income) => ({ label: income.category.name, amountPence: toPence(income.grossAmount) })),
    expenses: booking.expenses.map((expense) => ({ label: expense.category.name, amountPence: toPence(expense.grossAmount) })),
    deposits: booking.deposits.map((deposit) => ({
      status: deposit.status,
      amountPence: toPence(deposit.amount),
      retainedPence: toPence(deposit.retained),
    })),
  };
}

export async function listIncome(session: Session) {
  const rows = await prisma.income.findMany({
    where: companyScope(session),
    include: { category: true, property: true, customer: true, booking: true },
    orderBy: { serviceDate: "desc" },
    take: 300,
  });
  return rows.map((income) => ({
    id: income.id,
    date: formatDisplayDate(dateToIso(income.serviceDate)),
    category: income.category.name,
    property: income.property?.name ?? "Company",
    guest: income.customer?.name ?? "—",
    booking: income.booking?.reference ?? "—",
    channel: income.channel ? PLATFORM_LABEL[income.channel] : "—",
    grossPence: toPence(income.grossAmount),
    vatPence: toPence(income.vatAmount),
    netPence: toPence(income.netAmount),
  }));
}

export async function listExpenses(session: Session) {
  const rows = await prisma.expense.findMany({
    where: companyScope(session),
    include: { category: { include: { parent: true } }, property: true, supplier: true },
    orderBy: { transactionDate: "desc" },
    take: 300,
  });
  return rows.map((expense) => ({
    id: expense.id,
    reference: expense.reference,
    date: formatDisplayDate(dateToIso(expense.transactionDate)),
    supplier: expense.supplier?.name ?? "—",
    property: expense.property?.name ?? "Company",
    category: expense.category.parent?.name ?? expense.category.name,
    detail: expense.description,
    grossPence: toPence(expense.grossAmount),
    vatPence: toPence(expense.vatAmount),
    tax: TAX_LABEL[expense.taxClassification],
  }));
}

export async function expenseFormOptions(session: Session) {
  const scope = companyScope(session);
  const [properties, suppliers, categories, bookings] = await Promise.all([
    prisma.property.findMany({ where: scope, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: scope, orderBy: { name: "asc" } }),
    prisma.expenseCategory.findMany({ where: { ...scope, parentId: { not: null } }, include: { parent: true }, orderBy: { name: "asc" } }),
    prisma.booking.findMany({ where: scope, orderBy: { checkInDate: "desc" }, take: 50, include: { customer: true } }),
  ]);
  return {
    properties: properties.map((property) => ({ id: property.id, name: property.name })),
    suppliers: suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name })),
    categories: categories.map((category) => ({
      id: category.id,
      name: `${category.parent?.name ?? "Expense"} · ${category.name}`,
    })),
    bookings: bookings.map((booking) => ({ id: booking.id, name: `${booking.reference} · ${booking.customer.name}` })),
  };
}

export async function bookingFormOptions(session: Session) {
  const scope = companyScope(session);
  const [properties, customers] = await Promise.all([
    prisma.property.findMany({ where: scope, orderBy: { name: "asc" } }),
    prisma.customer.findMany({ where: scope, orderBy: { name: "asc" } }),
  ]);
  return {
    properties: properties.map((property) => ({ id: property.id, name: property.name })),
    customers: customers.map((customer) => ({ id: customer.id, name: customer.name })),
  };
}

export async function listInvoices(session: Session) {
  const today = todayIso();
  const rows = await prisma.invoice.findMany({
    where: companyScope(session),
    include: { customer: true, payments: true },
    orderBy: { issueDate: "desc" },
  });
  return rows.map((invoice) => {
    const total = toPence(invoice.grossAmount);
    const paid = invoice.payments.reduce((sum, payment) => sum + toPence(payment.amount), 0);
    const safePaid = Math.min(paid, total);
    const status = invoiceCollectionStatus({
      totalPence: total,
      paidPence: safePaid,
      dueOn: dateToIso(invoice.dueDate),
      today,
      isVoid: invoice.status === "VOID",
      isDraft: invoice.status === "DRAFT",
    });
    return {
      id: invoice.id,
      number: invoice.number,
      customer: invoice.customer.name,
      issued: formatDisplayDate(dateToIso(invoice.issueDate)),
      due: formatDisplayDate(dateToIso(invoice.dueDate)),
      totalPence: total,
      balancePence: total - safePaid,
      status,
    };
  });
}

export async function getInvoice(session: Session, id: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, ...companyScope(session) },
    include: { customer: true, items: true, payments: true, company: true },
  });
  if (!invoice) {
    return null;
  }
  const today = todayIso();
  const total = toPence(invoice.grossAmount);
  const paid = invoice.payments.reduce((sum, payment) => sum + toPence(payment.amount), 0);
  const safePaid = Math.min(paid, total);
  return {
    id: invoice.id,
    number: invoice.number,
    company: invoice.company.legalName,
    tradingName: invoice.company.tradingName,
    addressLines: postalAddressLines({
      line1: invoice.company.addressLine1,
      line2: invoice.company.addressLine2,
      line3: invoice.company.addressLine3,
      city: invoice.company.city,
      postcode: invoice.company.postcode,
    }),
    companyNumber: invoice.company.companyNumber,
    email: invoice.company.email,
    phone: invoice.company.phone,
    vatNumber: invoice.company.vatNumber,
    vatRegistered: invoice.company.vatRegistered,
    customer: invoice.customer.name,
    customerEmail: invoice.customer.email,
    issued: formatDisplayDate(dateToIso(invoice.issueDate)),
    due: formatDisplayDate(dateToIso(invoice.dueDate)),
    issueIso: dateToIso(invoice.issueDate),
    dueIso: dateToIso(invoice.dueDate),
    notes: invoice.notes,
    netPence: toPence(invoice.netAmount),
    vatPence: toPence(invoice.vatAmount),
    totalPence: total,
    paidPence: safePaid,
    balancePence: outstandingBalance(total, safePaid),
    status: invoiceCollectionStatus({
      totalPence: total,
      paidPence: safePaid,
      dueOn: dateToIso(invoice.dueDate),
      today,
      isVoid: invoice.status === "VOID",
      isDraft: invoice.status === "DRAFT",
    }),
    items: invoice.items.map((item) => ({
      description: item.description,
      netPence: toPence(item.netAmount),
      vatPence: toPence(item.vatAmount),
      grossPence: toPence(item.grossAmount),
    })),
    payments: invoice.payments.map((payment) => ({
      reference: payment.reference,
      date: formatDisplayDate(dateToIso(payment.paidOn)),
      amountPence: toPence(payment.amount),
    })),
  };
}

export async function listPayments(session: Session) {
  const rows = await prisma.payment.findMany({
    where: companyScope(session),
    include: { invoice: true, supplierBill: true, expense: true },
    orderBy: { paidOn: "desc" },
    take: 200,
  });
  return rows.map((payment) => ({
    id: payment.id,
    date: formatDisplayDate(dateToIso(payment.paidOn)),
    reference: payment.reference,
    direction: payment.direction === "RECEIVED" ? "Received" : "Made",
    method: payment.method,
    amountPence: toPence(payment.amount),
    against: payment.invoice?.number ?? payment.supplierBill?.number ?? payment.expense?.reference ?? "—",
  }));
}

export async function listProperties(session: Session) {
  const today = todayIso();
  const month = calendarMonthContaining(today);
  const lines = await loadLines(session, month);
  const properties = await prisma.property.findMany({
    where: companyScope(session),
    orderBy: { name: "asc" },
  });
  return properties.map((property) => {
    const statement = buildProfitAndLoss(linesForProperty(lines, property.id), month);
    return {
      id: property.id,
      name: property.name,
      address: `${property.address}, ${property.city} ${property.postcode}`,
      bedrooms: property.bedrooms,
      revenuePence: statement.grossRevenuePence,
      profitPence: statement.operatingProfitPence,
      marginLabel: formatMargin(statement.marginBps),
    };
  });
}

export async function getPropertyReport(session: Session, id: string) {
  const property = await prisma.property.findFirst({ where: { id, ...companyScope(session) } });
  if (!property) {
    return null;
  }
  const today = todayIso();
  const month = calendarMonthContaining(today);
  const lines = await loadLines(session, month);
  const statement = buildProfitAndLoss(linesForProperty(lines, property.id), month);
  const bookings = await prisma.booking.findMany({
    where: { ...companyScope(session), propertyId: property.id, checkInDate: periodDates(month) },
  });
  const budgets = await prisma.budget.findMany({
    where: { ...companyScope(session), propertyId: property.id, periodStart: periodDates(month).gte },
  });
  const occupied = bookings.reduce((total, booking) => total + booking.numberOfNights, 0);
  const accommodation = linesForProperty(lines, property.id)
    .filter((line) => line.kind === LEDGER_KIND.INCOME && line.parentCategoryCode === PARENT_CATEGORY.ACCOMMODATION)
    .reduce((total, line) => total + line.amountPence, 0);
  const kpis = calculatePropertyKpis({
    availableNights: daysInPeriod(month),
    occupiedNights: occupied,
    accommodationRevenuePence: accommodation,
    grossRevenuePence: statement.grossRevenuePence,
    bookingCount: bookings.length,
    cleaningCostPence: statement.expenseByCategory.find((row) => row.code === PARENT_CATEGORY.CLEANING)?.amountPence ?? 0,
    otaFeesPence: statement.otaFeesPence,
    operatingProfitPence: statement.operatingProfitPence,
  });
  return {
    name: property.name,
    address: `${property.address}, ${property.city}`,
    monthLabel: month.label,
    statement,
    kpis,
    budgets: budgets.map((budget) => ({ label: budget.label, amountPence: toPence(budget.amount) })),
    actualRevenuePence: statement.grossRevenuePence,
  };
}

export async function listParties(session: Session, kind: "customers" | "suppliers") {
  if (kind === "customers") {
    const rows = await prisma.customer.findMany({ where: companyScope(session), orderBy: { name: "asc" } });
    return rows.map((row) => ({ id: row.id, name: row.name, detail: row.email ?? row.companyName ?? "Guest", extra: row.phone ?? "" }));
  }
  const rows = await prisma.supplier.findMany({ where: companyScope(session), orderBy: { name: "asc" } });
  return rows.map((row) => ({ id: row.id, name: row.name, detail: row.category, extra: row.vatNumber ?? row.email ?? "" }));
}

export async function getBanking(session: Session) {
  const accounts = await prisma.bankAccount.findMany({
    where: companyScope(session),
    include: { transactions: { orderBy: { occurredOn: "desc" } } },
  });
  return accounts.map((account) => {
    let movement = 0;
    for (const transaction of account.transactions) {
      const amount = toPence(transaction.amount);
      movement += transaction.direction === "CREDIT" ? amount : -amount;
    }
    return {
      id: account.id,
      bankName: account.bankName,
      accountName: account.accountName,
      masked: `•••• ${account.accountNumberLast4}`,
      balancePence: toPence(account.openingBalance) + movement,
      transactions: account.transactions.map((transaction) => ({
        id: transaction.id,
        date: formatDisplayDate(dateToIso(transaction.occurredOn)),
        description: transaction.description,
        direction: transaction.direction,
        amountPence: toPence(transaction.amount),
        status: RECONCILIATION_LABEL[transaction.reconciliationStatus],
        reference: transaction.reference ?? "",
      })),
    };
  });
}

export async function getReconciliation(session: Session) {
  const scope = companyScope(session);
  const [transactions, payouts] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: { ...scope, direction: "CREDIT", reconciliationStatus: "UNMATCHED" },
      orderBy: { occurredOn: "desc" },
    }),
    prisma.payout.findMany({
      where: { ...scope, reconciliationStatus: "UNMATCHED" },
      include: { allocations: { include: { booking: true } } },
      orderBy: { paidOn: "desc" },
    }),
  ]);
  const candidates = payouts.map((payout) => ({ id: payout.id, amountPence: toPence(payout.amount) }));
  return {
    rows: transactions.map((transaction) => {
      const suggestion = suggestUniqueAmountMatch(toPence(transaction.amount), candidates);
      const payout = payouts.find((item) => item.id === suggestion?.id) ?? null;
      return {
        transactionId: transaction.id,
        date: formatDisplayDate(dateToIso(transaction.occurredOn)),
        description: transaction.description,
        amountPence: toPence(transaction.amount),
        payoutId: payout?.id ?? null,
        payoutReference: payout?.reference ?? null,
        allocations: payout
          ? payout.allocations.map((allocation) => ({
              booking: allocation.booking.reference,
              amountPence: toPence(allocation.amount),
            }))
          : [],
      };
    }),
    unmatchedPayouts: payouts.map((payout) => ({
      id: payout.id,
      reference: payout.reference,
      date: formatDisplayDate(dateToIso(payout.paidOn)),
      amountPence: toPence(payout.amount),
      platform: PLATFORM_LABEL[payout.platform],
      allocations: payout.allocations.map((allocation) => ({
        booking: allocation.booking.reference,
        amountPence: toPence(allocation.amount),
      })),
    })),
  };
}

export async function listDocuments(session: Session) {
  const rows = await prisma.document.findMany({
    where: companyScope(session),
    include: { property: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((document) => ({
    id: document.id,
    title: document.title,
    kind: document.kind,
    property: document.property?.name ?? "Company",
    expires: document.expiresOn ? formatDisplayDate(dateToIso(document.expiresOn)) : "—",
  }));
}

export async function getReports(session: Session, basis: "month" | "tax" | "financial") {
  const company = await prisma.company.findFirstOrThrow({
    where: { id: session.companyId, tenantId: session.tenantId },
  });
  const today = todayIso();
  const period =
    basis === "tax"
      ? ukTaxYearContaining(today)
      : basis === "financial"
        ? companyFinancialYearContaining(today, company.financialYearStartMonth, company.financialYearStartDay)
        : calendarMonthContaining(today);
  const lines = await loadLines(session, period);
  const statement = buildProfitAndLoss(lines, period);
  const bookings = await prisma.booking.findMany({ where: { ...scopeWhere(session), checkInDate: periodDates(period) } });
  const channels = revenueByChannel(
    bookings.map((booking) => ({
      channel: PLATFORM_LABEL[booking.platform],
      grossRevenuePence: toPence(booking.grossRevenue),
      platformCostsPence: toPence(booking.platformCommission) + toPence(booking.paymentProcessingFee),
    })),
  );
  const properties = await prisma.property.findMany({ where: companyScope(session) });
  const accounts = await prisma.bankAccount.findMany({
    where: companyScope(session),
    include: { transactions: true },
  });
  let opening = 0;
  let credits = 0;
  let debits = 0;
  for (const account of accounts) {
    opening += toPence(account.openingBalance);
    for (const transaction of account.transactions) {
      const occurred = dateToIso(transaction.occurredOn);
      if (occurred < period.start || occurred >= period.endExclusive) {
        if (occurred < period.start) {
          opening += transaction.direction === "CREDIT" ? toPence(transaction.amount) : -toPence(transaction.amount);
        }
        continue;
      }
      if (transaction.direction === "CREDIT") {
        credits += toPence(transaction.amount);
      } else {
        debits += toPence(transaction.amount);
      }
    }
  }
  return {
    label: period.label,
    statement,
    channels,
    properties: properties.map((property) => {
      const propertyStatement = buildProfitAndLoss(linesForProperty(lines, property.id), period);
      return { name: property.name, profitPence: propertyStatement.operatingProfitPence, revenuePence: propertyStatement.grossRevenuePence };
    }),
    cash: summariseCash({ openingPence: opening, creditsPence: credits, debitsPence: debits }),
  };
}

function scopeWhere(session: Session) {
  return companyScope(session);
}

export async function getTax(session: Session) {
  const today = todayIso();
  const company = await prisma.company.findFirstOrThrow({ where: { id: session.companyId, tenantId: session.tenantId } });
  const settings = await prisma.taxSetting.findMany({ where: companyScope(session), orderBy: { effectiveFrom: "desc" } });
  const rates = await prisma.vatRate.findMany({ where: companyScope(session), orderBy: { effectiveFrom: "desc" } });
  const rollingPeriod: DatePeriod = { start: addDays(today, -365), endExclusive: addDays(today, 1), label: "Rolling 12 months" };
  const lines = await loadLines(session, rollingPeriod);
  const statement = buildProfitAndLoss(lines, rollingPeriod);
  const configs = settings.map((setting) => ({
    id: setting.id,
    name: setting.name,
    thresholdPence: toPence(setting.thresholdAmount),
    effectiveFrom: dateToIso(setting.effectiveFrom),
    effectiveTo: setting.effectiveTo ? dateToIso(setting.effectiveTo) : null,
    scheme: setting.scheme,
    period: setting.period,
  }));
  const active = activeTaxConfig(configs, today);
  const assessment = active ? assessVatThreshold(Math.max(0, statement.netRevenuePence), active.thresholdPence) : null;
  return {
    vatRegistered: company.vatRegistered,
    vatNumber: company.vatNumber,
    retentionYears: company.documentRetentionYears,
    financialYearLabel: companyFinancialYearContaining(today, company.financialYearStartMonth, company.financialYearStartDay).label,
    taxYearLabel: ukTaxYearContaining(today).label,
    configs,
    active,
    assessment,
    rates: rates.map((rate) => ({ name: rate.name, treatment: rate.treatment, rateBps: rate.rateBps })),
    deductiblePence: statement.deductibleExpensesPence,
    disallowablePence: statement.disallowablePence,
    pendingPence: statement.pendingReviewPence,
    capitalPence: statement.capitalExpenditurePence,
    financePence: statement.financeCostsPence,
  };
}

export async function getSettings(session: Session) {
  const company = await prisma.company.findFirstOrThrow({ where: { id: session.companyId, tenantId: session.tenantId } });
  const users = await prisma.user.findMany({ where: companyScope(session), orderBy: { name: "asc" } });
  const audit = await prisma.auditLog.findMany({
    where: companyScope(session),
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  return {
    legalName: company.legalName,
    tradingName: company.tradingName,
    companyNumber: company.companyNumber,
    email: company.email,
    phone: company.phone ?? "",
    address: postalAddressLines({
      line1: company.addressLine1,
      line2: company.addressLine2,
      line3: company.addressLine3,
      city: company.city,
      postcode: company.postcode,
    }).join(", "),
    vatRegistered: company.vatRegistered,
    retentionYears: company.documentRetentionYears,
    yearStartMonth: company.financialYearStartMonth,
    yearStartDay: company.financialYearStartDay,
    users: users.map((user) => ({ name: user.name, email: user.email, role: user.role })),
    audit: audit.map((entry) => ({
      when: new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(entry.createdAt),
      actor: entry.actorName,
      summary: entry.summary,
    })),
  };
}

export async function searchLedger(session: Session, query: string) {
  const term = query.trim();
  const scope = companyScope(session);
  const contains = { contains: term, mode: "insensitive" as const };
  const [suppliers, customers, properties, invoices, bookings, expenses, documents, payments] = await Promise.all([
    prisma.supplier.findMany({ where: { ...scope, name: contains }, take: 10 }),
    prisma.customer.findMany({ where: { ...scope, name: contains }, take: 10 }),
    prisma.property.findMany({ where: { ...scope, name: contains }, take: 10 }),
    prisma.invoice.findMany({ where: { ...scope, number: contains }, take: 10 }),
    prisma.booking.findMany({ where: { ...scope, OR: [{ reference: contains }, { externalBookingId: contains }] }, take: 10 }),
    prisma.expense.findMany({ where: { ...scope, OR: [{ description: contains }, { reference: contains }, { supplier: { name: contains } }] }, take: 10 }),
    prisma.document.findMany({ where: { ...scope, title: contains }, take: 10 }),
    prisma.payment.findMany({ where: { ...scope, reference: contains }, take: 10 }),
  ]);
  return [
    { label: "Suppliers", count: suppliers.length, items: suppliers.map((row) => row.name) },
    { label: "Customers", count: customers.length, items: customers.map((row) => row.name) },
    { label: "Properties", count: properties.length, items: properties.map((row) => row.name) },
    { label: "Invoices", count: invoices.length, items: invoices.map((row) => row.number) },
    { label: "Bookings", count: bookings.length, items: bookings.map((row) => row.reference) },
    { label: "Expenses", count: expenses.length, items: expenses.map((row) => row.description) },
    { label: "Documents", count: documents.length, items: documents.map((row) => row.title) },
    { label: "Payments", count: payments.length, items: payments.map((row) => row.reference) },
  ].filter((group) => group.count > 0);
}

export async function ageingSummary(session: Session) {
  const today = todayIso();
  const invoices = await prisma.invoice.findMany({ where: companyScope(session), include: { payments: true } });
  const buckets = { current: 0, days1to30: 0, days31to60: 0, days61plus: 0 };
  for (const invoice of invoices) {
    if (invoice.status === "VOID") {
      continue;
    }
    const total = toPence(invoice.grossAmount);
    const paid = Math.min(total, invoice.payments.reduce((sum, payment) => sum + toPence(payment.amount), 0));
    const balance = total - paid;
    const bucket = ageingBucket(dateToIso(invoice.dueDate), today, balance);
    if (bucket) {
      buckets[bucket] += balance;
    }
  }
  return buckets;
}

export type StatementModel = ProfitAndLoss;

export async function exportRows(session: Session, kind: "expenses" | "income" | "bookings"): Promise<{ headers: string[]; rows: string[][] }> {
  if (kind === "expenses") {
    const rows = await listExpenses(session);
    return {
      headers: ["Reference", "Date", "Supplier", "Property", "Category", "Description", "Gross", "VAT", "Tax"],
      rows: rows.map((row) => [row.reference, row.date, row.supplier, row.property, row.category, row.detail, formatGbp(row.grossPence), formatGbp(row.vatPence), row.tax]),
    };
  }
  if (kind === "income") {
    const rows = await listIncome(session);
    return {
      headers: ["Date", "Category", "Property", "Guest", "Booking", "Channel", "Gross", "VAT", "Net"],
      rows: rows.map((row) => [row.date, row.category, row.property, row.guest, row.booking, row.channel, formatGbp(row.grossPence), formatGbp(row.vatPence), formatGbp(row.netPence)]),
    };
  }
  const rows = await listBookings(session);
  return {
    headers: ["Reference", "Platform", "External ID", "Property", "Guest", "Stay", "Gross", "Fees", "Payout"],
    rows: rows.map((row) => [row.reference, row.platform, row.externalBookingId, row.property, row.guest, row.stay, formatGbp(row.grossPence), formatGbp(row.feePence), formatGbp(row.payoutPence)]),
  };
}

export function periodForBasis(basis: string, today: IsoDate, startMonth: number, startDay: number): DatePeriod {
  if (basis === "tax") {
    return ukTaxYearContaining(today);
  }
  if (basis === "financial") {
    return companyFinancialYearContaining(today, startMonth, startDay);
  }
  return calendarMonthContaining(today);
}
