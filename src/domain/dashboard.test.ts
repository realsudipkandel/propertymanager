import { describe, expect, it } from "vitest";

import { ALERT_KIND, BOOKING_PLATFORM, COST_BEHAVIOUR, DOCUMENT_KIND, FULL_BUSINESS_USE_BPS, LEDGER_KIND, PARENT_CATEGORY, RECONCILIATION_STATUS, TAX_CLASSIFICATION } from "@/domain/constants";
import {
  AGEING_BUCKET,
  DASHBOARD_RANGE,
  LEDGER_BASIS,
  PROPERTY_SORT,
  ageingBucketFor,
  assembleDashboard,
  buildAgeing,
  buildChannelPerformance,
  buildCostAnomalies,
  buildLengthOfStay,
  buildOtaDependency,
  buildProfitWaterfall,
  groupActions,
  ledgerWindow,
  occupiedNightCount,
  previousMatchingPeriod,
  projectVatThreshold,
  resolveDashboardPeriod,
  resolveLedgerBasis,
  sortProperties,
  type DashboardBooking,
  type DashboardInput,
  type LedgerBasis,
} from "@/domain/dashboard";
import type { LedgerLine } from "@/domain/reports";
import { VAT_WARNING } from "@/domain/vat";

const TODAY = "2026-10-07";

function line(overrides: Partial<LedgerLine> & Pick<LedgerLine, "kind" | "amountPence" | "categoryCode">): LedgerLine {
  return {
    propertyId: "riverview",
    bookingId: null,
    parentCategoryCode: null,
    channel: null,
    taxClassification: TAX_CLASSIFICATION.ALLOWABLE,
    businessUseBps: FULL_BUSINESS_USE_BPS,
    costBehaviour: COST_BEHAVIOUR.FIXED,
    occurredOn: "2026-10-03",
    label: overrides.categoryCode,
    groupLabel: overrides.groupLabel ?? overrides.categoryCode,
    ...overrides,
  };
}

function booking(overrides: Partial<DashboardBooking> = {}): DashboardBooking {
  return {
    propertyId: "riverview",
    propertyName: "Riverview",
    platform: BOOKING_PLATFORM.AIRBNB,
    checkIn: "2026-10-01",
    checkOut: "2026-10-04",
    nights: 3,
    guest: "John Smith",
    accommodationPence: 25_000,
    cleaningPence: 3_000,
    extraGuestPence: 0,
    parkingPence: 2_000,
    otherPence: 0,
    grossPence: 30_000,
    commissionPence: 3_000,
    processingPence: 200,
    ...overrides,
  };
}

function input(overrides: Partial<DashboardInput> = {}): DashboardInput {
  return {
    companyName: "Mira Properties",
    today: TODAY,
    range: DASHBOARD_RANGE.MONTH,
    basis: LEDGER_BASIS.ACCRUAL,
    financialYearStartMonth: 9,
    financialYearStartDay: 1,
    lines: [],
    bookings: [],
    properties: [
      { id: "riverview", name: "Riverview" },
      { id: "windsor", name: "Windsor" },
    ],
    accountCount: 2,
    openingBalancePence: 100_000,
    movements: [],
    receivables: [],
    payables: [],
    outstandingPence: 0,
    overdueInvoiceCount: 0,
    funnel: { draft: 1, issued: 2, partial: 0, paid: 3, overdue: 0 },
    payouts: [],
    suggestedMatches: 0,
    upcoming: [],
    suppliers: [],
    documents: [],
    alerts: [],
    vat: null,
    ...overrides,
  };
}

