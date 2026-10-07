import {
  ALERT_KIND,
  BOOKING_PLATFORM,
  CERTIFICATE_WARNING_DAYS,
  DOCUMENT_KIND,
  EXPENSE_CODE,
  LEDGER_KIND,
  PARENT_CATEGORY,
  RECONCILIATION_STATUS,
  TAX_CLASSIFICATION,
  UTILITY_INCREASE_BPS,
  type AlertKind,
  type BookingPlatform,
  type DocumentKind,
  type ReconciliationStatus,
} from "@/domain/constants";
import {
  addDays,
  calendarMonthContaining,
  companyFinancialYearContaining,
  dateToIso,
  daysBetween,
  daysInPeriod,
  formatDisplayDate,
  inPeriod,
  parseIsoDate,
  trailingMonths,
  ukTaxYearContaining,
  type DatePeriod,
  type IsoDate,
} from "@/domain/dates";
import { calculatePropertyKpis } from "@/domain/kpis";
import { PLATFORM_LABEL } from "@/domain/labels";
import { applyBasisPoints, DomainError, formatGbp, formatMargin, marginBasisPoints } from "@/domain/money";
import {
  buildProfitAndLoss,
  linesForProperty,
  type LedgerLine,
  type ProfitAndLoss,
} from "@/domain/reports";
import { VAT_WARNING, type VatAssessment, type VatWarning } from "@/domain/vat";

export const DASHBOARD_RANGE = {
  SEVEN_DAYS: "7d",
  THIRTY_DAYS: "30d",
  MONTH: "month",
  QUARTER: "quarter",
  TAX_YEAR: "tax",
  COMPANY_YEAR: "company",
  CUSTOM: "custom",
} as const;

export type DashboardRange = (typeof DASHBOARD_RANGE)[keyof typeof DASHBOARD_RANGE];

export const LEDGER_BASIS = {
  ACCRUAL: "accrual",
  CASH: "cash",
} as const;

export type LedgerBasis = (typeof LEDGER_BASIS)[keyof typeof LEDGER_BASIS];

export const PROPERTY_SORT = {
  REVENUE: "revenue",
  PROFIT: "profit",
  MARGIN: "margin",
  OCCUPANCY: "occupancy",
  ADR: "adr",
  REVPAN: "revpan",
} as const;

export type PropertySort = (typeof PROPERTY_SORT)[keyof typeof PROPERTY_SORT];

export const WATERFALL_KIND = {
  RESULT: "result",
  INCREASE: "increase",
  DECREASE: "decrease",
} as const;

export type WaterfallKind = (typeof WATERFALL_KIND)[keyof typeof WATERFALL_KIND];

export const AGEING_BUCKET = {
  CURRENT: "current",
  DAYS_1_30: "days1to30",
  DAYS_31_60: "days31to60",
  DAYS_61_90: "days61to90",
  DAYS_90_PLUS: "days90plus",
} as const;

export type AgeingBucket = (typeof AGEING_BUCKET)[keyof typeof AGEING_BUCKET];

export const KPI_ID = {
  REVENUE: "revenue",
  COSTS: "costs",
  PROFIT: "profit",
  MARGIN: "margin",
  BANK: "bank",
  OUTSTANDING: "outstanding",
  UPCOMING: "upcoming",
  OCCUPANCY: "occupancy",
  ADR: "adr",
  REVPAN: "revpan",
} as const;

export const TONE = {
  POSITIVE: "positive",
  NEGATIVE: "negative",
  NEUTRAL: "neutral",
  WARNING: "warning",
} as const;

export type Tone = (typeof TONE)[keyof typeof TONE];

export const ACTION_GROUP = {
  CRITICAL: "critical",
  FINANCE: "finance",
  PROPERTY: "property",
  COST: "cost",
  TAX: "tax",
} as const;

const MAX_CUSTOM_DAYS = 731;
const HEATMAP_DAY_LIMIT = 35;
const HEATMAP_RECENT_DAYS = 28;
const CALENDAR_DAYS = 14;
const COMPARISON_LIMIT = 4;
const SUPPLIER_LIMIT = 5;
const PAYOUT_LIMIT = 5;
const ANOMALY_LIMIT = 4;
const STAY_PROPERTY_LIMIT = 8;
const CLEANING_ALERT_BPS = 1_000;
const THREE_MONTH_BASELINE = 3;

const PAYMENT_FEE_CODE = new Set<string>([
  EXPENSE_CODE.PAYMENT_PROCESSING,
  "STRIPE_FEE",
  "PAYPAL_FEE",
  "BOOKING_COM_PAYMENT_FEE",
]);

const OTA_PLATFORM = new Set<string>([
  BOOKING_PLATFORM.AIRBNB,
  BOOKING_PLATFORM.BOOKING_COM,
  BOOKING_PLATFORM.VRBO,
  BOOKING_PLATFORM.EXPEDIA,
  BOOKING_PLATFORM.HOTELS_COM,
  BOOKING_PLATFORM.AGODA,
  BOOKING_PLATFORM.TRAVEL_AGENT,
]);

const REQUIRED_DOCUMENT = [
  DOCUMENT_KIND.LEASE,
  DOCUMENT_KIND.INSURANCE,
  DOCUMENT_KIND.COMPLIANCE_CERTIFICATE,
] as const;

const UTILITY_LEAF = new Set<string>([EXPENSE_CODE.ELECTRICITY, EXPENSE_CODE.GAS, EXPENSE_CODE.WATER]);

const RANGE_LABEL: Record<DashboardRange, string> = {
  [DASHBOARD_RANGE.SEVEN_DAYS]: "7 days",
  [DASHBOARD_RANGE.THIRTY_DAYS]: "30 days",
  [DASHBOARD_RANGE.MONTH]: "This month",
  [DASHBOARD_RANGE.QUARTER]: "Quarter",
  [DASHBOARD_RANGE.TAX_YEAR]: "UK tax year",
  [DASHBOARD_RANGE.COMPANY_YEAR]: "Company year",
  [DASHBOARD_RANGE.CUSTOM]: "Custom",
};

export const DASHBOARD_RANGE_OPTIONS: ReadonlyArray<{ id: DashboardRange; label: string }> = [
  { id: DASHBOARD_RANGE.SEVEN_DAYS, label: RANGE_LABEL[DASHBOARD_RANGE.SEVEN_DAYS] },
  { id: DASHBOARD_RANGE.THIRTY_DAYS, label: RANGE_LABEL[DASHBOARD_RANGE.THIRTY_DAYS] },
  { id: DASHBOARD_RANGE.MONTH, label: RANGE_LABEL[DASHBOARD_RANGE.MONTH] },
  { id: DASHBOARD_RANGE.QUARTER, label: RANGE_LABEL[DASHBOARD_RANGE.QUARTER] },
  { id: DASHBOARD_RANGE.TAX_YEAR, label: RANGE_LABEL[DASHBOARD_RANGE.TAX_YEAR] },
  { id: DASHBOARD_RANGE.COMPANY_YEAR, label: RANGE_LABEL[DASHBOARD_RANGE.COMPANY_YEAR] },
];

export const LEDGER_BASIS_OPTIONS: ReadonlyArray<{ id: LedgerBasis; label: string }> = [
  { id: LEDGER_BASIS.ACCRUAL, label: "Accrual" },
  { id: LEDGER_BASIS.CASH, label: "Cash" },
];

export const PROPERTY_SORT_OPTIONS: ReadonlyArray<{ id: PropertySort; label: string }> = [
  { id: PROPERTY_SORT.PROFIT, label: "Profit" },
  { id: PROPERTY_SORT.REVENUE, label: "Revenue" },
  { id: PROPERTY_SORT.MARGIN, label: "Margin" },
  { id: PROPERTY_SORT.OCCUPANCY, label: "Occupancy" },
  { id: PROPERTY_SORT.ADR, label: "ADR" },
  { id: PROPERTY_SORT.REVPAN, label: "RevPAN" },
];

const AGEING_LABEL: Record<AgeingBucket, string> = {
  [AGEING_BUCKET.CURRENT]: "Current",
  [AGEING_BUCKET.DAYS_1_30]: "1–30 days",
  [AGEING_BUCKET.DAYS_31_60]: "31–60 days",
  [AGEING_BUCKET.DAYS_61_90]: "61–90 days",
  [AGEING_BUCKET.DAYS_90_PLUS]: "90+ days",
};

const WEEKDAY_LABEL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type DashboardBooking = {
  propertyId: string;
  propertyName: string;
  platform: BookingPlatform;
  checkIn: IsoDate;
  checkOut: IsoDate;
  nights: number;
  guest: string;
  accommodationPence: number;
  cleaningPence: number;
  extraGuestPence: number;
  parkingPence: number;
  otherPence: number;
  grossPence: number;
  commissionPence: number;
  processingPence: number;
};

export type DashboardMovement = {
  occurredOn: IsoDate;
  direction: "CREDIT" | "DEBIT";
  amountPence: number;
  status: ReconciliationStatus;
  payoutPlatform: BookingPlatform | null;
};

export type DashboardBalanceItem = {
  dueOn: IsoDate;
  balancePence: number;
};

export type DashboardPayout = {
  id: string;
  platform: BookingPlatform;
  reference: string;
  amountPence: number;
  allocatedPence: number;
  paidOn: IsoDate;
};

export type DashboardDocument = {
  propertyId: string | null;
  kind: DocumentKind;
  expiresOn: IsoDate | null;
};

export type DashboardAlert = {
  kind: AlertKind;
  title: string;
  detail: string;
};

export type DashboardInput = {
  companyName: string;
  today: IsoDate;
  range: string | undefined;
  basis: string | undefined;
  customStart?: string;
  customEnd?: string;
  financialYearStartMonth: number;
  financialYearStartDay: number;
  lines: LedgerLine[];
  bookings: DashboardBooking[];
  properties: Array<{ id: string; name: string }>;
  accountCount: number;
  openingBalancePence: number;
  movements: DashboardMovement[];
  receivables: DashboardBalanceItem[];
  payables: DashboardBalanceItem[];
  outstandingPence: number;
  overdueInvoiceCount: number;
  funnel: { draft: number; issued: number; partial: number; paid: number; overdue: number };
  payouts: DashboardPayout[];
  suggestedMatches: number;
  upcoming: Array<{ dateLabel: string; name: string; amountPence: number }>;
  suppliers: Array<{ id: string; name: string; amountPence: number }>;
  documents: DashboardDocument[];
  alerts: DashboardAlert[];
  vat: VatAssessment | null;
};

