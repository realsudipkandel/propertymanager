import { describe, expect, it } from "vitest";

import { bookingContributionPence, calculateBookingFinancials } from "@/domain/accounting";
import { buildAlerts } from "@/domain/alerts";
import { CATALOG } from "@/domain/catalog";
import {
  COST_BEHAVIOUR,
  DEPOSIT_STATUS,
  FULL_BUSINESS_USE_BPS,
  LEDGER_KIND,
  PARENT_CATEGORY,
  TAX_CLASSIFICATION,
  USER_ROLE,
} from "@/domain/constants";
import { parseBankCsv, serialiseCsv } from "@/domain/csv";
import {
  calendarMonthContaining,
  companyFinancialYearContaining,
  nightsBetween,
  ukTaxYearContaining,
} from "@/domain/dates";
import { revenueFromDeposit } from "@/domain/deposits";
import { extensionAllowed, resolveStoragePath } from "@/domain/files";
import { ageingBucket, applyPayment, invoiceCollectionStatus } from "@/domain/invoices";
import { calculatePropertyKpis } from "@/domain/kpis";
import { applyBasisPoints, formatGbp, formatMargin, marginBasisPoints, parsePoundsToPence } from "@/domain/money";
import { canConfigureBank, canManageSettings, canMutateFinance, canViewTax } from "@/domain/permissions";
import { isExactAllocation, suggestUniqueAmountMatch } from "@/domain/reconciliation";
import { buildProfitAndLoss, linesForProperty, revenueByChannel, type LedgerLine } from "@/domain/reports";
import { decryptSecret, encryptSecret, encryptionKeyFromHex, maskAccountNumber } from "@/domain/secrets";
import { assessVatThreshold, activeTaxConfig, VAT_WARNING } from "@/domain/vat";

function line(overrides: Partial<LedgerLine> & Pick<LedgerLine, "kind" | "amountPence" | "categoryCode">): LedgerLine {
  return {
    propertyId: "riverview",
    bookingId: null,
    parentCategoryCode: null,
    channel: null,
    taxClassification: TAX_CLASSIFICATION.ALLOWABLE,
    businessUseBps: FULL_BUSINESS_USE_BPS,
    costBehaviour: COST_BEHAVIOUR.FIXED,
    occurredOn: "2026-09-15",
    label: overrides.categoryCode,
    groupLabel: overrides.categoryCode,
    ...overrides,
  };
}

describe("booking financials", () => {
  it("keeps gross revenue, platform fee, and payout separate", () => {
    const result = calculateBookingFinancials({
      accommodationPence: 50_000,
      cleaningFeePence: 7_000,
      extraGuestPence: 0,
      parkingPence: 3_000,
      otherRevenuePence: 0,
      platformCommissionPence: 1_800,
      paymentProcessingFeePence: 0,
      refundsPence: 0,
      adjustmentsPence: 0,
    });
    expect(result.grossRevenuePence).toBe(60_000);
    expect(result.platformCostsPence).toBe(1_800);
    expect(result.netPayoutPence).toBe(58_200);
    expect(result.grossRevenuePence).not.toBe(result.netPayoutPence);
  });

  it("treats a refund as a deduction from cash, not from gross revenue", () => {
    const result = calculateBookingFinancials({
      accommodationPence: 100_000,
      cleaningFeePence: 0,
      extraGuestPence: 0,
      parkingPence: 0,
      otherRevenuePence: 0,
      platformCommissionPence: 3_000,
      paymentProcessingFeePence: 0,
      refundsPence: 5_000,
      adjustmentsPence: 0,
    });
    expect(result.grossRevenuePence).toBe(100_000);
    expect(result.netPayoutPence).toBe(92_000);
  });

  it("rejects negative components and inverted stays", () => {
    expect(() =>
      calculateBookingFinancials({
        accommodationPence: -1,
        cleaningFeePence: 0,
        extraGuestPence: 0,
        parkingPence: 0,
        otherRevenuePence: 0,
        platformCommissionPence: 0,
        paymentProcessingFeePence: 0,
        refundsPence: 0,
        adjustmentsPence: 0,
      }),
    ).toThrow(/negative/i);
    expect(() => nightsBetween("2026-09-15", "2026-09-12")).toThrow(/check-out/i);
  });

  it("calculates booking contribution after direct costs", () => {
    expect(
      bookingContributionPence({
        grossRevenuePence: 60_000,
        platformCostsPence: 1_800,
        refundsPence: 0,
        directCostsPence: 5_500 + 1_500 + 800,
      }),
    ).toBe(50_400);
  });
});