describe("dashboard periods", () => {
  it("resolves each preset and rejects a custom range that is backwards or too long", () => {
    const month = resolveDashboardPeriod({ range: undefined, today: TODAY, financialYearStartMonth: 9, financialYearStartDay: 1 });
    expect(month.range).toBe(DASHBOARD_RANGE.MONTH);
    expect(month.period.start).toBe("2026-10-01");
    expect(resolveDashboardPeriod({ range: "nope", today: TODAY, financialYearStartMonth: 9, financialYearStartDay: 1 }).range).toBe(DASHBOARD_RANGE.MONTH);
    expect(resolveDashboardPeriod({ range: DASHBOARD_RANGE.SEVEN_DAYS, today: TODAY, financialYearStartMonth: 9, financialYearStartDay: 1 }).period).toMatchObject({
      start: "2026-10-01",
      endExclusive: "2026-10-08",
    });
    expect(resolveDashboardPeriod({ range: DASHBOARD_RANGE.THIRTY_DAYS, today: TODAY, financialYearStartMonth: 9, financialYearStartDay: 1 }).period.start).toBe("2026-09-08");
    expect(resolveDashboardPeriod({ range: DASHBOARD_RANGE.QUARTER, today: TODAY, financialYearStartMonth: 9, financialYearStartDay: 1 }).period.label).toBe("Q4 2026");
    expect(resolveDashboardPeriod({ range: DASHBOARD_RANGE.TAX_YEAR, today: TODAY, financialYearStartMonth: 9, financialYearStartDay: 1 }).period.start).toBe("2026-04-06");
    expect(resolveDashboardPeriod({ range: DASHBOARD_RANGE.COMPANY_YEAR, today: TODAY, financialYearStartMonth: 9, financialYearStartDay: 1 }).period.start).toBe("2026-09-01");
    const custom = resolveDashboardPeriod({
      range: DASHBOARD_RANGE.CUSTOM,
      today: TODAY,
      financialYearStartMonth: 9,
      financialYearStartDay: 1,
      customStart: "2026-10-01",
      customEnd: "2026-10-07",
    });
    expect(custom.period.endExclusive).toBe("2026-10-08");
    const rejected = resolveDashboardPeriod({
      range: DASHBOARD_RANGE.CUSTOM,
      today: TODAY,
      financialYearStartMonth: 9,
      financialYearStartDay: 1,
      customStart: "2026-10-08",
      customEnd: "2026-10-01",
    });
    expect(rejected.warning).toContain("could not be used");
    const tooLong = resolveDashboardPeriod({
      range: DASHBOARD_RANGE.CUSTOM,
      today: TODAY,
      financialYearStartMonth: 9,
      financialYearStartDay: 1,
      customStart: "2020-01-01",
      customEnd: "2026-10-07",
    });
    expect(tooLong.range).toBe(DASHBOARD_RANGE.MONTH);
    expect(resolveLedgerBasis("cash")).toBe(LEDGER_BASIS.CASH);
    expect(resolveLedgerBasis(undefined)).toBe(LEDGER_BASIS.ACCRUAL);
    const previous = previousMatchingPeriod(month.period);
    expect(previous.endExclusive).toBe(month.period.start);
    const window = ledgerWindow(TODAY, month.period, previous);
    expect(window.start).toBe("2025-10-07");
  });
});