export type KpiCard = {
  id: string;
  label: string;
  value: string;
  secondary: string;
  tone: Tone;
  sparkline: number[];
  testId: string;
};

export type Insight = { id: string; title: string; body: string };

export type TrendPoint = {
  label: string;
  revenuePence: number;
  costPence: number;
  profitPence: number;
};

export type WaterfallStep = {
  key: string;
  label: string;
  amountPence: number;
  kind: WaterfallKind;
  categoryCode: string | null;
  barStartPence: number;
  barEndPence: number;
};

export type ChannelPerformance = {
  platform: string;
  label: string;
  revenuePence: number;
  bookings: number;
  nights: number;
  adrPence: number | null;
  commissionPence: number;
  feeBps: number | null;
  netPence: number;
};

export type ShareBar = {
  key: string;
  label: string;
  amountPence: number;
  shareBps: number | null;
  hrefHint: string | null;
  tone: Tone;
};

export type OtaDependency = {
  otaShareBps: number | null;
  directShareBps: number | null;
  slices: ShareBar[];
  statement: string | null;
};

export type CompositionPoint = {
  label: string;
  accommodationPence: number;
  cleaningPence: number;
  extraGuestPence: number;
  parkingPence: number;
  otherPence: number;
};

export type PropertyPerformance = {
  id: string;
  name: string;
  revenuePence: number;
  profitPence: number;
  marginBps: number | null;
  occupancyBps: number | null;
  adrPence: number | null;
  revpanPence: number | null;
};

export type ComparisonCell = {
  display: string;
  intensityBps: number;
};

export type PropertyComparison = {
  properties: Array<{ id: string; name: string }>;
  rows: Array<{ label: string; emphasize: boolean; cells: ComparisonCell[] }>;
};

export type HospitalityPoint = {
  label: string;
  occupancyBps: number | null;
  adrPence: number | null;
  revpanPence: number | null;
};

export type HeatmapDay = {
  iso: string;
  weekday: string;
  occupancyBps: number | null;
  bookings: number;
};

export type HeatmapWeek = { label: string; days: HeatmapDay[] };

export type StayDay = { iso: string; occupied: boolean; label: string | null };

export type StayRow = { propertyId: string; propertyName: string; days: StayDay[] };

export type ExpenseTrendPoint = { label: string; amounts: Record<string, number> };

export type CostAnomaly = {
  code: string;
  label: string;
  currentPence: number;
  baselinePence: number;
  changeBps: number;
  detail: string;
};

export type CleaningPerformance = {
  costPence: number;
  bookings: number;
  averagePence: number | null;
  previousAveragePence: number | null;
  varianceBps: number | null;
  byProperty: Array<{ propertyId: string; name: string; averagePence: number | null; varianceBps: number | null }>;
  alert: string | null;
};

export type CashPoint = { label: string; inPence: number; outPence: number; closingPence: number };

export type ReconciliationProgress = {
  total: number;
  matched: number;
  unmatched: number;
  suggested: number;
  needsReview: number;
  progressBps: number | null;
};

export type PayoutMatch = {
  id: string;
  label: string;
  amountPence: number;
  allocatedPence: number;
  differencePence: number;
  balanced: boolean;
};

export type FunnelStep = { key: string; label: string; count: number };

export type VatGaugeModel = {
  turnoverPence: number;
  thresholdPence: number;
  remainingPence: number;
  utilisationBps: number;
  warning: VatWarning;
  monthsToThreshold: number | null;
  narrative: string;
};

export type YearTimeline = {
  taxLabel: string;
  taxStart: string;
  taxEnd: string;
  taxProgressBps: number;
  companyLabel: string;
  companyStart: string;
  companyEnd: string;
  companyProgressBps: number;
};

export type ComplianceSummary = {
  compliantProperties: number;
  propertyCount: number;
  expiring: number;
  expired: number;
  missing: number;
  definition: string;
};

export type ActionGroupModel = {
  id: string;
  heading: string;
  items: Array<{ kind: string; title: string; detail: string; hrefPath: string }>;
};

export type DashboardView = {
  companyName: string;
  periodLabel: string;
  range: DashboardRange;
  basis: LedgerBasis;
  rangeWarning: string | null;
  basisNote: string;
  customStart: string;
  customEnd: string;
  kpis: KpiCard[];
  insights: Insight[];
  trend: TrendPoint[];
  trendTitle: string;
  waterfall: WaterfallStep[];
  channels: ChannelPerformance[];
  ota: OtaDependency;
  composition: CompositionPoint[];
  properties: PropertyPerformance[];
  matrixGuides: { occupancyBps: number; marginBps: number } | null;
  comparison: PropertyComparison | null;
  hospitality: HospitalityPoint[];
  currentRevpanPence: number | null;
  previousRevpanPence: number | null;
  heatmap: HeatmapWeek[];
  heatmapCaption: string;
  stayDates: string[];
  stays: StayRow[];
  lengthOfStay: ShareBar[];
  expenses: ShareBar[];
  expenseTrend: ExpenseTrendPoint[];
  expenseTrendKeys: string[];
  anomalies: CostAnomaly[];
  cleaning: CleaningPerformance;
  suppliers: Array<{ id: string; name: string; amountPence: number }>;
  cashSeries: CashPoint[];
  cashWaterfall: WaterfallStep[];
  obligations: Array<{ dateLabel: string; name: string; amountPence: number }>;
  obligationsTotalPence: number;
  reconciliation: ReconciliationProgress;
  payouts: PayoutMatch[];
  receivables: ShareBar[];
  payables: ShareBar[];
  invoiceFunnel: FunnelStep[];
  vat: VatGaugeModel | null;
  taxTreatment: ShareBar[];
  timeline: YearTimeline;
  compliance: ComplianceSummary;
  actions: ActionGroupModel[];
  actionCount: number;
};

const KNOWN_RANGES = new Set<string>(Object.values(DASHBOARD_RANGE));

export function resolveDashboardPeriod(input: {
  range: string | undefined;
  today: IsoDate;
  financialYearStartMonth: number;
  financialYearStartDay: number;
  customStart?: string;
  customEnd?: string;
}): { range: DashboardRange; period: DatePeriod; warning: string | null } {
  const requested = input.range && KNOWN_RANGES.has(input.range) ? (input.range as DashboardRange) : DASHBOARD_RANGE.MONTH;
  if (requested === DASHBOARD_RANGE.SEVEN_DAYS) {
    return { range: requested, warning: null, period: trailingDayPeriod(input.today, 7) };
  }
  if (requested === DASHBOARD_RANGE.THIRTY_DAYS) {
    return { range: requested, warning: null, period: trailingDayPeriod(input.today, 30) };
  }
  if (requested === DASHBOARD_RANGE.QUARTER) {
    return { range: requested, warning: null, period: calendarQuarterContaining(input.today) };
  }
  if (requested === DASHBOARD_RANGE.TAX_YEAR) {
    return { range: requested, warning: null, period: ukTaxYearContaining(input.today) };
  }
  if (requested === DASHBOARD_RANGE.COMPANY_YEAR) {
    return {
      range: requested,
      warning: null,
      period: companyFinancialYearContaining(input.today, input.financialYearStartMonth, input.financialYearStartDay),
    };
  }
  if (requested === DASHBOARD_RANGE.CUSTOM) {
    const custom = customPeriod(input.customStart, input.customEnd);
    if (!custom) {
      return {
        range: DASHBOARD_RANGE.MONTH,
        warning: "That custom range could not be used. Showing this month.",
        period: calendarMonthContaining(input.today),
      };
    }
    return { range: DASHBOARD_RANGE.CUSTOM, warning: null, period: custom };
  }
  return { range: DASHBOARD_RANGE.MONTH, warning: null, period: calendarMonthContaining(input.today) };
}

export function previousMatchingPeriod(period: DatePeriod): DatePeriod {
  const length = daysInPeriod(period);
  return {
    start: addDays(period.start, -length),
    endExclusive: period.start,
    label: "Previous period",
  };
}

export function resolveLedgerBasis(value: string | undefined): LedgerBasis {
  return value === LEDGER_BASIS.CASH ? LEDGER_BASIS.CASH : LEDGER_BASIS.ACCRUAL;
}

function trailingDayPeriod(today: IsoDate, count: number): DatePeriod {
  const endExclusive = addDays(today, 1);
  return {
    start: addDays(endExclusive, -count),
    endExclusive,
    label: `Last ${count} days`,
  };
}

function calendarQuarterContaining(isoDate: IsoDate): DatePeriod {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) {
    throw new DomainError("Invalid quarter date.");
  }
  const quarterIndex = Math.floor(parsed.getUTCMonth() / 3);
  const year = parsed.getUTCFullYear();
  return {
    start: dateToIso(new Date(Date.UTC(year, quarterIndex * 3, 1))),
    endExclusive: dateToIso(new Date(Date.UTC(year, quarterIndex * 3 + 3, 1))),
    label: `Q${quarterIndex + 1} ${year}`,
  };
}

function customPeriod(start: string | undefined, endInclusive: string | undefined): DatePeriod | null {
  if (!start || !endInclusive || !parseIsoDate(start) || !parseIsoDate(endInclusive) || endInclusive < start) {
    return null;
  }
  const endExclusive = addDays(endInclusive, 1);
  if (daysBetween(start, endExclusive) > MAX_CUSTOM_DAYS) {
    return null;
  }
  return {
    start,
    endExclusive,
    label: `${formatDisplayDate(start)} – ${formatDisplayDate(endInclusive)}`,
  };
}

function elapsedSlice(period: DatePeriod, today: IsoDate): DatePeriod {
  const tomorrow = addDays(today, 1);
  if (period.start >= tomorrow) {
    return period;
  }
  const endExclusive = period.endExclusive < tomorrow ? period.endExclusive : tomorrow;
  return { start: period.start, endExclusive, label: period.label };
}

export function occupiedNightCount(bookings: DashboardBooking[], period: DatePeriod): number {
  const seen = new Set<string>();
  for (const booking of bookings) {
    const start = booking.checkIn > period.start ? booking.checkIn : period.start;
    const end = booking.checkOut < period.endExclusive ? booking.checkOut : period.endExclusive;
    if (start >= end) {
      continue;
    }
    const span = daysBetween(start, end);
    for (let offset = 0; offset < span; offset += 1) {
      seen.add(`${booking.propertyId}|${addDays(start, offset)}`);
    }
  }
  return seen.size;
}

