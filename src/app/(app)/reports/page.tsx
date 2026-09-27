import Link from "next/link";

import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { ProfitPanel } from "@/components/ProfitPanel";
import { countLabel } from "@/domain/labels";
import type { ChannelRow } from "@/domain/reports";
import { getReports } from "@/server/queries";
import { requireSession } from "@/server/session";

function renderChannel(channel: ChannelRow) {
  return (
    <li key={channel.channel}>
      <p className="font-medium">{channel.channel} · {countLabel(channel.bookings, "booking", "bookings")}</p>
      <p className="text-muted">Revenue <Money pence={channel.revenuePence} /> · fees <Money pence={channel.feesPence} /></p>
    </li>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ basis?: string }> }) {
  const params = await searchParams;
  const basis = params.basis === "tax" || params.basis === "financial" ? params.basis : "month";
  const session = await requireSession();
  const report = await getReports(session, basis);
  return (
    <div>
      <PageHeader eyebrow="Reports" title={report.label} detail="Switch between the calendar month, the UK tax year, and the company financial year." />
      <div className="mb-6 flex gap-3 text-sm">
        <Link className={basis === "month" ? "text-blue-500" : "text-muted"} href="/reports?basis=month">This month</Link>
        <Link className={basis === "tax" ? "text-blue-500" : "text-muted"} href="/reports?basis=tax">UK tax year</Link>
        <Link className={basis === "financial" ? "text-blue-500" : "text-muted"} href="/reports?basis=financial">Financial year</Link>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="text-blue-500" href="/api/export/bookings" data-testid="export-bookings">Booking CSV</a>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfitPanel title="Company profit and loss" statement={report.statement} />
        <section className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="font-semibold">Revenue by channel</h2>
            <ul className="mt-3 space-y-3 text-sm">
              {report.channels.map(renderChannel)}
            </ul>
          </div>
          <div className="glass-card p-6">
            <h2 className="font-semibold">Cash, separate from profit</h2>
            <p className="mt-2 text-sm">Opening <Money pence={report.cash.closingPence - report.cash.netPence} /></p>
            <p className="text-sm">In <Money pence={report.cash.cashInPence} /> · out <Money pence={report.cash.cashOutPence} /></p>
            <p className="text-sm">Closing <Money pence={report.cash.closingPence} /></p>
          </div>
          <div className="glass-card p-6">
            <h2 className="font-semibold">Expenses by category</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {report.statement.expenseByCategory.map((row) => (
                <li key={row.code} className="flex justify-between"><span>{row.label}</span><Money pence={row.amountPence} /></li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
