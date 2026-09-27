import {
  COST_BEHAVIOUR,
  LEDGER_KIND,
  PARENT_CATEGORY,
  TAX_CLASSIFICATION,
  type CostBehaviour,
  type LedgerKind,
  type TaxClassification,
} from "@/domain/constants";
import { inPeriod, type DatePeriod, type IsoDate } from "@/domain/dates";
import { applyBasisPoints, marginBasisPoints } from "@/domain/money";

export type LedgerLine = {
  kind: LedgerKind;
  propertyId: string | null;
  bookingId: string | null;
  categoryCode: string;
  parentCategoryCode: string | null;
  channel: string | null;
  amountPence: number;
  taxClassification: TaxClassification;
  businessUseBps: number;
  costBehaviour: CostBehaviour;
  occurredOn: IsoDate;
  label: string;
  groupLabel: string;
};

export type CategoryTotal = {
  code: string;
  label: string;
  amountPence: number;
};

export type ProfitAndLoss = {
  grossRevenuePence: number;
  refundsPence: number;
  netRevenuePence: number;
  variableCostsPence: number;
  otaFeesPence: number;
  fixedCostsPence: number;
  companyCostsPence: number;
  operatingExpensesPence: number;
  operatingProfitPence: number;
  marginBps: number | null;
  capitalExpenditurePence: number;
  financeCostsPence: number;
  disallowablePence: number;
  pendingReviewPence: number;
  deductibleExpensesPence: number;
  revenueByCategory: CategoryTotal[];
  expenseByCategory: CategoryTotal[];
};

const EMPTY_PROFIT: ProfitAndLoss = {
  grossRevenuePence: 0,
  refundsPence: 0,
  netRevenuePence: 0,
  variableCostsPence: 0,
  otaFeesPence: 0,
  fixedCostsPence: 0,
  companyCostsPence: 0,
  operatingExpensesPence: 0,
  operatingProfitPence: 0,
  marginBps: null,
  capitalExpenditurePence: 0,
  financeCostsPence: 0,
  disallowablePence: 0,
  pendingReviewPence: 0,
  deductibleExpensesPence: 0,
  revenueByCategory: [],
  expenseByCategory: [],
};

function isPlatformFee(line: LedgerLine): boolean {
  return (
    line.parentCategoryCode === PARENT_CATEGORY.PLATFORM_FEES ||
    line.categoryCode === PARENT_CATEGORY.PLATFORM_FEES
  );
}

function isPending(classification: TaxClassification): boolean {
  return (
    classification === TAX_CLASSIFICATION.UNKNOWN ||
    classification === TAX_CLASSIFICATION.ACCOUNTANT_REVIEW
  );
}

function addCategory(totals: Map<string, CategoryTotal>, code: string, label: string, amount: number): void {
  const current = totals.get(code);
  if (current) {
    current.amountPence += amount;
    return;
  }
  totals.set(code, { code, label, amountPence: amount });
}

export function buildProfitAndLoss(lines: LedgerLine[], period?: DatePeriod): ProfitAndLoss {
  const revenue = new Map<string, CategoryTotal>();
  const expenses = new Map<string, CategoryTotal>();
  const result: ProfitAndLoss = {
    ...EMPTY_PROFIT,
    revenueByCategory: [],
    expenseByCategory: [],
  };

  for (const line of lines) {
    if (period && !inPeriod(line.occurredOn, period.start, period.endExclusive)) {
      continue;
    }
    if (line.kind === LEDGER_KIND.INCOME) {
      result.grossRevenuePence += line.amountPence;
      addCategory(revenue, line.categoryCode, line.label, line.amountPence);
      continue;
    }
    if (line.kind === LEDGER_KIND.REFUND) {
      result.refundsPence += line.amountPence;
      continue;
    }

    const recognised = applyBasisPoints(line.amountPence, line.businessUseBps);
    if (
      line.taxClassification === TAX_CLASSIFICATION.CAPITAL ||
      line.parentCategoryCode === PARENT_CATEGORY.FURNITURE
    ) {
      result.capitalExpenditurePence += recognised;
      continue;
    }
    if (line.taxClassification === TAX_CLASSIFICATION.FINANCE_COST) {
      result.financeCostsPence += recognised;
      continue;
    }

    result.operatingExpensesPence += recognised;
    addCategory(
      expenses,
      line.parentCategoryCode ?? line.categoryCode,
      line.groupLabel,
      recognised,
    );

    if (line.taxClassification === TAX_CLASSIFICATION.DISALLOWABLE) {
      result.disallowablePence += recognised;
    } else if (isPending(line.taxClassification)) {
      result.pendingReviewPence += recognised;
    } else if (
      line.taxClassification === TAX_CLASSIFICATION.ALLOWABLE ||
      line.taxClassification === TAX_CLASSIFICATION.PARTIALLY_ALLOWABLE
    ) {
      result.deductibleExpensesPence += recognised;
    }

    if (isPlatformFee(line)) {
      result.otaFeesPence += recognised;
    } else if (line.costBehaviour === COST_BEHAVIOUR.VARIABLE) {
      result.variableCostsPence += recognised;
    } else if (line.propertyId === null || line.costBehaviour === COST_BEHAVIOUR.COMPANY) {
      result.companyCostsPence += recognised;
    } else {
      result.fixedCostsPence += recognised;
    }
  }

  result.netRevenuePence = result.grossRevenuePence - result.refundsPence;
  result.operatingProfitPence = result.netRevenuePence - result.operatingExpensesPence;
  result.marginBps = marginBasisPoints(result.operatingProfitPence, result.grossRevenuePence);
  result.revenueByCategory = [...revenue.values()].sort((left, right) => right.amountPence - left.amountPence);
  result.expenseByCategory = [...expenses.values()].sort((left, right) => right.amountPence - left.amountPence);
  return result;
}

export function linesForProperty(lines: LedgerLine[], propertyId: string): LedgerLine[] {
  return lines.filter((line) => line.propertyId === propertyId);
}

export type ChannelRow = {
  channel: string;
  revenuePence: number;
  feesPence: number;
  bookings: number;
};

export function revenueByChannel(
  bookings: Array<{ channel: string; grossRevenuePence: number; platformCostsPence: number }>,
): ChannelRow[] {
  const rows = new Map<string, ChannelRow>();
  for (const booking of bookings) {
    const current = rows.get(booking.channel) ?? {
      channel: booking.channel,
      revenuePence: 0,
      feesPence: 0,
      bookings: 0,
    };
    current.revenuePence += booking.grossRevenuePence;
    current.feesPence += booking.platformCostsPence;
    current.bookings += 1;
    rows.set(booking.channel, current);
  }
  return [...rows.values()].sort((left, right) => right.revenuePence - left.revenuePence);
}