function accommodationInPeriod(lines: LedgerLine[], period: DatePeriod): number {
  let total = 0;
  for (const line of lines) {
    if (line.kind !== LEDGER_KIND.INCOME || !inPeriod(line.occurredOn, period.start, period.endExclusive)) {
      continue;
    }
    if (line.parentCategoryCode === PARENT_CATEGORY.ACCOMMODATION) {
      total += line.amountPence;
    }
  }
  return total;
}

function recognisedExpense(line: LedgerLine): number {
  return applyBasisPoints(line.amountPence, line.businessUseBps);
}

function isPlatformFeeLine(line: LedgerLine): boolean {
  return line.parentCategoryCode === PARENT_CATEGORY.PLATFORM_FEES || line.categoryCode === PARENT_CATEGORY.PLATFORM_FEES;
}

export function splitPlatformFees(lines: LedgerLine[], period: DatePeriod): { commissionPence: number; paymentFeesPence: number } {
  let commissionPence = 0;
  let paymentFeesPence = 0;
  for (const line of lines) {
    if (line.kind !== LEDGER_KIND.EXPENSE || !isPlatformFeeLine(line) || !inPeriod(line.occurredOn, period.start, period.endExclusive)) {
      continue;
    }
    const amount = recognisedExpense(line);
    if (PAYMENT_FEE_CODE.has(line.categoryCode)) {
      paymentFeesPence += amount;
    } else {
      commissionPence += amount;
    }
  }
  return { commissionPence, paymentFeesPence };
}

function layoutWaterfall(steps: Array<Omit<WaterfallStep, "barStartPence" | "barEndPence">>): WaterfallStep[] {
  let cursor = 0;
  return steps.map((step) => {
    if (step.kind === WATERFALL_KIND.RESULT) {
      const laid = { ...step, barStartPence: Math.min(0, step.amountPence), barEndPence: Math.max(0, step.amountPence) };
      cursor = step.amountPence;
      return laid;
    }
    const next = cursor + step.amountPence;
    const laid = {
      ...step,
      barStartPence: Math.min(cursor, next),
      barEndPence: Math.max(cursor, next),
    };
    cursor = next;
    return laid;
  });
}

export function buildProfitWaterfall(input: {
  grossPence: number;
  refundsPence: number;
  commissionPence: number;
  paymentFeesPence: number;
  categories: Array<{ code: string; label: string; amountPence: number }>;
  operatingProfitPence: number;
}): WaterfallStep[] {
  const drafts: Array<Omit<WaterfallStep, "barStartPence" | "barEndPence">> = [
    {
      key: "gross",
      label: "Gross bookings",
      amountPence: input.grossPence,
      kind: WATERFALL_KIND.RESULT,
      categoryCode: null,
    },
  ];
  pushDecrease(drafts, "commission", "OTA commission", input.commissionPence, null);
  pushDecrease(drafts, "payment-fees", "Payment fees", input.paymentFeesPence, null);
  pushDecrease(drafts, "refunds", "Refunds", input.refundsPence, null);
  const net = input.grossPence - input.refundsPence - input.commissionPence - input.paymentFeesPence;
  drafts.push({
    key: "net",
    label: "Net booking revenue",
    amountPence: net,
    kind: WATERFALL_KIND.RESULT,
    categoryCode: null,
  });
  let categoryTotal = 0;
  const categories = [...input.categories].sort((left, right) => right.amountPence - left.amountPence);
  for (const category of categories) {
    if (category.amountPence === 0 || category.code === PARENT_CATEGORY.PLATFORM_FEES) {
      continue;
    }
    categoryTotal += category.amountPence;
    pushDecrease(drafts, category.code, category.label, category.amountPence, category.code);
  }
  const expected = net - categoryTotal;
  const gap = input.operatingProfitPence - expected;
  if (gap < 0) {
    pushDecrease(drafts, "other-recognised", "Other recognised amounts", -gap, null);
  } else if (gap > 0) {
    drafts.push({
      key: "other-recognised",
      label: "Other recognised amounts",
      amountPence: gap,
      kind: WATERFALL_KIND.INCREASE,
      categoryCode: null,
    });
  }
  drafts.push({
    key: "profit",
    label: "Operating profit",
    amountPence: input.operatingProfitPence,
    kind: WATERFALL_KIND.RESULT,
    categoryCode: null,
  });
  return layoutWaterfall(drafts);
}

function pushDecrease(
  steps: Array<Omit<WaterfallStep, "barStartPence" | "barEndPence">>,
  key: string,
  label: string,
  amountPence: number,
  categoryCode: string | null,
): void {
  if (amountPence === 0) {
    return;
  }
  steps.push({
    key,
    label,
    amountPence: -Math.abs(amountPence),
    kind: WATERFALL_KIND.DECREASE,
    categoryCode,
  });
}

export function buildChannelPerformance(bookings: DashboardBooking[], period: DatePeriod): ChannelPerformance[] {
  const rows = new Map<string, ChannelPerformance & { accommodationPence: number }>();
  for (const booking of bookings) {
    if (booking.checkIn < period.start || booking.checkIn >= period.endExclusive) {
      continue;
    }
    const current = rows.get(booking.platform) ?? {
      platform: booking.platform,
      label: PLATFORM_LABEL[booking.platform],
      revenuePence: 0,
      bookings: 0,
      nights: 0,
      adrPence: null,
      commissionPence: 0,
      feeBps: null,
      netPence: 0,
      accommodationPence: 0,
    };
    current.revenuePence += booking.grossPence;
    current.bookings += 1;
    current.nights += booking.nights;
    current.accommodationPence += booking.accommodationPence;
    current.commissionPence += booking.commissionPence + booking.processingPence;
    current.netPence += booking.grossPence - booking.commissionPence - booking.processingPence;
    rows.set(booking.platform, current);
  }
  const list = [...rows.values()];
  for (const row of list) {
    row.adrPence = row.nights === 0 ? null : Math.round(row.accommodationPence / row.nights);
    row.feeBps = marginBasisPoints(row.commissionPence, row.revenuePence);
  }
  list.sort((left, right) => right.revenuePence - left.revenuePence || left.label.localeCompare(right.label));
  return list.map((row) => ({
    platform: row.platform,
    label: row.label,
    revenuePence: row.revenuePence,
    bookings: row.bookings,
    nights: row.nights,
    adrPence: row.adrPence,
    commissionPence: row.commissionPence,
    feeBps: row.feeBps,
    netPence: row.netPence,
  }));
}

export function buildOtaDependency(channels: ChannelPerformance[]): OtaDependency {
  let ota = 0;
  let direct = 0;
  let total = 0;
  const slices: ShareBar[] = [];
  for (const channel of channels) {
    total += channel.revenuePence;
    if (OTA_PLATFORM.has(channel.platform)) {
      ota += channel.revenuePence;
    } else {
      direct += channel.revenuePence;
    }
  }
  for (const channel of channels) {
    slices.push({
      key: channel.platform,
      label: channel.label,
      amountPence: channel.revenuePence,
      shareBps: marginBasisPoints(channel.revenuePence, total),
      hrefHint: "/bookings",
      tone: TONE.NEUTRAL,
    });
  }
  const otaShareBps = marginBasisPoints(ota, total);
  const statement =
    otaShareBps === null
      ? null
      : `${formatMargin(otaShareBps)} of booking revenue in this period depends on third-party booking platforms.`;
  return {
    otaShareBps,
    directShareBps: marginBasisPoints(direct, total),
    slices,
    statement,
  };
}

function sortValue(row: PropertyPerformance, sort: PropertySort): number | null {
  if (sort === PROPERTY_SORT.REVENUE) {
    return row.revenuePence;
  }
  if (sort === PROPERTY_SORT.PROFIT) {
    return row.profitPence;
  }
  if (sort === PROPERTY_SORT.MARGIN) {
    return row.marginBps;
  }
  if (sort === PROPERTY_SORT.OCCUPANCY) {
    return row.occupancyBps;
  }
  if (sort === PROPERTY_SORT.ADR) {
    return row.adrPence;
  }
  return row.revpanPence;
}

export function sortProperties(rows: PropertyPerformance[], sort: PropertySort): PropertyPerformance[] {
  return [...rows].sort((left, right) => {
    const leftValue = sortValue(left, sort);
    const rightValue = sortValue(right, sort);
    if (leftValue === null && rightValue === null) {
      return left.name.localeCompare(right.name);
    }
    if (leftValue === null) {
      return 1;
    }
    if (rightValue === null) {
      return -1;
    }
    if (rightValue !== leftValue) {
      return rightValue - leftValue;
    }
    return left.name.localeCompare(right.name);
  });
}

export function ageingBucketFor(dueOn: IsoDate, today: IsoDate): AgeingBucket {
  if (dueOn >= today) {
    return AGEING_BUCKET.CURRENT;
  }
  const days = daysBetween(dueOn, today);
  if (days <= 30) {
    return AGEING_BUCKET.DAYS_1_30;
  }
  if (days <= 60) {
    return AGEING_BUCKET.DAYS_31_60;
  }
  if (days <= 90) {
    return AGEING_BUCKET.DAYS_61_90;
  }
  return AGEING_BUCKET.DAYS_90_PLUS;
}

export function buildAgeing(items: DashboardBalanceItem[], today: IsoDate, hrefPath: string): ShareBar[] {
  const totals: Record<AgeingBucket, number> = {
    [AGEING_BUCKET.CURRENT]: 0,
    [AGEING_BUCKET.DAYS_1_30]: 0,
    [AGEING_BUCKET.DAYS_31_60]: 0,
    [AGEING_BUCKET.DAYS_61_90]: 0,
    [AGEING_BUCKET.DAYS_90_PLUS]: 0,
  };
  let grand = 0;
  for (const item of items) {
    if (item.balancePence <= 0) {
      continue;
    }
    const bucket = ageingBucketFor(item.dueOn, today);
    totals[bucket] += item.balancePence;
    grand += item.balancePence;
  }
  return Object.values(AGEING_BUCKET)
    .map((bucket) => ({
      key: bucket,
      label: AGEING_LABEL[bucket],
      amountPence: totals[bucket],
      shareBps: marginBasisPoints(totals[bucket], grand),
      hrefHint: hrefPath,
      tone: bucket === AGEING_BUCKET.DAYS_90_PLUS && totals[bucket] > 0 ? TONE.WARNING : TONE.NEUTRAL,
    }))
    .filter((row) => row.amountPence > 0);
}

