import Link from "next/link";
import { notFound } from "next/navigation";

import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { ProfitPanel } from "@/components/ProfitPanel";
import { formatGbp, formatMargin } from "@/domain/money";
import { organizationPath } from "@/domain/organization";
import { getPropertyReport } from "@/server/queries";
import { requireSession } from "@/server/session";

function perNight(amountPence: number, nights: number): string {
  if (nights <= 0) {
    return "—";
  }
  return formatGbp(Math.round(amountPence / nights));
}

export default async function PropertyPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const base = organizationPath(session.organizationSlug);
  const report = await getPropertyReport(session, id);
  if (!report) {
    notFound();
  }
  const cards = [
    { label: "Revenue", value: formatGbp(report.statement.grossRevenuePence) },
    { label: "Occupancy", value: formatMargin(report.kpis.occupancyBps) },
    { label: "ADR", value: report.kpis.adrPence === null ? "—" : formatGbp(report.kpis.adrPence) },
    { label: "RevPAN", value: report.kpis.revparPence === null ? "—" : formatGbp(report.kpis.revparPence) },
    { label: "Operating profit", value: formatGbp(report.statement.operatingProfitPence) },
    { label: "Margin", value: formatMargin(report.kpis.operatingMarginBps) },
    { label: "Cleaning / booking", value: report.kpis.cleaningCostPerBookingPence === null ? "—" : formatGbp(report.kpis.cleaningCostPerBookingPence) },
    { label: "OTA fees", value: formatMargin(report.kpis.otaFeeBps) },
    { label: "OTA fees / occupied night", value: perNight(report.statement.otaFeesPence, report.occupiedNights) },
    { label: "Profit / occupied night", value: perNight(report.statement.operatingProfitPence, report.occupiedNights) },
  ];
  return (
    <div>
      <PageHeader
        eyebrow={report.address}
        title={report.name}
        detail={report.monthLabel}
        action={<Link className="text-sm text-blue-400" href={base}>Back to overview</Link>}
      />
      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(renderCard)}
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfitPanel title={`${report.name} profit and loss`} statement={report.statement} />
        <section className="space-y-6">
          <section className="glass-card p-6">
            <h2 className="text-lg font-semibold">Revenue by channel</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {report.channels.length === 0 ? <li className="text-muted">No check-ins this month.</li> : null}
              {report.channels.map(renderChannel)}
            </ul>
          </section>
          <section className="glass-card p-6">
            <h2 className="text-lg font-semibold">Expense breakdown</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {report.statement.expenseByCategory.length === 0 ? <li className="text-muted">No costs posted this month.</li> : null}
              {report.statement.expenseByCategory.map(renderExpense)}
            </ul>
          </section>
          <section className="glass-card p-6">
            <h2 className="text-lg font-semibold">Budget against actual revenue</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {report.budgets.length === 0 ? <li className="text-muted">No budget for this month.</li> : null}
              {report.budgets.map(renderBudget)}
            </ul>
            <p className="mt-4 text-sm">Actual revenue <Money pence={report.actualRevenuePence} /></p>
          </section>
        </section>
      </div>
    </div>
  );
}

function renderCard(card: { label: string; value: string }) {
  return (
    <article key={card.label} className="glass-card p-4" data-testid={`property-${card.label}`}>
      <p className="text-xs uppercase tracking-[0.14em] text-muted">{card.label}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums">{card.value}</p>
    </article>
  );
}

function renderChannel(channel: { channel: string; bookings: number; revenuePence: number; feesPence: number }) {
  return (
    <li key={channel.channel} className="flex items-baseline justify-between gap-3">
      <span>{channel.channel} · {channel.bookings}</span>
      <span className="tabular-nums"><Money pence={channel.revenuePence} /> · fees <Money pence={channel.feesPence} /></span>
    </li>
  );
}

function renderExpense(row: { code: string; label: string; amountPence: number }) {
  return (
    <li key={row.code} className="flex items-baseline justify-between gap-3">
      <span>{row.label}</span>
      <Money pence={row.amountPence} />
    </li>
  );
}

function renderBudget(budget: { label: string; amountPence: number }) {
  return (
    <li key={budget.label} className="flex justify-between">
      <span>{budget.label}</span>
      <Money pence={budget.amountPence} />
    </li>
  );
}
