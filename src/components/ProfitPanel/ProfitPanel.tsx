import { formatGbp, formatMargin } from "@/domain/money";
import type { ProfitAndLoss } from "@/domain/reports";

export function ProfitPanel({ title, statement }: { title: string; statement: ProfitAndLoss }) {
  const rows = [
    ["Gross revenue", statement.grossRevenuePence],
    ["Refunds", -statement.refundsPence],
    ["Net revenue", statement.netRevenuePence],
    ["OTA fees", -statement.otaFeesPence],
    ["Variable costs", -statement.variableCostsPence],
    ["Fixed property costs", -statement.fixedCostsPence],
    ["Company costs", -statement.companyCostsPence],
    ["Operating expenses", -statement.operatingExpensesPence],
    ["Operating profit", statement.operatingProfitPence],
  ] as const;
  return (
    <section className="glass-card p-6" data-testid="profit-panel">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted">Margin {formatMargin(statement.marginBps)}</p>
      </div>
      <dl className="mt-4 divide-y divide-line">
        {rows.map((row) => (
          <div key={row[0]} className="flex items-center justify-between py-2 text-sm">
            <dt className="text-muted">{row[0]}</dt>
            <dd className="tabular-nums font-medium">{formatGbp(row[1])}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs leading-5 text-muted">
        Capital {formatGbp(statement.capitalExpenditurePence)}, finance costs {formatGbp(statement.financeCostsPence)},
        disallowable {formatGbp(statement.disallowablePence)} and pending review {formatGbp(statement.pendingReviewPence)} are
        kept out of deductible profit. Disallowable and pending amounts still show inside operating costs when they are cash
        spent on the business.
      </p>
    </section>
  );
}