describe("dashboard visuals", () => {
  const octoberLines: LedgerLine[] = [
    line({ kind: LEDGER_KIND.INCOME, amountPence: 80_000, categoryCode: "AIRBNB_BOOKING", parentCategoryCode: PARENT_CATEGORY.ACCOMMODATION, groupLabel: "Accommodation" }),
    line({ kind: LEDGER_KIND.REFUND, amountPence: 5_000, categoryCode: "REFUND", groupLabel: "Refund" }),
    line({ kind: LEDGER_KIND.EXPENSE, amountPence: 8_000, categoryCode: "AIRBNB_HOST_FEE", parentCategoryCode: PARENT_CATEGORY.PLATFORM_FEES, groupLabel: "Booking platform fees", costBehaviour: COST_BEHAVIOUR.VARIABLE }),
    line({ kind: LEDGER_KIND.EXPENSE, amountPence: 1_000, categoryCode: "PAYMENT_PROCESSING", parentCategoryCode: PARENT_CATEGORY.PLATFORM_FEES, groupLabel: "Booking platform fees", costBehaviour: COST_BEHAVIOUR.VARIABLE }),
    line({ kind: LEDGER_KIND.EXPENSE, amountPence: 20_000, categoryCode: "RENT", parentCategoryCode: PARENT_CATEGORY.PROPERTY_RENT, groupLabel: "Property rent" }),
    line({ kind: LEDGER_KIND.EXPENSE, amountPence: 4_200, categoryCode: "CLEANING", parentCategoryCode: PARENT_CATEGORY.CLEANING, groupLabel: "Cleaning", costBehaviour: COST_BEHAVIOUR.VARIABLE }),
    line({ kind: LEDGER_KIND.EXPENSE, amountPence: 20_000, categoryCode: "ELECTRICITY", parentCategoryCode: PARENT_CATEGORY.UTILITIES, label: "Electricity", groupLabel: "Utilities", occurredOn: "2026-10-04" }),
    line({ kind: LEDGER_KIND.EXPENSE, amountPence: 2_000, categoryCode: "ELECTRICITY", parentCategoryCode: PARENT_CATEGORY.UTILITIES, label: "Electricity", groupLabel: "Utilities", occurredOn: "2026-07-15" }),
    line({ kind: LEDGER_KIND.EXPENSE, amountPence: 2_000, categoryCode: "ELECTRICITY", parentCategoryCode: PARENT_CATEGORY.UTILITIES, label: "Electricity", groupLabel: "Utilities", occurredOn: "2026-08-15" }),
    line({ kind: LEDGER_KIND.EXPENSE, amountPence: 2_000, categoryCode: "ELECTRICITY", parentCategoryCode: PARENT_CATEGORY.UTILITIES, label: "Electricity", groupLabel: "Utilities", occurredOn: "2026-09-15" }),
    line({ kind: LEDGER_KIND.EXPENSE, amountPence: 1_000, categoryCode: "CLIENT", parentCategoryCode: PARENT_CATEGORY.ENTERTAINMENT, groupLabel: "Entertaining", taxClassification: TAX_CLASSIFICATION.DISALLOWABLE }),
    line({ kind: LEDGER_KIND.EXPENSE, amountPence: 3_000, categoryCode: "REVIEW", parentCategoryCode: PARENT_CATEGORY.PROFESSIONAL_FEES, groupLabel: "Professional fees", taxClassification: TAX_CLASSIFICATION.ACCOUNTANT_REVIEW }),
  ];

  it("turns a ledger into profit, channel, property, cash, tax, and attention", () => {
    const view = assembleDashboard(input({
      lines: octoberLines,
      bookings: [
        booking(),
        booking({
          propertyId: "windsor",
          propertyName: "Windsor",
          platform: BOOKING_PLATFORM.DIRECT_WEBSITE,
          checkIn: "2026-10-02",
          checkOut: "2026-10-06",
          nights: 4,
          guest: "Amira Khan",
          accommodationPence: 40_000,
          cleaningPence: 0,
          parkingPence: 0,
          grossPence: 40_000,
          commissionPence: 0,
          processingPence: 0,
        }),
      ],
      movements: [
        { occurredOn: "2026-09-02", direction: "CREDIT", amountPence: 10_000, status: RECONCILIATION_STATUS.MATCHED, payoutPlatform: null },
        { occurredOn: "2026-10-03", direction: "CREDIT", amountPence: 50_000, status: RECONCILIATION_STATUS.UNMATCHED, payoutPlatform: BOOKING_PLATFORM.AIRBNB },
        { occurredOn: "2026-10-04", direction: "DEBIT", amountPence: 12_000, status: RECONCILIATION_STATUS.UNMATCHED, payoutPlatform: null },
        { occurredOn: "2026-10-05", direction: "CREDIT", amountPence: 4_000, status: RECONCILIATION_STATUS.PARTIALLY_MATCHED, payoutPlatform: null },
      ],
      receivables: [
        { dueOn: "2026-10-20", balancePence: 1_900 },
        { dueOn: "2026-09-20", balancePence: 1_100 },
        { dueOn: "2026-08-20", balancePence: 400 },
        { dueOn: "2026-07-20", balancePence: 180 },
        { dueOn: "2026-06-01", balancePence: 650 },
        { dueOn: "2026-06-01", balancePence: 0 },
      ],
      payables: [{ dueOn: "2026-10-11", balancePence: 2_150 }],
      outstandingPence: 4_230,
      overdueInvoiceCount: 4,
      payouts: [
        { id: "payout-1", platform: BOOKING_PLATFORM.AIRBNB, reference: "PO-1", amountPence: 50_000, allocatedPence: 50_000, paidOn: "2026-10-03" },
        { id: "payout-2", platform: BOOKING_PLATFORM.AIRBNB, reference: "PO-2", amountPence: 18_242, allocatedPence: 18_042, paidOn: "2026-10-04" },
      ],
      suggestedMatches: 1,
      upcoming: [{ dateLabel: "11 Oct 2026", name: "Riverview rent", amountPence: 215_000 }],
      suppliers: [{ id: "clean", name: "ABC Cleaning", amountPence: 4_200 }],
      documents: [
        { propertyId: "riverview", kind: DOCUMENT_KIND.INSURANCE, expiresOn: "2026-10-20" },
        { propertyId: "riverview", kind: DOCUMENT_KIND.COMPLIANCE_CERTIFICATE, expiresOn: "2026-09-01" },
      ],
      alerts: [
        { kind: ALERT_KIND.INVOICE_OVERDUE, title: "Invoice overdue", detail: "4 customer invoices past the due date." },
        { kind: ALERT_KIND.BANK_UNMATCHED, title: "Bank transaction unmatched", detail: "2 bank transactions still unmatched." },
        { kind: ALERT_KIND.VAT_THRESHOLD_APPROACHING, title: "VAT threshold approaching", detail: "Turnover has reached 80% of the configured VAT registration threshold." },
      ],
      vat: { rollingTurnoverPence: 7_200_000, thresholdPence: 9_000_000, utilisationBps: 8_000, warning: VAT_WARNING.APPROACHING },
    }));

    expect(view.companyName).toBe("Mira Properties");
    expect(view.kpis.find((card) => card.id === "revenue")?.value).toBe("£800");
    expect(view.kpis.find((card) => card.id === "profit")?.value).toContain("£");
    expect(view.waterfall[view.waterfall.length - 1]?.label).toBe("Operating profit");
    expect(view.waterfall.find((step) => step.key === "commission")?.amountPence).toBe(-8_000);
    expect(view.waterfall.find((step) => step.key === "payment-fees")?.amountPence).toBe(-1_000);
    expect(view.channels[0]?.label).toBe("Direct website");
    expect(view.channels.find((channel) => channel.platform === BOOKING_PLATFORM.AIRBNB)?.adrPence).toBe(Math.round(25_000 / 3));
    expect(view.ota.statement).toContain("third-party");
    expect(view.properties[0]?.id).toBe("riverview");
    expect(view.receivables.find((row) => row.key === AGEING_BUCKET.DAYS_90_PLUS)?.amountPence).toBe(650);
    expect(view.receivables.find((row) => row.key === AGEING_BUCKET.CURRENT)?.tone).toBe("neutral");
    expect(view.anomalies.some((anomaly) => anomaly.code === "ELECTRICITY")).toBe(true);
    expect(view.anomalies[0]?.detail).toContain("three-month average");
    expect(view.payouts[0]?.balanced).toBe(false);
    expect(view.payouts.some((payout) => payout.balanced)).toBe(true);
    expect(view.reconciliation.matched).toBe(1);
    expect(view.reconciliation.suggested).toBe(1);
    expect(view.reconciliation.needsReview).toBe(2);
    expect(view.vat?.monthsToThreshold).toBe(3);
    expect(view.vat?.narrative).toContain("£18,000");
    expect(view.taxTreatment.some((row) => row.key === TAX_CLASSIFICATION.ACCOUNTANT_REVIEW && row.tone === "warning")).toBe(true);
    expect(view.compliance.missing).toBeGreaterThan(0);
    expect(view.compliance.expired).toBe(1);
    expect(view.compliance.expiring).toBe(1);
    expect(view.actions[0]?.id).toBe("critical");
    expect(view.insights.length).toBeGreaterThan(0);
    expect(view.lengthOfStay.find((row) => row.label === "4–7 nights")?.amountPence).toBe(1);
    expect(view.heatmap.length).toBeGreaterThan(0);
    expect(view.stays).toHaveLength(2);
    expect(view.timeline.taxStart).toBe("6 Apr 2026");
    expect(view.basisNote).toContain("Accrual");
  });

  it("switches the headline to bank movements without hiding accrual profit", () => {
    const view = assembleDashboard(input({
      basis: LEDGER_BASIS.CASH,
      lines: octoberLines,
      movements: [
        { occurredOn: "2026-10-02", direction: "CREDIT", amountPence: 40_000, status: RECONCILIATION_STATUS.RECONCILED, payoutPlatform: null },
        { occurredOn: "2026-10-03", direction: "DEBIT", amountPence: 15_000, status: RECONCILIATION_STATUS.MATCHED, payoutPlatform: null },
      ],
    }));
    expect(view.basis).toBe(LEDGER_BASIS.CASH);
    expect(view.kpis.find((card) => card.id === "revenue")?.label).toBe("Money in");
    expect(view.kpis.find((card) => card.id === "revenue")?.value).toBe("£400");
    expect(view.kpis.find((card) => card.id === "profit")?.value).toBe("£250");
    expect(view.trendTitle).toContain("Money in");
    expect(view.waterfall.some((step) => step.key === "gross")).toBe(true);
    expect(view.cashWaterfall.some((step) => step.key === "closing")).toBe(true);
  });

  it("counts an occupied night once when two stays overlap", () => {
    const nights = occupiedNightCount(
      [
        booking({ checkIn: "2026-10-01", checkOut: "2026-10-03", nights: 2 }),
        booking({ checkIn: "2026-10-02", checkOut: "2026-10-04", nights: 2 }),
      ],
      { start: "2026-10-01", endExclusive: "2026-10-08", label: "week" },
    );
    expect(nights).toBe(3);
  });

  it("sorts properties with missing rates last", () => {
    const rows = sortProperties(
      [
        { id: "a", name: "A", revenuePence: 10, profitPence: 1, marginBps: null, occupancyBps: null, adrPence: null, revpanPence: null },
        { id: "b", name: "B", revenuePence: 5, profitPence: 4, marginBps: 2_000, occupancyBps: 5_000, adrPence: 100, revpanPence: 80 },
      ],
      PROPERTY_SORT.MARGIN,
    );
    expect(rows[0]?.id).toBe("b");
    expect(sortProperties(rows, PROPERTY_SORT.ADR)[0]?.id).toBe("b");
    expect(sortProperties(rows, PROPERTY_SORT.REVPAN)[0]?.id).toBe("b");
    expect(sortProperties(rows, PROPERTY_SORT.OCCUPANCY)[0]?.id).toBe("b");
    expect(sortProperties(rows, PROPERTY_SORT.REVENUE)[0]?.id).toBe("a");
  });
});

