import Link from "next/link";
import type { ReactNode } from "react";

import { Money } from "@/components/Money";
import type { DashboardView, PropertyComparison, ShareBar } from "@/domain/dashboard";
import { formatDisplayDate } from "@/domain/dates";
import { formatGbp, formatMargin } from "@/domain/money";
import { CashFlowChart, CompositionChart, ExpenseDonut, ExpenseStack, HospitalityChart, PropertyMatrix, TrendChart } from "@/features/dashboard/DashboardCharts";
import { KpiStrip } from "@/features/dashboard/KpiStrip";
import { DualMeter, ShareMeters, WaterfallList } from "@/features/dashboard/Meters";
import { PropertyLeaderboard } from "@/features/dashboard/PropertyLeaderboard";
import { heatmapClass, toneClass } from "@/features/dashboard/presentation";

function Panel({ title, detail, testId, children }: { title: string; detail?: string; testId: string; children: ReactNode }) {
  return (
    <section className="glass-card p-6" data-testid={testId}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {detail ? <p className="mt-1 text-sm text-muted">{detail}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function collectStayLabels(row: DashboardView["stays"][number]): string[] {
  return row.days.flatMap((day) => (day.label ? [`${row.propertyName}: ${day.label}`] : []));
}

function stayCount(row: ShareBar): string {
  const count = row.amountPence;
  return `${count} ${count === 1 ? "booking" : "bookings"}`;
}

function shortDay(isoDate: string): string {
  return formatDisplayDate(isoDate).replace(/ \d{4}$/, "");
}

export function BusinessOverview({ view, base }: { view: DashboardView; base: string }) {
  const expenseTotal = view.expenses.reduce((total, row) => total + row.amountPence, 0);
  return (
    <div className="space-y-6">
      {view.rangeWarning ? <p className="rounded-xl border border-orange-400/40 px-4 py-3 text-sm text-orange-300">{view.rangeWarning}</p> : null}
      <p className="max-w-3xl text-sm text-muted">{view.basisNote}</p>
      <KpiStrip cards={view.kpis} />
      {view.insights.length > 0 ? (
        <section className="grid gap-4 lg:grid-cols-3" data-testid="insights">
          {view.insights.map(renderInsight)}
        </section>
      ) : null}
      <Panel title={view.trendTitle} detail="The main question: is the business making money, and is that showing up as cash?" testId="trend-panel">
        <TrendChart points={view.trend} />
      </Panel>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Where the money went" detail="Gross bookings through to operating profit. Open a cost to see the transactions." testId="waterfall-panel">
          <WaterfallList steps={view.waterfall} base={base} />
        </Panel>
        <Panel title="Channel performance" detail="Gross revenue is not the same as money kept after commission." testId="channel-panel">
          <DualMeter leftLabel="OTA revenue" leftBps={view.ota.otaShareBps} rightLabel="Direct and corporate" rightBps={view.ota.directShareBps} />
          {view.ota.statement ? <p className="mt-3 text-sm text-muted">{view.ota.statement}</p> : null}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Channel</th>
                  <th className="py-2 pr-3 text-right font-medium">Revenue</th>
                  <th className="py-2 pr-3 text-right font-medium">Bookings</th>
                  <th className="py-2 pr-3 text-right font-medium">ADR</th>
                  <th className="py-2 pr-3 text-right font-medium">Nights</th>
                  <th className="py-2 pr-3 text-right font-medium">Fees</th>
                  <th className="py-2 pr-3 text-right font-medium">Fee</th>
                  <th className="py-2 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {view.channels.map(renderChannel)}
              </tbody>
            </table>
          </div>
          {view.channels.length === 0 ? <p className="text-sm text-muted">No check-ins in this range.</p> : null}
        </Panel>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Property profitability" detail="Sort by the question you are asking. These bars are the property's own result. Company costs that are not posted to a home sit outside them." testId="leaderboard-panel">
          <PropertyLeaderboard properties={view.properties} base={base} />
        </Panel>
        <Panel title="Occupancy against margin" testId="matrix-panel">
          <PropertyMatrix properties={view.properties} guides={view.matrixGuides} />
        </Panel>
      </div>
      {view.comparison ? (
        <Panel title="Property comparison" detail="Shading shows which property is highest in that row." testId="comparison-panel">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="py-2 pr-3 text-left font-medium text-muted"> </th>
                  {view.comparison.properties.map(renderComparisonHead)}
                </tr>
              </thead>
              <tbody>
                {view.comparison.rows.map(renderComparisonRow)}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Occupancy and ADR" detail="Whether growth came from price, fuller calendars, or both." testId="hospitality-panel">
          <p className="mb-3 text-sm">
            RevPAN {view.currentRevpanPence === null ? "—" : formatGbp(view.currentRevpanPence)}
            <span className="text-muted"> · previous {view.previousRevpanPence === null ? "—" : formatGbp(view.previousRevpanPence)}</span>
          </p>
          <HospitalityChart points={view.hospitality} />
        </Panel>
        <Panel title="Revenue composition" detail="Accommodation versus guest fees. Growth from extras is not the same as a higher rate." testId="composition-panel">
          <CompositionChart points={view.composition} />
        </Panel>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Occupancy" detail={view.heatmapCaption} testId="heatmap-panel">
          <div className="space-y-2">
            {view.heatmap.map(renderWeek)}
          </div>
        </Panel>
        <Panel title="Length of stay" detail="Bookings checking in during this range." testId="stay-length-panel">
          <ShareMeters rows={view.lengthOfStay} base={base} formatAmount={stayCount} />
        </Panel>
      </div>
      <Panel title="Booking calendar" detail="The next 14 days. Each bar is a stay: guest, channel, nights, and amount." testId="calendar-panel">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-xs">
            <thead>
              <tr>
                <th className="py-2 pr-3 text-left font-medium text-muted">Property</th>
                {view.stayDates.map(renderStayHead)}
              </tr>
            </thead>
            <tbody>
              {view.stays.map(renderStayRow)}
            </tbody>
          </table>
        </div>
        {view.stays.length === 0 ? <p className="text-sm text-muted">No properties yet.</p> : null}
        <ul className="mt-4 space-y-2 text-sm">
          {view.stays.flatMap(collectStayLabels).map(renderStaySummary)}
        </ul>
      </Panel>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Operating costs" detail={`${formatGbp(expenseTotal)} in this range. Open a category for the transactions.`} testId="expense-panel">
          <ExpenseDonut rows={view.expenses} />
          <div className="mt-4">
            <ShareMeters rows={view.expenses} base={base} />
          </div>
        </Panel>
        <Panel title="Cost trend" detail="Stacked by category, so a creeping cost is visible before the total moves." testId="expense-trend-panel">
          <ExpenseStack points={view.expenseTrend} keys={view.expenseTrendKeys} />
        </Panel>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Cost changes" detail="Compared with the previous period, or the prior three-month average when you are looking at this month." testId="anomaly-panel">
          {view.anomalies.length === 0 ? <p className="text-sm text-muted">No category is up by 25% or more.</p> : <ul className="space-y-3">{view.anomalies.map(renderAnomaly)}</ul>}
        </Panel>
        <Panel title="Cleaning" testId="cleaning-panel">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted">Cost</dt><dd className="text-lg font-semibold"><Money pence={view.cleaning.costPence} /></dd></div>
            <div><dt className="text-muted">Bookings cleaned</dt><dd className="text-lg font-semibold">{view.cleaning.bookings}</dd></div>
            <div><dt className="text-muted">Average</dt><dd>{view.cleaning.averagePence === null ? "—" : formatGbp(view.cleaning.averagePence)}</dd></div>
            <div><dt className="text-muted">Previous</dt><dd>{view.cleaning.previousAveragePence === null ? "—" : formatGbp(view.cleaning.previousAveragePence)}</dd></div>
          </dl>
          {view.cleaning.alert ? <p className="mt-3 text-sm text-orange-300">{view.cleaning.alert}</p> : null}
        </Panel>
        <Panel title="Supplier spending" testId="supplier-panel">
          <ul className="space-y-3 text-sm">
            {view.suppliers.length === 0 ? <li className="text-muted">No supplier costs in this range.</li> : null}
            {view.suppliers.map(renderSupplier)}
          </ul>
        </Panel>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Cash flow" detail="Profit and the bank balance are different questions." testId="cash-panel">
          <CashFlowChart points={view.cashSeries} />
        </Panel>
        <Panel title="Cash movement" detail="Opening balance, money in, money out, closing balance." testId="cash-waterfall-panel">
          <WaterfallList steps={view.cashWaterfall} base={base} />
        </Panel>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Coming out of the bank" detail={`${formatGbp(view.obligationsTotalPence)} due in the next 30 days.`} testId="obligations-panel">
          <ol className="space-y-3 text-sm">
            {view.obligations.length === 0 ? <li className="text-muted">No bills due in the next 30 days.</li> : null}
            {view.obligations.map(renderObligation)}
          </ol>
        </Panel>
        <Panel title="Reconciliation" detail="Matched statement lines against everything still open." testId="reconciliation-panel">
          <p className="text-sm">Statement lines <span className="font-semibold">{formatMargin(view.reconciliation.progressBps)}</span> matched</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${view.reconciliation.progressBps === null ? 0 : Math.round(view.reconciliation.progressBps / 100)}%` }} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted">Matched</dt><dd>{view.reconciliation.matched}</dd></div>
            <div><dt className="text-muted">Unmatched</dt><dd>{view.reconciliation.unmatched}</dd></div>
            <div><dt className="text-muted">Suggested matches</dt><dd>{view.reconciliation.suggested}</dd></div>
            <div><dt className="text-muted">Needs review</dt><dd>{view.reconciliation.needsReview}</dd></div>
          </dl>
          <Link href={`${base}/reconciliation`} className="mt-4 inline-block text-sm text-blue-400">Open reconciliation</Link>
          <ul className="mt-4 space-y-3 text-sm">
            {view.payouts.map(renderPayout)}
          </ul>
        </Panel>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Receivables" detail="Unpaid customer invoices." testId="receivables-panel">
          <ShareMeters rows={view.receivables} base={base} />
        </Panel>
        <Panel title="Payables" detail="Supplier balances still to pay." testId="payables-panel">
          <ShareMeters rows={view.payables} base={base} />
        </Panel>
        <Panel title="Invoice progress" testId="invoice-funnel">
          <ol className="space-y-2 text-sm">
            {view.invoiceFunnel.map(renderFunnel)}
          </ol>
        </Panel>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="VAT registration threshold" detail="The threshold comes from tax settings. The turnover is the rolling 12 months, not the range selected above." testId="vat-panel">
          {view.vat ? <VatGauge turnover={view.vat.turnoverPence} threshold={view.vat.thresholdPence} utilisationBps={view.vat.utilisationBps} narrative={view.vat.narrative} /> : <p className="text-sm text-muted">Add a VAT threshold in tax settings to track registration.</p>}
          <Link href={`${base}/tax`} className="mt-4 inline-block text-sm text-blue-400">Tax settings</Link>
        </Panel>
        <Panel title="Tax treatment" detail="Needs accountant is the review queue." testId="tax-treatment-panel">
          <ShareMeters rows={view.taxTreatment} base={base} />
        </Panel>
      </div>
      <Panel title="Reporting years" detail="The UK tax year and the company year are not the same clock." testId="timeline-panel">
        <div className="space-y-5">
          <YearBar label={view.timeline.taxLabel} start={view.timeline.taxStart} end={view.timeline.taxEnd} progressBps={view.timeline.taxProgressBps} />
          <YearBar label={view.timeline.companyLabel} start={view.timeline.companyStart} end={view.timeline.companyEnd} progressBps={view.timeline.companyProgressBps} />
        </div>
      </Panel>
      <Panel title="Documents" detail={view.compliance.definition} testId="compliance-panel">
        <dl className="grid gap-3 sm:grid-cols-4 text-sm">
          <div><dt className="text-muted">Compliant properties</dt><dd className="text-lg font-semibold">{view.compliance.compliantProperties} / {view.compliance.propertyCount}</dd></div>
          <div><dt className="text-muted">Expiring</dt><dd className="text-lg font-semibold">{view.compliance.expiring}</dd></div>
          <div><dt className="text-muted">Expired</dt><dd className="text-lg font-semibold">{view.compliance.expired}</dd></div>
          <div><dt className="text-muted">Missing</dt><dd className="text-lg font-semibold">{view.compliance.missing}</dd></div>
        </dl>
        <Link href={`${base}/documents`} className="mt-4 inline-block text-sm text-blue-400">Documents</Link>
      </Panel>
      <Panel title="Needs attention" detail={view.actionCount === 0 ? "Nothing is waiting." : `${view.actionCount} items`} testId="action-centre">
        {view.actions.length === 0 ? <p className="text-sm text-muted">Nothing needs attention.</p> : <div className="space-y-5">{view.actions.map(renderActionGroup)}</div>}
      </Panel>
    </div>
  );

  function renderInsight(insight: DashboardView["insights"][number]): ReactNode {
    return (
      <article key={insight.id} className="glass-card border-l-4 border-l-blue-500 p-5">
        <h2 className="font-semibold">{insight.title}</h2>
        <p className="mt-2 text-sm text-muted">{insight.body}</p>
      </article>
    );
  }

  function renderChannel(channel: DashboardView["channels"][number]): ReactNode {
    return (
      <tr key={channel.platform} className="border-t border-line">
        <td className="py-2 pr-3">
          <Link href={`${base}/bookings`} className="text-blue-400">{channel.label}</Link>
        </td>
        <td className="py-2 pr-3 text-right tabular-nums"><Money pence={channel.revenuePence} /></td>
        <td className="py-2 pr-3 text-right tabular-nums">{channel.bookings}</td>
        <td className="py-2 pr-3 text-right tabular-nums">{channel.adrPence === null ? "—" : formatGbp(channel.adrPence)}</td>
        <td className="py-2 pr-3 text-right tabular-nums">{channel.nights}</td>
        <td className="py-2 pr-3 text-right tabular-nums"><Money pence={channel.commissionPence} /></td>
        <td className="py-2 pr-3 text-right tabular-nums">{formatMargin(channel.feeBps)}</td>
        <td className="py-2 text-right tabular-nums"><Money pence={channel.netPence} /></td>
      </tr>
    );
  }

  function renderComparisonHead(property: { id: string; name: string }): ReactNode {
    return (
      <th key={property.id} className="px-3 py-2 text-right font-medium">
        <Link href={`${base}/properties/${property.id}`} className="text-blue-400">{property.name}</Link>
      </th>
    );
  }

  function renderComparisonRow(row: PropertyComparison["rows"][number]): ReactNode {
    return (
      <tr key={row.label} className="border-t border-line">
        <th className={`py-2 pr-3 text-left font-medium ${row.emphasize ? "text-emerald-300" : "text-muted"}`}>{row.label}</th>
        {row.cells.map((cell, index) => renderComparisonCell(cell, index, row.label))}
      </tr>
    );
  }

  function renderComparisonCell(cell: { display: string; intensityBps: number }, index: number, label: string): ReactNode {
    const alpha = Math.round((cell.intensityBps / 10_000) * 28);
    return (
      <td key={`${label}-${index}`} className="px-3 py-2 text-right tabular-nums" style={{ backgroundColor: `rgba(59, 130, 246, ${alpha / 100})` }}>
        {cell.display}
      </td>
    );
  }

  function renderWeek(week: DashboardView["heatmap"][number]): ReactNode {
    return (
      <div key={week.label} className="grid grid-cols-[4.5rem_repeat(7,minmax(0,1fr))] gap-1">
        <span className="self-center text-xs text-muted">{week.label}</span>
        {week.days.map(renderHeatDay)}
      </div>
    );
  }

  function renderHeatDay(day: DashboardView["heatmap"][number]["days"][number]): ReactNode {
    const label = day.occupancyBps === null ? "Outside range" : `${shortDay(day.iso)} ${formatMargin(day.occupancyBps)} booked`;
    return (
      <div key={day.iso} title={label} className={`flex h-9 items-center justify-center rounded-md text-[10px] ${heatmapClass(day.occupancyBps)}`}>
        {day.weekday.slice(0, 1)}
      </div>
    );
  }

  function renderStayHead(isoDate: string): ReactNode {
    return <th key={isoDate} className="px-1 py-2 text-center font-medium text-muted">{shortDay(isoDate)}</th>;
  }

  function renderStayRow(row: DashboardView["stays"][number]): ReactNode {
    return (
      <tr key={row.propertyId} className="border-t border-line">
        <th className="py-2 pr-3 text-left font-medium">
          <Link href={`${base}/properties/${row.propertyId}`} className="text-blue-400">{row.propertyName}</Link>
        </th>
        {row.days.map(renderStayDay)}
      </tr>
    );
  }

  function renderStaySummary(summary: string): ReactNode {
    return <li key={summary}>{summary}</li>;
  }

  function renderStayDay(day: DashboardView["stays"][number]["days"][number]): ReactNode {
    return (
      <td key={day.iso} title={day.label ?? ""} className={day.occupied ? "bg-emerald-500/25 px-1 py-2 text-center" : "px-1 py-2 text-center text-muted"}>
        {day.label ? "Stay" : day.occupied ? "·" : ""}
      </td>
    );
  }

  function renderAnomaly(anomaly: DashboardView["anomalies"][number]): ReactNode {
    return (
      <li key={anomaly.code}>
        <Link href={`${base}/expenses?category=${encodeURIComponent(anomaly.code)}`} className="font-medium text-orange-300">{anomaly.label}</Link>
        <p className="text-sm text-muted">{anomaly.detail}</p>
      </li>
    );
  }

  function renderSupplier(supplier: DashboardView["suppliers"][number]): ReactNode {
    return (
      <li key={supplier.id} className="flex items-center justify-between gap-3">
        <Link href={`${base}/suppliers`} className="text-blue-400">{supplier.name}</Link>
        <Money pence={supplier.amountPence} />
      </li>
    );
  }

  function renderObligation(item: DashboardView["obligations"][number]): ReactNode {
    return (
      <li key={`${item.dateLabel}-${item.name}`} className="flex items-center justify-between gap-3">
        <span><span className="text-muted">{item.dateLabel}</span><span className="mt-1 block">{item.name}</span></span>
        <Money pence={item.amountPence} />
      </li>
    );
  }

  function renderPayout(payout: DashboardView["payouts"][number]): ReactNode {
    return (
      <li key={payout.id} className="rounded-xl border border-line px-3 py-3">
        <p className="font-medium">{payout.label}</p>
        <p className="mt-1 text-muted">
          Payout {formatGbp(payout.amountPence)} · bookings {formatGbp(payout.allocatedPence)} · difference {formatGbp(payout.differencePence)}
          {payout.balanced ? " · matched" : " · check this payout"}
        </p>
      </li>
    );
  }

  function renderFunnel(step: DashboardView["invoiceFunnel"][number]): ReactNode {
    return (
      <li key={step.key} className="flex items-center justify-between border-b border-line py-2">
        <span>{step.label}</span>
        <span className="tabular-nums">{step.count}</span>
      </li>
    );
  }

  function renderActionGroup(group: DashboardView["actions"][number]): ReactNode {
    return (
      <div key={group.id}>
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{group.heading}</h3>
        <ul className="mt-2 space-y-2">
          {group.items.map(renderAction)}
        </ul>
      </div>
    );
  }

  function renderAction(item: DashboardView["actions"][number]["items"][number]): ReactNode {
    return (
      <li key={`${item.kind}-${item.title}-${item.detail}`} className="flex items-start justify-between gap-3 rounded-xl border border-line px-3 py-3">
        <span>
          <span className={`block text-sm font-medium ${toneClass("warning")}`}>{item.title}</span>
          <span className="mt-1 block text-sm text-muted">{item.detail}</span>
        </span>
        <Link href={`${base}${item.hrefPath}`} className="text-sm text-blue-400">View</Link>
      </li>
    );
  }
}

function VatGauge({ turnover, threshold, utilisationBps, narrative }: { turnover: number; threshold: number; utilisationBps: number; narrative: string }) {
  const width = Math.min(100, Math.round(utilisationBps / 100));
  return (
    <div data-testid="vat-gauge">
      <div className="flex justify-between text-xs text-muted">
        <span>£0</span>
        <span>Threshold {formatGbp(threshold)}</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/5">
        <div className={utilisationBps >= 10_000 ? "h-full rounded-full bg-pink-500" : "h-full rounded-full bg-blue-500"} style={{ width: `${width}%` }} />
      </div>
      <p className="mt-3 text-sm">{formatGbp(turnover)} rolling taxable turnover</p>
      <p className="mt-1 text-sm text-muted">{narrative}</p>
    </div>
  );
}

function YearBar({ label, start, end, progressBps }: { label: string; start: string; end: string; progressBps: number }) {
  const width = Math.min(100, Math.round(progressBps / 100));
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>{start}</span>
        <span>{end}</span>
      </div>
      <div className="relative mt-2 h-2 rounded-full bg-white/5">
        <div className="h-2 rounded-full bg-purple-500" style={{ width: `${width}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">Today</p>
    </div>
  );
}