export function projectVatThreshold(assessment: VatAssessment): VatGaugeModel {
  const remainingPence = Math.max(0, assessment.thresholdPence - assessment.rollingTurnoverPence);
  if (assessment.warning === VAT_WARNING.EXCEEDED) {
    return {
      turnoverPence: assessment.rollingTurnoverPence,
      thresholdPence: assessment.thresholdPence,
      remainingPence: 0,
      utilisationBps: assessment.utilisationBps,
      warning: assessment.warning,
      monthsToThreshold: null,
      narrative: "Rolling taxable turnover is over the configured registration threshold.",
    };
  }
  if (assessment.rollingTurnoverPence === 0 || remainingPence === 0) {
    const narrative =
      remainingPence === 0
        ? "Rolling taxable turnover is on the configured registration threshold."
        : `${formatGbp(remainingPence)} remaining before the current registration threshold.`;
    return {
      turnoverPence: assessment.rollingTurnoverPence,
      thresholdPence: assessment.thresholdPence,
      remainingPence,
      utilisationBps: assessment.utilisationBps,
      warning: assessment.warning,
      monthsToThreshold: null,
      narrative,
    };
  }
  const months = Math.round((remainingPence / (assessment.rollingTurnoverPence / 12)) * 10) / 10;
  return {
    turnoverPence: assessment.rollingTurnoverPence,
    thresholdPence: assessment.thresholdPence,
    remainingPence,
    utilisationBps: assessment.utilisationBps,
    warning: assessment.warning,
    monthsToThreshold: months,
    narrative: `${formatGbp(remainingPence)} remaining before the current registration threshold. At the current rolling rate, that is about ${months} months.`,
  };
}

export function buildLengthOfStay(bookings: DashboardBooking[], period: DatePeriod): ShareBar[] {
  const counts = [0, 0, 0, 0, 0];
  const labels = ["1 night", "2 nights", "3 nights", "4–7 nights", "8+ nights"];
  let total = 0;
  for (const booking of bookings) {
    if (booking.checkIn < period.start || booking.checkIn >= period.endExclusive) {
      continue;
    }
    total += 1;
    if (booking.nights <= 1) {
      counts[0] += 1;
    } else if (booking.nights === 2) {
      counts[1] += 1;
    } else if (booking.nights === 3) {
      counts[2] += 1;
    } else if (booking.nights <= 7) {
      counts[3] += 1;
    } else {
      counts[4] += 1;
    }
  }
  return labels
    .map((label, index) => ({
      key: label,
      label,
      amountPence: counts[index] ?? 0,
      shareBps: total === 0 ? null : Math.round(((counts[index] ?? 0) * 10_000) / total),
      hrefHint: "/bookings",
      tone: TONE.NEUTRAL,
    }))
    .filter((row) => row.amountPence > 0);
}

function amountForCode(lines: LedgerLine[], period: DatePeriod, code: string, leaf: boolean): number {
  let total = 0;
  for (const line of lines) {
    if (line.kind !== LEDGER_KIND.EXPENSE || !inPeriod(line.occurredOn, period.start, period.endExclusive)) {
      continue;
    }
    const matches = leaf ? line.categoryCode === code : (line.parentCategoryCode ?? line.categoryCode) === code;
    if (matches) {
      total += recognisedExpense(line);
    }
  }
  return total;
}

export function buildCostAnomalies(input: {
  lines: LedgerLine[];
  period: DatePeriod;
  previous: DatePeriod;
  useThreeMonthAverage: boolean;
}): CostAnomaly[] {
  const statement = buildProfitAndLoss(input.lines, input.period);
  const candidates: CostAnomaly[] = [];
  for (const category of statement.expenseByCategory) {
    if (category.code === PARENT_CATEGORY.UTILITIES) {
      continue;
    }
    const anomaly = anomalyFor(input, category.code, category.label, false);
    if (anomaly) {
      candidates.push(anomaly);
    }
  }
  for (const code of UTILITY_LEAF) {
    const sample = input.lines.find((line) => line.categoryCode === code);
    const anomaly = anomalyFor(input, code, sample?.label ?? code, true);
    if (anomaly) {
      candidates.push(anomaly);
    }
  }
  candidates.sort((left, right) => right.changeBps - left.changeBps);
  return candidates.slice(0, ANOMALY_LIMIT);
}

function anomalyFor(
  input: { lines: LedgerLine[]; period: DatePeriod; previous: DatePeriod; useThreeMonthAverage: boolean },
  code: string,
  label: string,
  leaf: boolean,
): CostAnomaly | null {
  const currentPence = amountForCode(input.lines, input.period, code, leaf);
  const baselinePence = input.useThreeMonthAverage
    ? threeMonthAverage(input.lines, input.period, code, leaf)
    : amountForCode(input.lines, input.previous, code, leaf);
  if (baselinePence <= 0 || currentPence * 10_000 < baselinePence * UTILITY_INCREASE_BPS) {
    return null;
  }
  const changeBps = Math.round(((currentPence - baselinePence) * 10_000) / baselinePence);
  const comparison = input.useThreeMonthAverage ? "the previous three-month average" : "the previous period";
  return {
    code,
    label,
    currentPence,
    baselinePence,
    changeBps,
    detail: `${formatGbp(currentPence)} is ${formatMargin(changeBps)} higher than ${comparison} of ${formatGbp(baselinePence)}.`,
  };
}

function threeMonthAverage(lines: LedgerLine[], period: DatePeriod, code: string, leaf: boolean): number {
  const anchor = addDays(period.start, -1);
  const months = trailingMonths(anchor, THREE_MONTH_BASELINE);
  let total = 0;
  for (const month of months) {
    total += amountForCode(lines, month, code, leaf);
  }
  return months.length === 0 ? 0 : Math.round(total / months.length);
}

function percentTone(deltaBps: number | null, higherIsBetter: boolean): Tone {
  if (deltaBps === null || deltaBps === 0) {
    return TONE.NEUTRAL;
  }
  const improved = higherIsBetter ? deltaBps > 0 : deltaBps < 0;
  return improved ? TONE.POSITIVE : TONE.NEGATIVE;
}

function moneyChangeLabel(current: number, previous: number): { label: string; deltaBps: number | null } {
  if (previous === 0) {
    return { label: current === 0 ? "Flat vs previous period" : "No previous amount", deltaBps: null };
  }
  const deltaBps = Math.round(((current - previous) * 10_000) / Math.abs(previous));
  if (deltaBps === 0) {
    return { label: "Flat vs previous period", deltaBps: 0 };
  }
  const arrow = deltaBps > 0 ? "↑" : "↓";
  return { label: `${arrow} ${formatMargin(Math.abs(deltaBps))} vs previous period`, deltaBps };
}

function pointChangeLabel(current: number | null, previous: number | null): { label: string; deltaBps: number | null } {
  if (current === null || previous === null) {
    return { label: "No comparison", deltaBps: null };
  }
  const delta = current - previous;
  if (delta === 0) {
    return { label: "Flat vs previous period", deltaBps: 0 };
  }
  const tenths = Math.round(Math.abs(delta) / 10);
  const arrow = delta > 0 ? "↑" : "↓";
  return { label: `${arrow} ${Math.trunc(tenths / 10)}.${tenths % 10} pts`, deltaBps: delta };
}

function poundChangeLabel(current: number | null, previous: number | null): { label: string; deltaBps: number | null } {
  if (current === null || previous === null) {
    return { label: "No comparison", deltaBps: null };
  }
  const delta = current - previous;
  if (delta === 0) {
    return { label: "Flat vs previous period", deltaBps: 0 };
  }
  const arrow = delta > 0 ? "↑" : "↓";
  return { label: `${arrow} ${formatGbp(Math.abs(delta))} vs previous period`, deltaBps: previous === 0 ? null : Math.round((delta * 10_000) / Math.abs(previous)) };
}

function monthsOverlapping(period: DatePeriod): DatePeriod[] {
  const periods: DatePeriod[] = [];
  let cursor = period.start;
  for (let index = 0; index < 36 && cursor < period.endExclusive; index += 1) {
    const month = calendarMonthContaining(cursor);
    periods.push(month);
    cursor = month.endExclusive;
  }
  return periods;
}

function dayBuckets(period: DatePeriod): DatePeriod[] {
  const length = daysInPeriod(period);
  const buckets: DatePeriod[] = [];
  const count = Math.min(length, 62);
  for (let offset = 0; offset < count; offset += 1) {
    const start = addDays(period.start, offset);
    buckets.push({ start, endExclusive: addDays(start, 1), label: formatDisplayDate(start).replace(/ \d{4}$/, "") });
  }
  return buckets;
}

function trendBuckets(period: DatePeriod): DatePeriod[] {
  if (daysInPeriod(period) <= 31) {
    return dayBuckets(period);
  }
  return monthsOverlapping(period).map((month) => ({
    ...month,
    label: formatDisplayDate(month.start).replace(/^\d+ /, "").replace(/ \d{4}$/, ""),
  }));
}

function historyMonths(period: DatePeriod): DatePeriod[] {
  if (daysInPeriod(period) > 31) {
    return monthsOverlapping(period);
  }
  const anchor = addDays(period.endExclusive, -1);
  return trailingMonths(anchor, 6);
}

function shortMonthLabel(period: DatePeriod): string {
  return formatDisplayDate(period.start).replace(/^\d+ /, "").replace(/ \d{4}$/, "");
}

function shareBars(rows: Array<{ key: string; label: string; amountPence: number; hrefHint: string | null; tone?: Tone }>): ShareBar[] {
  const total = rows.reduce((sum, row) => sum + row.amountPence, 0);
  return rows
    .filter((row) => row.amountPence !== 0)
    .sort((left, right) => right.amountPence - left.amountPence)
    .map((row) => ({
      key: row.key,
      label: row.label,
      amountPence: row.amountPence,
      shareBps: marginBasisPoints(row.amountPence, total),
      hrefHint: row.hrefHint,
      tone: row.tone ?? TONE.NEUTRAL,
    }));
}