describe("profit and loss", () => {
  const riverview = "riverview";

  function septemberFixture(): LedgerLine[] {
    return [
      line({ kind: LEDGER_KIND.INCOME, amountPence: 680_000, categoryCode: "ACCOMMODATION", label: "Accommodation", propertyId: riverview }),
      line({ kind: LEDGER_KIND.INCOME, amountPence: 60_000, categoryCode: "CLEANING_FEE", label: "Cleaning fees", propertyId: riverview }),
      line({ kind: LEDGER_KIND.INCOME, amountPence: 15_000, categoryCode: "PARKING_FEE", label: "Parking", propertyId: riverview }),
      line({ kind: LEDGER_KIND.INCOME, amountPence: 10_000, categoryCode: "OTHER", label: "Other", propertyId: riverview }),
      line({
        kind: LEDGER_KIND.EXPENSE,
        amountPence: 54_000,
        categoryCode: "AIRBNB_HOST_FEE",
        parentCategoryCode: PARENT_CATEGORY.PLATFORM_FEES,
        groupLabel: "Booking platform fees",
        costBehaviour: COST_BEHAVIOUR.VARIABLE,
        propertyId: riverview,
      }),
      line({
        kind: LEDGER_KIND.EXPENSE,
        amountPence: 62_000,
        categoryCode: "CLEANING",
        parentCategoryCode: PARENT_CATEGORY.CLEANING,
        groupLabel: "Cleaning",
        costBehaviour: COST_BEHAVIOUR.VARIABLE,
        propertyId: riverview,
      }),
      line({
        kind: LEDGER_KIND.EXPENSE,
        amountPence: 18_000,
        categoryCode: "LAUNDRY",
        parentCategoryCode: PARENT_CATEGORY.LAUNDRY_LINEN,
        groupLabel: "Laundry and linen",
        costBehaviour: COST_BEHAVIOUR.VARIABLE,
        propertyId: riverview,
      }),
      line({
        kind: LEDGER_KIND.EXPENSE,
        amountPence: 11_000,
        categoryCode: "CONSUMABLES",
        parentCategoryCode: PARENT_CATEGORY.GUEST_CONSUMABLES,
        groupLabel: "Guest consumables",
        costBehaviour: COST_BEHAVIOUR.VARIABLE,
        propertyId: riverview,
      }),
      line({ kind: LEDGER_KIND.EXPENSE, amountPence: 185_000, categoryCode: "RENT", parentCategoryCode: PARENT_CATEGORY.PROPERTY_RENT, groupLabel: "Property rent", propertyId: riverview }),
      line({ kind: LEDGER_KIND.EXPENSE, amountPence: 18_000, categoryCode: "COUNCIL_TAX", parentCategoryCode: PARENT_CATEGORY.UTILITIES, groupLabel: "Utilities", propertyId: riverview }),
      line({ kind: LEDGER_KIND.EXPENSE, amountPence: 14_000, categoryCode: "ELECTRICITY", parentCategoryCode: PARENT_CATEGORY.UTILITIES, groupLabel: "Utilities", propertyId: riverview }),
      line({ kind: LEDGER_KIND.EXPENSE, amountPence: 9_000, categoryCode: "GAS", parentCategoryCode: PARENT_CATEGORY.UTILITIES, groupLabel: "Utilities", propertyId: riverview }),
      line({ kind: LEDGER_KIND.EXPENSE, amountPence: 4_500, categoryCode: "WATER", parentCategoryCode: PARENT_CATEGORY.UTILITIES, groupLabel: "Utilities", propertyId: riverview }),
      line({ kind: LEDGER_KIND.EXPENSE, amountPence: 3_500, categoryCode: "BROADBAND", parentCategoryCode: PARENT_CATEGORY.UTILITIES, groupLabel: "Utilities", propertyId: riverview }),
      line({ kind: LEDGER_KIND.EXPENSE, amountPence: 5_000, categoryCode: "INSURANCE", parentCategoryCode: PARENT_CATEGORY.INSURANCE, groupLabel: "Insurance", propertyId: riverview }),
    ];
  }

  it("matches the Riverview September worked example", () => {
    const result = buildProfitAndLoss(septemberFixture());
    expect(result.grossRevenuePence).toBe(765_000);
    expect(result.otaFeesPence + result.variableCostsPence).toBe(145_000);
    expect(result.fixedCostsPence).toBe(239_000);
    expect(result.operatingExpensesPence).toBe(384_000);
    expect(result.operatingProfitPence).toBe(381_000);
    expect(result.marginBps).toBe(4980);
    expect(formatMargin(result.marginBps)).toBe("49.8%");
  });

  it("does not treat a bank payout as revenue", () => {
    const result = buildProfitAndLoss([
      line({ kind: LEDGER_KIND.INCOME, amountPence: 60_000, categoryCode: "AIRBNB_BOOKING" }),
      line({
        kind: LEDGER_KIND.EXPENSE,
        amountPence: 1_800,
        categoryCode: "AIRBNB_HOST_FEE",
        parentCategoryCode: PARENT_CATEGORY.PLATFORM_FEES,
        costBehaviour: COST_BEHAVIOUR.VARIABLE,
      }),
    ]);
    expect(result.grossRevenuePence).toBe(60_000);
    expect(result.otaFeesPence).toBe(1_800);
    expect(result.operatingProfitPence).toBe(58_200);
  });

  it("removes refunds from net revenue and keeps capital off operating profit", () => {
    const result = buildProfitAndLoss([
      line({ kind: LEDGER_KIND.INCOME, amountPence: 100_000, categoryCode: "AIRBNB_BOOKING" }),
      line({ kind: LEDGER_KIND.REFUND, amountPence: 5_000, categoryCode: "REFUND" }),
      line({
        kind: LEDGER_KIND.EXPENSE,
        amountPence: 40_000,
        categoryCode: "SOFA",
        parentCategoryCode: PARENT_CATEGORY.FURNITURE,
        taxClassification: TAX_CLASSIFICATION.CAPITAL,
      }),
      line({
        kind: LEDGER_KIND.EXPENSE,
        amountPence: 2_000,
        categoryCode: "CLIENT_ENTERTAINING",
        parentCategoryCode: PARENT_CATEGORY.ENTERTAINMENT,
        taxClassification: TAX_CLASSIFICATION.DISALLOWABLE,
        costBehaviour: COST_BEHAVIOUR.COMPANY,
        propertyId: null,
      }),
      line({
        kind: LEDGER_KIND.EXPENSE,
        amountPence: 10_000,
        categoryCode: "MILEAGE",
        businessUseBps: 5_000,
        taxClassification: TAX_CLASSIFICATION.PARTIALLY_ALLOWABLE,
        costBehaviour: COST_BEHAVIOUR.COMPANY,
        propertyId: null,
      }),
    ]);
    expect(result.netRevenuePence).toBe(95_000);
    expect(result.capitalExpenditurePence).toBe(40_000);
    expect(result.operatingExpensesPence).toBe(7_000);
    expect(result.disallowablePence).toBe(2_000);
    expect(result.deductibleExpensesPence).toBe(5_000);
    expect(result.operatingProfitPence).toBe(88_000);
  });

  it("filters a property and ignores another property", () => {
    const lines = [
      line({ kind: LEDGER_KIND.INCOME, amountPence: 10_000, categoryCode: "A", propertyId: "a" }),
      line({ kind: LEDGER_KIND.INCOME, amountPence: 99_000, categoryCode: "B", propertyId: "b" }),
    ];
    expect(buildProfitAndLoss(linesForProperty(lines, "a")).grossRevenuePence).toBe(10_000);
  });

  it("returns a null margin when revenue is zero", () => {
    expect(buildProfitAndLoss([]).marginBps).toBeNull();
    expect(formatMargin(null)).toBe("—");
  });

  it("summarises channels without folding fees into revenue", () => {
    const rows = revenueByChannel([
      { channel: "Airbnb", grossRevenuePence: 1_450_000, platformCostsPence: 105_000 },
      { channel: "Airbnb", grossRevenuePence: 0, platformCostsPence: 0 },
      { channel: "Booking.com", grossRevenuePence: 540_000, platformCostsPence: 81_000 },
    ]);
    expect(rows[0]).toMatchObject({ channel: "Airbnb", revenuePence: 1_450_000, feesPence: 105_000, bookings: 2 });
  });
});