describe("dashboard measures", () => {
  it("foots the waterfall to operating profit", () => {
    const steps = buildProfitWaterfall({
      grossPence: 24_800,
      refundsPence: 380,
      commissionPence: 3_100,
      paymentFeesPence: 420,
      categories: [{ code: PARENT_CATEGORY.PROPERTY_RENT, label: "Rent", amountPence: 7_000 }],
      operatingProfitPence: 13_900,
    });
    expect(steps[steps.length - 1]?.amountPence).toBe(13_900);
    expect(steps.find((step) => step.key === "net")?.amountPence).toBe(24_800 - 380 - 3_100 - 420);
  });

  it("adds a plug when the categories do not explain profit", () => {
    const steps = buildProfitWaterfall({
      grossPence: 10_000,
      refundsPence: 0,
      commissionPence: 0,
      paymentFeesPence: 0,
      categories: [],
      operatingProfitPence: 8_000,
    });
    expect(steps.some((step) => step.key === "other-recognised")).toBe(true);
  });

  it("keeps channel ADR as accommodation over nights and flags OTA dependence", () => {
    const channels = buildChannelPerformance(
      [
        booking({ accommodationPence: 10_000, nights: 2, grossPence: 12_000, commissionPence: 1_000, processingPence: 200 }),
        booking({ accommodationPence: 20_000, nights: 2, grossPence: 20_000, commissionPence: 0, processingPence: 0, checkIn: "2026-10-05" }),
      ],
      { start: "2026-10-01", endExclusive: "2026-11-01", label: "October" },
    );
    expect(channels[0]?.adrPence).toBe(7_500);
    expect(channels[0]?.feeBps).toBe(Math.round((1_200 * 10_000) / 32_000));
    const dependency = buildOtaDependency(channels);
    expect(dependency.otaShareBps).toBe(10_000);
    expect(buildOtaDependency([]).statement).toBeNull();
  });

  it("places ageing balances, including 90 days and a zero balance", () => {
    expect(ageingBucketFor("2026-10-07", "2026-10-07")).toBe(AGEING_BUCKET.CURRENT);
    expect(ageingBucketFor("2026-09-20", "2026-10-07")).toBe(AGEING_BUCKET.DAYS_1_30);
    expect(ageingBucketFor("2026-09-01", "2026-10-07")).toBe(AGEING_BUCKET.DAYS_31_60);
    expect(ageingBucketFor("2026-08-01", "2026-10-07")).toBe(AGEING_BUCKET.DAYS_61_90);
    expect(ageingBucketFor("2026-06-01", "2026-10-07")).toBe(AGEING_BUCKET.DAYS_90_PLUS);
    const rows = buildAgeing([{ dueOn: "2026-06-01", balancePence: 0 }], TODAY, "/invoices");
    expect(rows.every((row) => row.amountPence === 0)).toBe(true);
  });

  it("projects the VAT threshold from the configured amount", () => {
    const approaching = projectVatThreshold({
      rollingTurnoverPence: 7_200_000,
      thresholdPence: 9_000_000,
      utilisationBps: 8_000,
      warning: VAT_WARNING.APPROACHING,
    });
    expect(approaching.monthsToThreshold).toBe(3);
    expect(approaching.remainingPence).toBe(1_800_000);
    const exceeded = projectVatThreshold({
      rollingTurnoverPence: 9_100_000,
      thresholdPence: 9_000_000,
      utilisationBps: 10_111,
      warning: VAT_WARNING.EXCEEDED,
    });
    expect(exceeded.monthsToThreshold).toBeNull();
    expect(exceeded.narrative).toContain("over");
    const empty = projectVatThreshold({
      rollingTurnoverPence: 0,
      thresholdPence: 9_000_000,
      utilisationBps: 0,
      warning: VAT_WARNING.NONE,
    });
    expect(empty.monthsToThreshold).toBeNull();
    const exact = projectVatThreshold({
      rollingTurnoverPence: 9_000_000,
      thresholdPence: 9_000_000,
      utilisationBps: 10_000,
      warning: VAT_WARNING.NONE,
    });
    expect(exact.narrative).toContain("on the configured");
  });

  it("flags a cost only when it is at least 25% above the baseline", () => {
    const lines = [
      line({ kind: LEDGER_KIND.EXPENSE, amountPence: 12_500, categoryCode: "RENT", parentCategoryCode: PARENT_CATEGORY.PROPERTY_RENT, groupLabel: "Property rent", occurredOn: "2026-10-02" }),
      line({ kind: LEDGER_KIND.EXPENSE, amountPence: 10_000, categoryCode: "RENT", parentCategoryCode: PARENT_CATEGORY.PROPERTY_RENT, groupLabel: "Property rent", occurredOn: "2026-09-02" }),
      line({ kind: LEDGER_KIND.EXPENSE, amountPence: 12_400, categoryCode: "CLEANING", parentCategoryCode: PARENT_CATEGORY.CLEANING, groupLabel: "Cleaning", occurredOn: "2026-10-02" }),
      line({ kind: LEDGER_KIND.EXPENSE, amountPence: 10_000, categoryCode: "CLEANING", parentCategoryCode: PARENT_CATEGORY.CLEANING, groupLabel: "Cleaning", occurredOn: "2026-09-02" }),
    ];
    const period = { start: "2026-10-01", endExclusive: "2026-11-01", label: "October" };
    const previous = { start: "2026-09-01", endExclusive: "2026-10-01", label: "September" };
    const anomalies = buildCostAnomalies({ lines, period, previous, useThreeMonthAverage: false });
    expect(anomalies.map((anomaly) => anomaly.code)).toContain(PARENT_CATEGORY.PROPERTY_RENT);
    expect(anomalies.map((anomaly) => anomaly.code)).not.toContain(PARENT_CATEGORY.CLEANING);
  });

  it("buckets length of stay without double counting seven nights", () => {
    const rows = buildLengthOfStay(
      [
        booking({ nights: 1, checkOut: "2026-10-02" }),
        booking({ nights: 2, checkIn: "2026-10-02", checkOut: "2026-10-04" }),
        booking({ nights: 3, checkIn: "2026-10-04", checkOut: "2026-10-07" }),
        booking({ nights: 7, checkIn: "2026-10-08", checkOut: "2026-10-15" }),
        booking({ nights: 8, checkIn: "2026-10-16", checkOut: "2026-10-24" }),
      ],
      { start: "2026-10-01", endExclusive: "2026-11-01", label: "October" },
    );
    expect(rows.map((row) => row.amountPence)).toEqual([1, 1, 1, 1, 1]);
  });

  it("orders the action centre with critical items first", () => {
    const groups = groupActions([
      { kind: ALERT_KIND.UTILITY_INCREASE, title: "Utilities", detail: "Up" },
      { kind: ALERT_KIND.INVOICE_OVERDUE, title: "Overdue", detail: "Late" },
      { kind: ALERT_KIND.CERTIFICATE_EXPIRING, title: "Certificate", detail: "Soon" },
    ]);
    expect(groups.map((group) => group.id)).toEqual(["critical", "property", "cost"]);
  });

  it("uses cash margin tone when there is no earlier cash", () => {
    const view = assembleDashboard(input({
      basis: "other" as LedgerBasis,
      range: DASHBOARD_RANGE.SEVEN_DAYS,
      movements: [],
    }));
    expect(view.basis).toBe(LEDGER_BASIS.ACCRUAL);
    expect(view.kpis.find((card) => card.id === "bank")?.secondary).toContain("2 accounts");
  });
});