function propertyMetrics(
  property: { id: string; name: string },
  lines: LedgerLine[],
  bookings: DashboardBooking[],
  period: DatePeriod,
  elapsed: DatePeriod,
): PropertyPerformance {
  const statement = buildProfitAndLoss(linesForProperty(lines, property.id), period);
  const propertyBookings = bookings.filter((booking) => booking.propertyId === property.id);
  const occupied = occupiedNightCount(propertyBookings, elapsed);
  const available = daysInPeriod(elapsed);
  const accommodation = accommodationInPeriod(linesForProperty(lines, property.id), elapsed);
  const kpis = calculatePropertyKpis({
    availableNights: available,
    occupiedNights: occupied,
    accommodationRevenuePence: accommodation,
    grossRevenuePence: statement.grossRevenuePence,
    bookingCount: propertyBookings.filter((booking) => booking.checkIn >= period.start && booking.checkIn < period.endExclusive).length,
    cleaningCostPence: statement.expenseByCategory.find((row) => row.code === PARENT_CATEGORY.CLEANING)?.amountPence ?? 0,
    otaFeesPence: statement.otaFeesPence,
    operatingProfitPence: statement.operatingProfitPence,
  });
  return {
    id: property.id,
    name: property.name,
    revenuePence: statement.grossRevenuePence,
    profitPence: statement.operatingProfitPence,
    marginBps: statement.marginBps,
    occupancyBps: kpis.occupancyBps,
    adrPence: kpis.adrPence,
    revpanPence: kpis.revparPence,
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
  }
  return sorted[middle] ?? 0;
}

function intensity(values: number[]): number[] {
  const peak = values.reduce((highest, value) => Math.max(highest, Math.abs(value)), 0);
  if (peak === 0) {
    return values.map(() => 0);
  }
  return values.map((value) => Math.round((Math.abs(value) * 10_000) / peak));
}

function comparisonTable(properties: PropertyPerformance[], lines: LedgerLine[], period: DatePeriod): PropertyComparison | null {
  const chosen = sortProperties(properties, PROPERTY_SORT.REVENUE).slice(0, COMPARISON_LIMIT);
  if (chosen.length === 0) {
    return null;
  }
  const statements = chosen.map((property) => buildProfitAndLoss(linesForProperty(lines, property.id), period));
  const definitions: Array<{ label: string; emphasize: boolean; values: number[]; displays: string[] }> = [
    {
      label: "Revenue",
      emphasize: false,
      values: statements.map((statement) => statement.grossRevenuePence),
      displays: statements.map((statement) => formatGbp(statement.grossRevenuePence)),
    },
    {
      label: "Rent",
      emphasize: false,
      values: statements.map((statement) => statement.expenseByCategory.find((row) => row.code === PARENT_CATEGORY.PROPERTY_RENT)?.amountPence ?? 0),
      displays: [],
    },
    {
      label: "Cleaning",
      emphasize: false,
      values: statements.map((statement) => statement.expenseByCategory.find((row) => row.code === PARENT_CATEGORY.CLEANING)?.amountPence ?? 0),
      displays: [],
    },
    {
      label: "Utilities",
      emphasize: false,
      values: statements.map((statement) => statement.expenseByCategory.find((row) => row.code === PARENT_CATEGORY.UTILITIES)?.amountPence ?? 0),
      displays: [],
    },
    {
      label: "OTA fees",
      emphasize: false,
      values: statements.map((statement) => statement.otaFeesPence),
      displays: [],
    },
    {
      label: "Profit",
      emphasize: true,
      values: statements.map((statement) => statement.operatingProfitPence),
      displays: statements.map((statement) => formatGbp(statement.operatingProfitPence)),
    },
    {
      label: "Margin",
      emphasize: true,
      values: chosen.map((property) => property.marginBps ?? 0),
      displays: chosen.map((property) => formatMargin(property.marginBps)),
    },
  ];
  return {
    properties: chosen.map((property) => ({ id: property.id, name: property.name })),
    rows: definitions.map((definition) => {
      const displays = definition.displays.length > 0 ? definition.displays : definition.values.map((value) => formatGbp(value));
      const weights = intensity(definition.values);
      return {
        label: definition.label,
        emphasize: definition.emphasize,
        cells: displays.map((display, index) => ({ display, intensityBps: weights[index] ?? 0 })),
      };
    }),
  };
}

function weekdayIndex(isoDate: IsoDate): number {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) {
    return 0;
  }
  const day = parsed.getUTCDay();
  return day === 0 ? 6 : day - 1;
}

function mondayOnOrBefore(isoDate: IsoDate): IsoDate {
  return addDays(isoDate, -weekdayIndex(isoDate));
}

function heatmapWindow(period: DatePeriod, today: IsoDate): DatePeriod {
  if (daysInPeriod(period) <= HEATMAP_DAY_LIMIT) {
    return period;
  }
  const endInclusive = today >= period.start && today < period.endExclusive ? today : addDays(period.endExclusive, -1);
  const endExclusive = addDays(endInclusive, 1);
  const startCandidate = addDays(endExclusive, -HEATMAP_RECENT_DAYS);
  return {
    start: startCandidate < period.start ? period.start : startCandidate,
    endExclusive,
    label: "Recent occupancy",
  };
}

function buildHeatmap(bookings: DashboardBooking[], properties: number, window: DatePeriod): HeatmapWeek[] {
  const weeks: HeatmapWeek[] = [];
  let weekStart = mondayOnOrBefore(window.start);
  for (let guard = 0; guard < 8 && weekStart < window.endExclusive; guard += 1) {
    const days: HeatmapDay[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const iso = addDays(weekStart, offset);
      const inside = iso >= window.start && iso < window.endExclusive;
      const occupied = inside ? occupiedNightCount(bookings, { start: iso, endExclusive: addDays(iso, 1), label: iso }) : 0;
      days.push({
        iso,
        weekday: WEEKDAY_LABEL[offset] ?? "",
        occupancyBps: inside && properties > 0 ? Math.round((occupied * 10_000) / properties) : null,
        bookings: occupied,
      });
    }
    weeks.push({ label: formatDisplayDate(weekStart).replace(/ \d{4}$/, ""), days });
    weekStart = addDays(weekStart, 7);
  }
  return weeks;
}

function stayLabel(booking: DashboardBooking): string {
  const guest = booking.guest.trim().length > 0 ? booking.guest : "Guest";
  return `${guest} · ${PLATFORM_LABEL[booking.platform]} · ${booking.nights} nights · ${formatGbp(booking.grossPence)}`;
}

function buildStays(bookings: DashboardBooking[], properties: Array<{ id: string; name: string }>, today: IsoDate): { dates: string[]; rows: StayRow[] } {
  const dates: string[] = [];
  for (let offset = 0; offset < CALENDAR_DAYS; offset += 1) {
    dates.push(addDays(today, offset));
  }
  const rows = properties.slice(0, STAY_PROPERTY_LIMIT).map((property) => {
    const propertyBookings = bookings.filter((booking) => booking.propertyId === property.id);
    const days = dates.map((iso) => {
      const booking = propertyBookings.find((item) => item.checkIn <= iso && item.checkOut > iso);
      const startsHere = booking?.checkIn === iso || (booking && iso === dates[0] && booking.checkIn < iso);
      return {
        iso,
        occupied: Boolean(booking),
        label: booking && startsHere ? stayLabel(booking) : null,
      };
    });
    return { propertyId: property.id, propertyName: property.name, days };
  });
  return { dates, rows };
}

function compositionFor(bookings: DashboardBooking[], months: DatePeriod[]): CompositionPoint[] {
  return months.map((month) => {
    const point = {
      label: shortMonthLabel(month),
      accommodationPence: 0,
      cleaningPence: 0,
      extraGuestPence: 0,
      parkingPence: 0,
      otherPence: 0,
    };
    for (const booking of bookings) {
      if (booking.checkIn < month.start || booking.checkIn >= month.endExclusive) {
        continue;
      }
      point.accommodationPence += booking.accommodationPence;
      point.cleaningPence += booking.cleaningPence;
      point.extraGuestPence += booking.extraGuestPence;
      point.parkingPence += booking.parkingPence;
      point.otherPence += booking.otherPence;
    }
    return point;
  });
}

function hospitalityFor(
  lines: LedgerLine[],
  bookings: DashboardBooking[],
  propertyCount: number,
  months: DatePeriod[],
  today: IsoDate,
): HospitalityPoint[] {
  return months.map((month) => {
    const elapsed = elapsedSlice(month, today);
    const occupied = occupiedNightCount(bookings, elapsed);
    const available = propertyCount * daysInPeriod(elapsed);
    const accommodation = accommodationInPeriod(lines, elapsed);
    const kpis = calculatePropertyKpis({
      availableNights: available,
      occupiedNights: occupied,
      accommodationRevenuePence: accommodation,
      grossRevenuePence: accommodation,
      bookingCount: 0,
      cleaningCostPence: 0,
      otaFeesPence: 0,
      operatingProfitPence: 0,
    });
    return {
      label: shortMonthLabel(month),
      occupancyBps: kpis.occupancyBps,
      adrPence: kpis.adrPence,
      revpanPence: kpis.revparPence,
    };
  });
}

function expenseTrendFor(lines: LedgerLine[], months: DatePeriod[]): { points: ExpenseTrendPoint[]; keys: string[] } {
  const totals = new Map<string, { label: string; amountPence: number }>();
  const perMonth = months.map((month) => {
    const statement = buildProfitAndLoss(lines, month);
    const amounts = new Map<string, number>();
    for (const category of statement.expenseByCategory) {
      amounts.set(category.label, (amounts.get(category.label) ?? 0) + category.amountPence);
      const current = totals.get(category.label) ?? { label: category.label, amountPence: 0 };
      current.amountPence += category.amountPence;
      totals.set(category.label, current);
    }
    return { label: shortMonthLabel(month), amounts };
  });
  const ranked = [...totals.values()].sort((left, right) => right.amountPence - left.amountPence);
  const keys = ranked.slice(0, 5).map((item) => item.label);
  const extra = ranked.length > 5;
  const keyList = extra ? [...keys, "Other"] : keys;
  const points = perMonth.map((month) => {
    const amounts: Record<string, number> = {};
    let other = 0;
    for (const [label, amount] of month.amounts) {
      if (keys.includes(label)) {
        amounts[label] = amount;
      } else {
        other += amount;
      }
    }
    if (extra) {
      amounts.Other = other;
    }
    return { label: month.label, amounts };
  });
  return { points, keys: keyList };
}

function cashTotals(movements: DashboardMovement[], period: DatePeriod): { inPence: number; outPence: number } {
  let inPence = 0;
  let outPence = 0;
  for (const movement of movements) {
    if (!inPeriod(movement.occurredOn, period.start, period.endExclusive)) {
      continue;
    }
    if (movement.direction === "CREDIT") {
      inPence += movement.amountPence;
    } else {
      outPence += movement.amountPence;
    }
  }
  return { inPence, outPence };
}

function balanceBefore(openingPence: number, movements: DashboardMovement[], isoDate: IsoDate): number {
  let balance = openingPence;
  for (const movement of movements) {
    if (movement.occurredOn >= isoDate) {
      continue;
    }
    balance += movement.direction === "CREDIT" ? movement.amountPence : -movement.amountPence;
  }
  return balance;
}