describe("kpis and vat", () => {
  it("calculates ADR as accommodation revenue over occupied nights", () => {
    const kpis = calculatePropertyKpis({
      availableNights: 30,
      occupiedNights: 20,
      accommodationRevenuePence: 200_000,
      grossRevenuePence: 220_000,
      bookingCount: 5,
      cleaningCostPence: 25_000,
      otaFeesPence: 11_000,
      operatingProfitPence: 80_000,
    });
    expect(kpis.adrPence).toBe(10_000);
    expect(kpis.revparPence).toBe(6_667);
    expect(kpis.occupancyBps).toBe(6_667);
    expect(kpis.averageStayNights).toBe(4);
  });

  it("does not divide by zero nights or bookings", () => {
    const kpis = calculatePropertyKpis({
      availableNights: 0,
      occupiedNights: 0,
      accommodationRevenuePence: 0,
      grossRevenuePence: 0,
      bookingCount: 0,
      cleaningCostPence: 0,
      otaFeesPence: 0,
      operatingProfitPence: 0,
    });
    expect(kpis.adrPence).toBeNull();
    expect(kpis.occupancyBps).toBeNull();
    expect(kpis.averageBookingValuePence).toBeNull();
    expect(kpis.otaFeeBps).toBeNull();
  });

  it("flags occupancy above availability", () => {
    const kpis = calculatePropertyKpis({
      availableNights: 2,
      occupiedNights: 3,
      accommodationRevenuePence: 100,
      grossRevenuePence: 100,
      bookingCount: 1,
      cleaningCostPence: 0,
      otaFeesPence: 0,
      operatingProfitPence: 100,
    });
    expect(kpis.occupancyExceedsAvailability).toBe(true);
  });

  it("warns at 80 percent and when the configured threshold is passed", () => {
    const threshold = 9_000_000;
    expect(assessVatThreshold(6_425_000, threshold).warning).toBe(VAT_WARNING.NONE);
    expect(assessVatThreshold(7_200_000, threshold).warning).toBe(VAT_WARNING.APPROACHING);
    expect(assessVatThreshold(7_199_999, threshold).warning).toBe(VAT_WARNING.NONE);
    expect(assessVatThreshold(threshold, threshold).warning).toBe(VAT_WARNING.EXCEEDED);
    expect(() => assessVatThreshold(1, 0)).toThrow(/threshold/i);
  });

  it("selects the tax config effective on the date", () => {
    const selected = activeTaxConfig(
      [
        { id: "old", effectiveFrom: "2024-04-01", effectiveTo: "2026-03-31", amount: 85_000 },
        { id: "current", effectiveFrom: "2026-04-01", effectiveTo: null, amount: 90_000 },
      ],
      "2026-09-27",
    );
    expect(selected?.id).toBe("current");
  });
});

