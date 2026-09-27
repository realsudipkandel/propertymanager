import { notFound } from "next/navigation";

import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { ProfitPanel } from "@/components/ProfitPanel";
import { formatGbp, formatMargin } from "@/domain/money";
import { getPropertyReport } from "@/server/queries";
import { requireSession } from "@/server/session";

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const report = await getPropertyReport(session, id);
  if (!report) {
    notFound();
  }
  return (
    <div>
      <PageHeader eyebrow={report.address} title={report.name} detail={report.monthLabel} />
      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <article className="glass-card p-4"><p className="text-xs text-muted">Occupancy</p><p>{formatMargin(report.kpis.occupancyBps)}</p></article>
        <article className="glass-card p-4"><p className="text-xs text-muted">ADR</p><p>{report.kpis.adrPence === null ? "—" : formatGbp(report.kpis.adrPence)}</p></article>
        <article className="glass-card p-4"><p className="text-xs text-muted">RevPAR</p><p>{report.kpis.revparPence === null ? "—" : formatGbp(report.kpis.revparPence)}</p></article>
        <article className="glass-card p-4"><p className="text-xs text-muted">OTA fees</p><p>{formatMargin(report.kpis.otaFeeBps)}</p></article>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfitPanel title={`${report.name} profit and loss`} statement={report.statement} />
        <section className="glass-card p-6">
          <h2 className="text-lg font-semibold">Budget against actual revenue</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {report.budgets.map((budget) => (
              <li key={budget.label} className="flex justify-between">
                <span>{budget.label}</span>
                <Money pence={budget.amountPence} />
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm">Actual revenue <Money pence={report.actualRevenuePence} /></p>
        </section>
      </div>
    </div>
  );
}