function buildCashWaterfall(openingPence: number, movements: DashboardMovement[], period: DatePeriod): WaterfallStep[] {
  const opening = balanceBefore(openingPence, movements, period.start);
  const grouped = new Map<string, number>();
  let otherIn = 0;
  let moneyOut = 0;
  for (const movement of movements) {
    if (!inPeriod(movement.occurredOn, period.start, period.endExclusive)) {
      continue;
    }
    if (movement.direction === "DEBIT") {
      moneyOut += movement.amountPence;
      continue;
    }
    if (movement.payoutPlatform) {
      const label = `${PLATFORM_LABEL[movement.payoutPlatform]} payouts`;
      grouped.set(label, (grouped.get(label) ?? 0) + movement.amountPence);
    } else {
      otherIn += movement.amountPence;
    }
  }
  const drafts: Array<Omit<WaterfallStep, "barStartPence" | "barEndPence">> = [
    { key: "opening", label: "Opening bank balance", amountPence: opening, kind: WATERFALL_KIND.RESULT, categoryCode: null },
  ];
  for (const [label, amount] of [...grouped.entries()].sort((left, right) => right[1] - left[1])) {
    if (amount === 0) {
      continue;
    }
    drafts.push({ key: label, label, amountPence: amount, kind: WATERFALL_KIND.INCREASE, categoryCode: null });
  }
  if (otherIn > 0) {
    drafts.push({ key: "other-in", label: "Other money in", amountPence: otherIn, kind: WATERFALL_KIND.INCREASE, categoryCode: null });
  }
  if (moneyOut > 0) {
    drafts.push({ key: "money-out", label: "Money out", amountPence: -moneyOut, kind: WATERFALL_KIND.DECREASE, categoryCode: null });
  }
  const closing = balanceBefore(openingPence, movements, period.endExclusive);
  drafts.push({ key: "closing", label: "Closing balance", amountPence: closing, kind: WATERFALL_KIND.RESULT, categoryCode: null });
  return layoutWaterfall(drafts);
}

function buildReconciliation(movements: DashboardMovement[], suggestedMatches: number): ReconciliationProgress {
  let matched = 0;
  let unmatched = 0;
  let partial = 0;
  for (const movement of movements) {
    if (movement.status === RECONCILIATION_STATUS.MATCHED || movement.status === RECONCILIATION_STATUS.RECONCILED) {
      matched += 1;
    } else if (movement.status === RECONCILIATION_STATUS.PARTIALLY_MATCHED) {
      partial += 1;
    } else {
      unmatched += 1;
    }
  }
  const total = movements.length;
  const suggested = Math.min(Math.max(suggestedMatches, 0), unmatched);
  return {
    total,
    matched,
    unmatched,
    suggested,
    needsReview: partial + (unmatched - suggested),
    progressBps: total === 0 ? null : Math.round((matched * 10_000) / total),
  };
}

function buildPayouts(payouts: DashboardPayout[], period: DatePeriod): PayoutMatch[] {
  return payouts
    .filter((payout) => inPeriod(payout.paidOn, period.start, period.endExclusive))
    .map((payout) => {
      const difference = payout.amountPence - payout.allocatedPence;
      return {
        id: payout.id,
        label: `${PLATFORM_LABEL[payout.platform]} ${payout.reference}`,
        amountPence: payout.amountPence,
        allocatedPence: payout.allocatedPence,
        differencePence: difference,
        balanced: difference === 0 && payout.allocatedPence > 0,
      };
    })
    .sort((left, right) => Math.abs(right.differencePence) - Math.abs(left.differencePence))
    .slice(0, PAYOUT_LIMIT);
}

function buildCompliance(properties: Array<{ id: string }>, documents: DashboardDocument[], today: IsoDate): ComplianceSummary {
  let compliantProperties = 0;
  let missing = 0;
  for (const property of properties) {
    let ready = true;
    for (const kind of REQUIRED_DOCUMENT) {
      const matches = documents.filter((document) => document.propertyId === property.id && document.kind === kind);
      const current = matches.some((document) => document.expiresOn === null || document.expiresOn >= today);
      if (matches.length === 0) {
        missing += 1;
        ready = false;
      } else if (!current) {
        ready = false;
      }
    }
    if (ready) {
      compliantProperties += 1;
    }
  }
  let expired = 0;
  let expiring = 0;
  for (const document of documents) {
    if (!document.expiresOn) {
      continue;
    }
    if (document.expiresOn < today) {
      expired += 1;
    } else if (daysBetween(today, document.expiresOn) <= CERTIFICATE_WARNING_DAYS) {
      expiring += 1;
    }
  }
  return {
    compliantProperties,
    propertyCount: properties.length,
    expiring,
    expired,
    missing,
    definition: "A property is compliant when its lease, insurance, and certificate are on file and not expired.",
  };
}

const ACTION_PATH: Record<AlertKind, string> = {
  [ALERT_KIND.INVOICE_OVERDUE]: "/invoices",
  [ALERT_KIND.SUPPLIER_BILL_DUE]: "/expenses",
  [ALERT_KIND.RENT_DUE]: "/expenses",
  [ALERT_KIND.VAT_THRESHOLD_EXCEEDED]: "/tax",
  [ALERT_KIND.VAT_THRESHOLD_APPROACHING]: "/tax",
  [ALERT_KIND.UTILITY_INCREASE]: "/expenses",
  [ALERT_KIND.INSURANCE_EXPIRING]: "/documents",
  [ALERT_KIND.CERTIFICATE_EXPIRING]: "/documents",
  [ALERT_KIND.LEASE_EXPIRING]: "/documents",
  [ALERT_KIND.SUBSCRIPTION_RENEWAL]: "/expenses",
  [ALERT_KIND.BANK_UNMATCHED]: "/reconciliation",
  [ALERT_KIND.PAYOUT_UNMATCHED]: "/reconciliation",
};

const ACTION_HEADING: Record<string, string> = {
  [ACTION_GROUP.CRITICAL]: "Critical",
  [ACTION_GROUP.FINANCE]: "Finance",
  [ACTION_GROUP.PROPERTY]: "Property",
  [ACTION_GROUP.COST]: "Cost",
  [ACTION_GROUP.TAX]: "Tax",
};

function actionGroupFor(kind: AlertKind): string {
  if (kind === ALERT_KIND.INVOICE_OVERDUE || kind === ALERT_KIND.VAT_THRESHOLD_EXCEEDED) {
    return ACTION_GROUP.CRITICAL;
  }
  if (kind === ALERT_KIND.VAT_THRESHOLD_APPROACHING) {
    return ACTION_GROUP.TAX;
  }
  if (kind === ALERT_KIND.UTILITY_INCREASE || kind === ALERT_KIND.RENT_DUE || kind === ALERT_KIND.SUBSCRIPTION_RENEWAL) {
    return ACTION_GROUP.COST;
  }
  if (
    kind === ALERT_KIND.CERTIFICATE_EXPIRING ||
    kind === ALERT_KIND.LEASE_EXPIRING ||
    kind === ALERT_KIND.INSURANCE_EXPIRING
  ) {
    return ACTION_GROUP.PROPERTY;
  }
  return ACTION_GROUP.FINANCE;
}

export function groupActions(alerts: DashboardAlert[]): ActionGroupModel[] {
  const groups = new Map<string, ActionGroupModel>();
  for (const alert of alerts) {
    const id = actionGroupFor(alert.kind);
    const current = groups.get(id) ?? { id, heading: ACTION_HEADING[id] ?? id, items: [] };
    current.items.push({
      kind: alert.kind,
      title: alert.title,
      detail: alert.detail,
      hrefPath: ACTION_PATH[alert.kind],
    });
    groups.set(id, current);
  }
  const order = [ACTION_GROUP.CRITICAL, ACTION_GROUP.FINANCE, ACTION_GROUP.PROPERTY, ACTION_GROUP.COST, ACTION_GROUP.TAX];
  return order.map((id) => groups.get(id)).filter((group): group is ActionGroupModel => Boolean(group));
}

function yearProgress(period: DatePeriod, today: IsoDate): number {
  if (today <= period.start) {
    return 0;
  }
  if (today >= period.endExclusive) {
    return 10_000;
  }
  return Math.round((daysBetween(period.start, today) * 10_000) / daysInPeriod(period));
}

function inclusiveEnd(period: DatePeriod): string {
  return formatDisplayDate(addDays(period.endExclusive, -1));
}

function buildCleaning(
  lines: LedgerLine[],
  bookings: DashboardBooking[],
  properties: Array<{ id: string; name: string }>,
  period: DatePeriod,
  previous: DatePeriod,
): CleaningPerformance {
  const currentCost = amountForCode(lines, period, PARENT_CATEGORY.CLEANING, false);
  const previousCost = amountForCode(lines, previous, PARENT_CATEGORY.CLEANING, false);
  const currentBookings = bookings.filter((booking) => booking.checkIn >= period.start && booking.checkIn < period.endExclusive);
  const previousBookings = bookings.filter((booking) => booking.checkIn >= previous.start && booking.checkIn < previous.endExclusive);
  const averagePence = currentBookings.length === 0 ? null : Math.round(currentCost / currentBookings.length);
  const previousAveragePence = previousBookings.length === 0 ? null : Math.round(previousCost / previousBookings.length);
  const varianceBps =
    averagePence === null || previousAveragePence === null || previousAveragePence === 0
      ? null
      : Math.round(((averagePence - previousAveragePence) * 10_000) / previousAveragePence);
  const byProperty = properties.map((property) => {
    const propertyBookings = currentBookings.filter((booking) => booking.propertyId === property.id).length;
    const cost = amountForCode(linesForProperty(lines, property.id), period, PARENT_CATEGORY.CLEANING, false);
    const average = propertyBookings === 0 ? null : Math.round(cost / propertyBookings);
    const variance =
      average === null || averagePence === null || averagePence === 0
        ? null
        : Math.round(((average - averagePence) * 10_000) / averagePence);
    return { propertyId: property.id, name: property.name, averagePence: average, varianceBps: variance };
  });
  const outlier = byProperty
    .filter((row) => row.varianceBps !== null && row.varianceBps >= 2_100)
    .sort((left, right) => (right.varianceBps ?? 0) - (left.varianceBps ?? 0))[0];
  const alert = outlier
    ? `${outlier.name} cleaning cost per booking is ${formatMargin(outlier.varianceBps)} above the portfolio average.`
    : null;
  return {
    costPence: currentCost,
    bookings: currentBookings.length,
    averagePence,
    previousAveragePence,
    varianceBps,
    byProperty: byProperty.filter((row) => row.averagePence !== null),
    alert,
  };
}