describe("invoices, deposits, and reconciliation", () => {
  it("rejects overpayments and zero payments", () => {
    expect(applyPayment(100_000, 40_000)).toBe(60_000);
    expect(() => applyPayment(100_000, 100_001)).toThrow(/balance/i);
    expect(() => applyPayment(100_000, 0)).toThrow(/greater than zero/i);
  });

  it("marks invoices overdue only when a balance remains", () => {
    expect(
      invoiceCollectionStatus({
        totalPence: 100_000,
        paidPence: 100_000,
        dueOn: "2026-09-01",
        today: "2026-09-27",
        isVoid: false,
        isDraft: false,
      }),
    ).toBe("PAID");
    expect(
      invoiceCollectionStatus({
        totalPence: 175_000,
        paidPence: 0,
        dueOn: "2026-09-20",
        today: "2026-09-27",
        isVoid: false,
        isDraft: false,
      }),
    ).toBe("OVERDUE");
    expect(ageingBucket("2026-09-30", "2026-09-27", 150_000)).toBe("current");
    expect(ageingBucket("2026-08-01", "2026-09-27", 80_000)).toBe("days31to60");
    expect(ageingBucket("2026-06-01", "2026-09-27", 15_000)).toBe("days61plus");
    expect(ageingBucket("2026-09-01", "2026-09-27", 0)).toBeNull();
  });

  it("keeps held deposits out of revenue", () => {
    expect(revenueFromDeposit(DEPOSIT_STATUS.HELD, 30_000, 0)).toBe(0);
    expect(revenueFromDeposit(DEPOSIT_STATUS.RETURNED, 30_000, 0)).toBe(0);
    expect(revenueFromDeposit(DEPOSIT_STATUS.PARTIALLY_RETAINED, 30_000, 5_000)).toBe(5_000);
    expect(revenueFromDeposit(DEPOSIT_STATUS.RETAINED, 30_000, 30_000)).toBe(30_000);
    expect(() => revenueFromDeposit(DEPOSIT_STATUS.PARTIALLY_RETAINED, 30_000, 31_000)).toThrow(/exceed/i);
  });

  it("matches a payout only when allocations sum exactly and the amount is unique", () => {
    expect(isExactAllocation(155_000, [58_000, 49_000, 48_000])).toBe(true);
    expect(isExactAllocation(155_000, [58_000, 49_000])).toBe(false);
    expect(isExactAllocation(100, [])).toBe(false);
    const unique = suggestUniqueAmountMatch(155_000, [
      { id: "payout", amountPence: 155_000 },
      { id: "other", amountPence: 58_200 },
    ]);
    expect(unique?.id).toBe("payout");
    expect(
      suggestUniqueAmountMatch(100, [
        { id: "a", amountPence: 100 },
        { id: "b", amountPence: 100 },
      ]),
    ).toBeNull();
  });
});

describe("periods, money, files, and access", () => {
  it("uses the UK tax year and a custom company year", () => {
    expect(ukTaxYearContaining("2026-04-05").start).toBe("2025-04-06");
    expect(ukTaxYearContaining("2026-04-06").start).toBe("2026-04-06");
    const companyYear = companyFinancialYearContaining("2026-09-27", 9, 1);
    expect(companyYear.start).toBe("2026-09-01");
    expect(companyYear.endExclusive).toBe("2027-09-01");
    expect(companyFinancialYearContaining("2026-08-31", 9, 1).start).toBe("2025-09-01");
    expect(calendarMonthContaining("2026-09-27").label).toBe("September 2026");
    expect(() => nightsBetween("2026-02-31", "2026-03-02")).toThrow();
  });

  it("formats sterling from pence and parses pounds", () => {
    expect(formatGbp(1_245_000)).toBe("£12,450");
    expect(formatGbp(1_850)).toBe("£18.50");
    expect(formatGbp(-1_800)).toBe("-£18");
    expect(parsePoundsToPence("600")).toBe(60_000);
    expect(parsePoundsToPence("18.50")).toBe(1_850);
    expect(parsePoundsToPence("1,850.00")).toBe(185_000);
    expect(parsePoundsToPence("-5")).toBeNull();
    expect(parsePoundsToPence("1.234")).toBeNull();
    expect(applyBasisPoints(10_000, 5_000)).toBe(5_000);
    expect(marginBasisPoints(3_000, 8_000)).toBe(3750);
    expect(formatMargin(3750)).toBe("37.5%");
  });

  it("blocks path traversal and unexpected file types", () => {
    expect(resolveStoragePath("/data", "company/file.pdf")).toMatch(/company\/file\.pdf$/);
    expect(resolveStoragePath("/data", "../etc/passwd")).toBeNull();
    expect(resolveStoragePath("/data", "/etc/passwd")).toBeNull();
    expect(extensionAllowed("receipt.HEIC", ["pdf", "jpg", "jpeg", "png", "heic"])).toBe(true);
    expect(extensionAllowed("receipt.exe", ["pdf", "jpg"])).toBe(false);
  });

  it("round-trips encrypted bank details and masks them", () => {
    const key = encryptionKeyFromHex("42e6c9b5e0cb62e8293b71f3746c99bffe82a96fcf19c756f686f07dd17ac591");
    const cipher = encryptSecret("12345678", key);
    expect(cipher).not.toContain("12345678");
    expect(decryptSecret(cipher, key)).toBe("12345678");
    expect(maskAccountNumber("5678")).toBe("•••• 5678");
    expect(() => encryptionKeyFromHex("short")).toThrow(/32 bytes/);
  });

  it("keeps settings and bank configuration with the owner", () => {
    expect(canManageSettings(USER_ROLE.OWNER)).toBe(true);
    expect(canManageSettings(USER_ROLE.ACCOUNTANT)).toBe(false);
    expect(canConfigureBank(USER_ROLE.PROPERTY_MANAGER)).toBe(false);
    expect(canViewTax(USER_ROLE.PROPERTY_MANAGER)).toBe(false);
    expect(canViewTax(USER_ROLE.ACCOUNTANT)).toBe(true);
    expect(canMutateFinance(USER_ROLE.VIEWER)).toBe(false);
    expect(canMutateFinance(USER_ROLE.PROPERTY_MANAGER)).toBe(true);
  });

  it("escapes csv formulas and rejects an invalid bank file wholesale", () => {
    const csv = serialiseCsv(["Description"], [["=SUM(A1)"]]);
    expect(csv.startsWith("'=SUM") || csv.includes("'=SUM")).toBe(true);
    const parsed = parseBankCsv("Date,Description,Amount,Direction,Reference\n2026-09-01,Airbnb,582.00,CREDIT,HM1\nbad,Missing,nope,SIDEWAYS,X\n");
    expect("errors" in parsed).toBe(true);
    const valid = parseBankCsv("Date,Description,Amount,Direction,Reference\n2026-09-01,Airbnb payout,1550.00,CREDIT,PAY-1\n");
    expect("rows" in valid && valid.rows[0]?.amountPence).toBe(155_000);
  });

  it("raises certificate and vat alerts inside the warning window", () => {
    const alerts = buildAlerts({
      today: "2026-09-27",
      overdueInvoices: 1,
      supplierBillsDue: 0,
      rentDue: 1,
      unmatchedBankTransactions: 1,
      unmatchedPayouts: 1,
      vatWarning: VAT_WARNING.APPROACHING,
      certificateExpiries: [{ name: "Gas safety certificate", propertyName: "Riverview", expiresOn: "2026-10-20" }],
      leaseEnds: [{ propertyName: "Riverview", endsOn: "2027-09-01" }],
      renewals: [{ name: "PriceLabs", renewsOn: "2026-10-05" }],
      insuranceExpiries: [],
      utilityThisMonthPence: 20_000,
      utilityPreviousMonthPence: 10_000,
    });
    expect(alerts.map((alert) => alert.kind)).toEqual(
      expect.arrayContaining([
        "INVOICE_OVERDUE",
        "RENT_DUE",
        "VAT_THRESHOLD_APPROACHING",
        "UTILITY_INCREASE",
        "CERTIFICATE_EXPIRING",
        "SUBSCRIPTION_RENEWAL",
        "BANK_UNMATCHED",
        "PAYOUT_UNMATCHED",
      ]),
    );
    expect(alerts.some((alert) => alert.kind === "LEASE_EXPIRING")).toBe(false);
  });

  it("has a unique code for every catalog row", () => {
    const codes = CATALOG.map((item) => item.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain("AIRBNB_HOST_FEE");
    expect(codes).toContain("CLIENT_ENTERTAINING");
  });
});