function buildInsights(input: {
  current: ProfitAndLoss;
  previous: ProfitAndLoss;
  properties: PropertyPerformance[];
  previousProperties: PropertyPerformance[];
  channels: ChannelPerformance[];
  cleaning: CleaningPerformance;
}): Insight[] {
  const insights: Insight[] = [];
  const profitDelta = input.current.operatingProfitPence - input.previous.operatingProfitPence;
  if (profitDelta !== 0) {
    const mover = largestOccupancyGain(input.properties, input.previousProperties);
    const change = moneyChangeLabel(input.current.operatingProfitPence, input.previous.operatingProfitPence);
    const margin = pointChangeLabel(input.current.marginBps, input.previous.marginBps);
    const marginSentence = margin.label === "No comparison" ? "There is no earlier margin to compare." : `Margin ${margin.label.toLowerCase()}.`;
    const driver =
      profitDelta > 0 && mover && mover.deltaBps > 0
        ? ` ${mover.name} occupancy moved ${pointChangeLabel(mover.current, mover.previous).label.replace(" vs previous period", "")}.`
        : "";
    insights.push({
      id: "profit",
      title: profitDelta > 0 ? "Profit improved" : "Profit fell",
      body: `Operating profit is ${formatGbp(input.current.operatingProfitPence)}, ${change.label.toLowerCase()}. ${marginSentence}${driver}`,
    });
  }
  const direct = sumChannels(input.channels, false);
  const ota = sumChannels(input.channels, true);
  const revenue = direct.revenue + ota.revenue;
  const net = direct.net + ota.net;
  if (direct.revenue > 0 && ota.revenue > 0 && net > 0) {
    const directRevenueShare = marginBasisPoints(direct.revenue, revenue);
    const directNetShare = marginBasisPoints(direct.net, net);
    const directMargin = marginBasisPoints(direct.net, direct.revenue);
    const otaMargin = marginBasisPoints(ota.net, ota.revenue);
    if (
      directMargin !== null &&
      otaMargin !== null &&
      directMargin > otaMargin &&
      directNetShare !== null &&
      directRevenueShare !== null &&
      directNetShare > directRevenueShare
    ) {
      insights.push({
        id: "direct",
        title: "Direct bookings keep more of the rate",
        body: `Direct and corporate bookings are ${formatMargin(directRevenueShare)} of booking revenue and ${formatMargin(directNetShare)} of revenue after platform fees.`,
      });
    }
  }
  if (
    input.cleaning.varianceBps !== null &&
    input.cleaning.varianceBps >= CLEANING_ALERT_BPS &&
    input.cleaning.averagePence !== null &&
    input.cleaning.previousAveragePence !== null
  ) {
    insights.push({
      id: "cleaning",
      title: "Cleaning costs are increasing",
      body: `Cleaning cost per booking moved from ${formatGbp(input.cleaning.previousAveragePence)} to ${formatGbp(input.cleaning.averagePence)}.${input.cleaning.alert ? ` ${input.cleaning.alert}` : ""}`,
    });
  }
  return insights.slice(0, 3);
}

function largestOccupancyGain(
  current: PropertyPerformance[],
  previous: PropertyPerformance[],
): { name: string; deltaBps: number; current: number; previous: number } | null {
  let best: { name: string; deltaBps: number; current: number; previous: number } | null = null;
  for (const property of current) {
    const earlier = previous.find((item) => item.id === property.id);
    if (property.occupancyBps === null || earlier?.occupancyBps === null || earlier === undefined) {
      continue;
    }
    const deltaBps = property.occupancyBps - earlier.occupancyBps;
    if (!best || deltaBps > best.deltaBps) {
      best = { name: property.name, deltaBps, current: property.occupancyBps, previous: earlier.occupancyBps };
    }
  }
  return best;
}

function sumChannels(channels: ChannelPerformance[], ota: boolean): { revenue: number; net: number } {
  let revenue = 0;
  let net = 0;
  for (const channel of channels) {
    if (OTA_PLATFORM.has(channel.platform) !== ota) {
      continue;
    }
    revenue += channel.revenuePence;
    net += channel.netPence;
  }
  return { revenue, net };
}

function accrualTrend(lines: LedgerLine[], buckets: DatePeriod[]): TrendPoint[] {
  return buckets.map((bucket) => {
    const statement = buildProfitAndLoss(lines, bucket);
    return {
      label: bucket.label,
      revenuePence: statement.grossRevenuePence,
      costPence: statement.operatingExpensesPence,
      profitPence: statement.operatingProfitPence,
    };
  });
}

function cashTrend(movements: DashboardMovement[], buckets: DatePeriod[]): TrendPoint[] {
  return buckets.map((bucket) => {
    const totals = cashTotals(movements, bucket);
    return {
      label: bucket.label,
      revenuePence: totals.inPence,
      costPence: totals.outPence,
      profitPence: totals.inPence - totals.outPence,
    };
  });
}

function cashSeries(movements: DashboardMovement[], opening: number, buckets: DatePeriod[]): CashPoint[] {
  return buckets.map((bucket) => {
    const totals = cashTotals(movements, bucket);
    return {
      label: bucket.label,
      inPence: totals.inPence,
      outPence: totals.outPence,
      closingPence: balanceBefore(opening, movements, bucket.endExclusive),
    };
  });
}

function taxTreatment(statement: ProfitAndLoss): ShareBar[] {
  return shareBars([
    { key: TAX_CLASSIFICATION.ALLOWABLE, label: "Allowable", amountPence: statement.deductibleExpensesPence, hrefHint: "/tax" },
    { key: TAX_CLASSIFICATION.CAPITAL, label: "Capital", amountPence: statement.capitalExpenditurePence, hrefHint: "/tax" },
    { key: TAX_CLASSIFICATION.FINANCE_COST, label: "Finance costs", amountPence: statement.financeCostsPence, hrefHint: "/tax" },
    { key: TAX_CLASSIFICATION.DISALLOWABLE, label: "Disallowable", amountPence: statement.disallowablePence, hrefHint: "/tax" },
    {
      key: TAX_CLASSIFICATION.ACCOUNTANT_REVIEW,
      label: "Needs accountant",
      amountPence: statement.pendingReviewPence,
      hrefHint: "/tax",
      tone: statement.pendingReviewPence > 0 ? TONE.WARNING : TONE.NEUTRAL,
    },
  ]);
}

function sparkline(values: number[]): number[] {
  return values.length < 2 ? [] : values;
}

export function assembleDashboard(input: DashboardInput): DashboardView {
  const resolved = resolveDashboardPeriod(input);
  const basis = resolveLedgerBasis(input.basis);
  const period = resolved.period;
  const previous = previousMatchingPeriod(period);
  const elapsed = elapsedSlice(period, input.today);
  const previousElapsed = elapsedSlice(previous, input.today);
  const statement = buildProfitAndLoss(input.lines, period);
  const previousStatement = buildProfitAndLoss(input.lines, previous);
  const buckets = trendBuckets(period);
  const months = historyMonths(period);
  const trend = basis === LEDGER_BASIS.CASH ? cashTrend(input.movements, buckets) : accrualTrend(input.lines, buckets);
  const fees = splitPlatformFees(input.lines, period);
  const channels = buildChannelPerformance(input.bookings, period);
  const properties = input.properties.map((property) => propertyMetrics(property, input.lines, input.bookings, period, elapsed));
  const previousProperties = input.properties.map((property) =>
    propertyMetrics(property, input.lines, input.bookings, previous, previousElapsed),
  );
  const portfolioOccupied = occupiedNightCount(input.bookings, elapsed);
  const portfolioAvailable = input.properties.length * daysInPeriod(elapsed);
  const portfolioAccommodation = accommodationInPeriod(input.lines, elapsed);
  const portfolio = calculatePropertyKpis({
    availableNights: portfolioAvailable,
    occupiedNights: portfolioOccupied,
    accommodationRevenuePence: portfolioAccommodation,
    grossRevenuePence: statement.grossRevenuePence,
    bookingCount: input.bookings.filter((booking) => booking.checkIn >= period.start && booking.checkIn < period.endExclusive).length,
    cleaningCostPence: statement.expenseByCategory.find((row) => row.code === PARENT_CATEGORY.CLEANING)?.amountPence ?? 0,
    otaFeesPence: statement.otaFeesPence,
    operatingProfitPence: statement.operatingProfitPence,
  });
  const previousOccupied = occupiedNightCount(input.bookings, previousElapsed);
  const previousAvailable = input.properties.length * daysInPeriod(previousElapsed);
  const previousAccommodation = accommodationInPeriod(input.lines, previousElapsed);
  const previousPortfolio = calculatePropertyKpis({
    availableNights: previousAvailable,
    occupiedNights: previousOccupied,
    accommodationRevenuePence: previousAccommodation,
    grossRevenuePence: previousStatement.grossRevenuePence,
    bookingCount: 0,
    cleaningCostPence: 0,
    otaFeesPence: 0,
    operatingProfitPence: previousStatement.operatingProfitPence,
  });
  const periodCash = cashTotals(input.movements, period);
  const bankPence = balanceBefore(input.openingBalancePence, input.movements, addDays(input.today, 1));
  const cashMovement = periodCash.inPence - periodCash.outPence;
  const revenueChange = moneyChangeLabel(
    basis === LEDGER_BASIS.CASH ? periodCash.inPence : statement.grossRevenuePence,
    basis === LEDGER_BASIS.CASH ? cashTotals(input.movements, previous).inPence : previousStatement.grossRevenuePence,
  );
  const costChange = moneyChangeLabel(
    basis === LEDGER_BASIS.CASH ? periodCash.outPence : statement.operatingExpensesPence,
    basis === LEDGER_BASIS.CASH ? cashTotals(input.movements, previous).outPence : previousStatement.operatingExpensesPence,
  );
  const profitCurrent = basis === LEDGER_BASIS.CASH ? cashMovement : statement.operatingProfitPence;
  const profitPrevious = basis === LEDGER_BASIS.CASH ? cashTotals(input.movements, previous).inPence - cashTotals(input.movements, previous).outPence : previousStatement.operatingProfitPence;
  const profitChange = moneyChangeLabel(profitCurrent, profitPrevious);
  const marginCurrent = basis === LEDGER_BASIS.CASH ? marginBasisPoints(cashMovement, periodCash.inPence) : statement.marginBps;
  const marginPrevious =
    basis === LEDGER_BASIS.CASH
      ? marginBasisPoints(profitPrevious, cashTotals(input.movements, previous).inPence)
      : previousStatement.marginBps;
  const marginChange = pointChangeLabel(marginCurrent, marginPrevious);
  const occupancyChange = pointChangeLabel(portfolio.occupancyBps, previousPortfolio.occupancyBps);
  const adrChange = poundChangeLabel(portfolio.adrPence, previousPortfolio.adrPence);
  const revpanChange = poundChangeLabel(portfolio.revparPence, previousPortfolio.revparPence);
  const cashSeriesPoints = cashSeries(input.movements, input.openingBalancePence, buckets);
  const cleaning = buildCleaning(input.lines, input.bookings, input.properties, period, previous);
  const plotted = properties.filter((property) => property.occupancyBps !== null && property.marginBps !== null);
  const heatmap = heatmapWindow(period, input.today);
  const stays = buildStays(input.bookings, input.properties, input.today);
  const expenseTrend = expenseTrendFor(input.lines, months);
  const actions = groupActions(input.alerts);
  const taxYear = ukTaxYearContaining(input.today);
  const companyYear = companyFinancialYearContaining(input.today, input.financialYearStartMonth, input.financialYearStartDay);
  const upcomingTotal = input.upcoming.reduce((total, item) => total + item.amountPence, 0);
  const accountLabel = input.accountCount === 1 ? "1 account" : `${input.accountCount} accounts`;
  return {
    companyName: input.companyName,
    periodLabel: period.label,
    range: resolved.range,
    basis,
    rangeWarning: resolved.warning,
    customStart: period.start,
    customEnd: addDays(period.endExclusive, -1),
    basisNote:
      basis === LEDGER_BASIS.CASH
        ? "Cash basis uses bank movements for revenue, costs, profit, and the trend. Property, channel, and the profit waterfall stay on the accrual ledger."
        : "Accrual uses service and transaction dates. The bank balance is cash, and it is not operating profit.",
    kpis: [
      {
        id: KPI_ID.REVENUE,
        label: basis === LEDGER_BASIS.CASH ? "Money in" : "Revenue",
        value: formatGbp(basis === LEDGER_BASIS.CASH ? periodCash.inPence : statement.grossRevenuePence),
        secondary: revenueChange.label,
        tone: percentTone(revenueChange.deltaBps, true),
        sparkline: sparkline(trend.map((point) => point.revenuePence)),
        testId: "kpi-revenue",
      },
      {
        id: KPI_ID.COSTS,
        label: basis === LEDGER_BASIS.CASH ? "Money out" : "Operating costs",
        value: formatGbp(basis === LEDGER_BASIS.CASH ? periodCash.outPence : statement.operatingExpensesPence),
        secondary: costChange.label,
        tone: percentTone(costChange.deltaBps, false),
        sparkline: sparkline(trend.map((point) => point.costPence)),
        testId: "kpi-expenses",
      },
      {
        id: KPI_ID.PROFIT,
        label: basis === LEDGER_BASIS.CASH ? "Net cash" : "Operating profit",
        value: formatGbp(profitCurrent),
        secondary: profitChange.label,
        tone: percentTone(profitChange.deltaBps, true),
        sparkline: sparkline(trend.map((point) => point.profitPence)),
        testId: "kpi-profit",
      },
      {
        id: KPI_ID.MARGIN,
        label: basis === LEDGER_BASIS.CASH ? "Cash margin" : "Operating margin",
        value: formatMargin(marginCurrent),
        secondary: marginChange.label,
        tone: percentTone(marginChange.deltaBps, true),
        sparkline: [],
        testId: "kpi-margin",
      },
      {
        id: KPI_ID.BANK,
        label: "Bank balance",
        value: formatGbp(bankPence),
        secondary: `${cashMovement >= 0 ? "+" : "−"}${formatGbp(Math.abs(cashMovement)).replace("-", "")} this period · ${accountLabel}`,
        tone: cashMovement > 0 ? TONE.POSITIVE : cashMovement < 0 ? TONE.NEGATIVE : TONE.NEUTRAL,
        sparkline: sparkline(cashSeriesPoints.map((point) => point.closingPence)),
        testId: "kpi-bank",
      },
      {
        id: KPI_ID.OUTSTANDING,
        label: "Outstanding invoices",
        value: formatGbp(input.outstandingPence),
        secondary: input.overdueInvoiceCount === 0 ? "None overdue" : `${input.overdueInvoiceCount} overdue`,
        tone: input.overdueInvoiceCount > 0 ? TONE.WARNING : TONE.NEUTRAL,
        sparkline: [],
        testId: "kpi-outstanding",
      },
      {
        id: KPI_ID.UPCOMING,
        label: "Upcoming bills",
        value: formatGbp(upcomingTotal),
        secondary: "Next 30 days",
        tone: TONE.NEUTRAL,
        sparkline: [],
        testId: "kpi-upcoming",
      },
      {
        id: KPI_ID.OCCUPANCY,
        label: "Occupancy",
        value: formatMargin(portfolio.occupancyBps),
        secondary: occupancyChange.label,
        tone: percentTone(occupancyChange.deltaBps, true),
        sparkline: sparkline(hospitalityFor(input.lines, input.bookings, input.properties.length, months, input.today).map((point) => point.occupancyBps ?? 0)),
        testId: "kpi-occupancy",
      },
      {
        id: KPI_ID.ADR,
        label: "ADR",
        value: portfolio.adrPence === null ? "—" : formatGbp(portfolio.adrPence),
        secondary: adrChange.label,
        tone: percentTone(adrChange.deltaBps, true),
        sparkline: [],
        testId: "kpi-adr",
      },
      {
        id: KPI_ID.REVPAN,
        label: "RevPAN",
        value: portfolio.revparPence === null ? "—" : formatGbp(portfolio.revparPence),
        secondary: revpanChange.label,
        tone: percentTone(revpanChange.deltaBps, true),
        sparkline: [],
        testId: "kpi-revpan",
      },
    ],
    insights: buildInsights({ current: statement, previous: previousStatement, properties, previousProperties, channels, cleaning }),
    trend,
    trendTitle: basis === LEDGER_BASIS.CASH ? "Money in, money out, and net cash" : "Revenue, costs, and profit",
    waterfall: buildProfitWaterfall({
      grossPence: statement.grossRevenuePence,
      refundsPence: statement.refundsPence,
      commissionPence: fees.commissionPence,
      paymentFeesPence: fees.paymentFeesPence,
      categories: statement.expenseByCategory,
      operatingProfitPence: statement.operatingProfitPence,
    }),
    channels,
    ota: buildOtaDependency(channels),
    composition: compositionFor(input.bookings, months),
    properties: sortProperties(properties, PROPERTY_SORT.PROFIT),
    matrixGuides:
      plotted.length < 2
        ? null
        : {
            occupancyBps: median(plotted.map((property) => property.occupancyBps ?? 0)),
            marginBps: median(plotted.map((property) => property.marginBps ?? 0)),
          },
    comparison: comparisonTable(properties, input.lines, period),
    hospitality: hospitalityFor(input.lines, input.bookings, input.properties.length, months, input.today),
    currentRevpanPence: portfolio.revparPence,
    previousRevpanPence: previousPortfolio.revparPence,
    heatmap: buildHeatmap(input.bookings, input.properties.length, heatmap),
    heatmapCaption: "Colour is the share of properties booked that day. Future days are reservations.",
    stayDates: stays.dates,
    stays: stays.rows,
    lengthOfStay: buildLengthOfStay(input.bookings, period),
    expenses: shareBars(
      statement.expenseByCategory.map((category) => ({
        key: category.code,
        label: category.label,
        amountPence: category.amountPence,
        hrefHint: `/expenses?category=${category.code}`,
      })),
    ),
    expenseTrend: expenseTrend.points,
    expenseTrendKeys: expenseTrend.keys,
    anomalies: buildCostAnomalies({
      lines: input.lines,
      period,
      previous,
      useThreeMonthAverage: resolved.range === DASHBOARD_RANGE.MONTH,
    }),
    cleaning,
    suppliers: [...input.suppliers].sort((left, right) => right.amountPence - left.amountPence).slice(0, SUPPLIER_LIMIT),
    cashSeries: cashSeriesPoints,
    cashWaterfall: buildCashWaterfall(input.openingBalancePence, input.movements, period),
    obligations: input.upcoming,
    obligationsTotalPence: upcomingTotal,
    reconciliation: buildReconciliation(input.movements, input.suggestedMatches),
    payouts: buildPayouts(input.payouts, period),
    receivables: buildAgeing(input.receivables, input.today, "/invoices"),
    payables: buildAgeing(input.payables, input.today, "/expenses"),
    invoiceFunnel: [
      { key: "draft", label: "Draft", count: input.funnel.draft },
      { key: "issued", label: "Sent", count: input.funnel.issued },
      { key: "partial", label: "Part paid", count: input.funnel.partial },
      { key: "paid", label: "Paid", count: input.funnel.paid },
      { key: "overdue", label: "Overdue", count: input.funnel.overdue },
    ],
    vat: input.vat ? projectVatThreshold(input.vat) : null,
    taxTreatment: taxTreatment(statement),
    timeline: {
      taxLabel: taxYear.label,
      taxStart: formatDisplayDate(taxYear.start),
      taxEnd: inclusiveEnd(taxYear),
      taxProgressBps: yearProgress(taxYear, input.today),
      companyLabel: "Company year",
      companyStart: formatDisplayDate(companyYear.start),
      companyEnd: inclusiveEnd(companyYear),
      companyProgressBps: yearProgress(companyYear, input.today),
    },
    compliance: buildCompliance(input.properties, input.documents, input.today),
    actions,
    actionCount: input.alerts.length,
  };
}

export function ledgerWindow(today: IsoDate, period: DatePeriod, previous: DatePeriod): DatePeriod {
  const rollingStart = addDays(today, -365);
  const trailing = trailingMonths(today, 6)[0]?.start ?? period.start;
  const starts = [period.start, previous.start, rollingStart, trailing].sort();
  const ends = [period.endExclusive, previous.endExclusive, addDays(today, CALENDAR_DAYS + 1)].sort();
  return {
    start: starts[0] ?? period.start,
    endExclusive: ends[ends.length - 1] ?? period.endExclusive,
    label: "Dashboard window",
  };
}
