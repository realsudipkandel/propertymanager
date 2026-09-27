import Link from "next/link";

import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { RevenueChart } from "@/components/RevenueChart";
import { StatCard } from "@/components/StatCard";
import { formatGbp } from "@/domain/money";
import { getDashboard } from "@/server/queries";
import { requireSession } from "@/server/session";

export default async function DashboardPage() {
  const session = await requireSession();
  const dashboard = await getDashboard(session);
  return (
    <div>
      <PageHeader
        eyebrow={dashboard.companyName}
        title={dashboard.monthLabel}
        detail="Gross booking revenue, platform fees, and cash are kept apart. Operating profit is not the bank balance."
      />
      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Revenue this month" pence={dashboard.revenuePence} testId="kpi-revenue" />
        <StatCard label="Expenses this month" pence={dashboard.expensesPence} testId="kpi-expenses" />
        <StatCard label="Operating profit" pence={dashboard.profitPence} testId="kpi-profit" />
        <StatCard label="Outstanding invoices" pence={dashboard.outstandingPence} testId="kpi-outstanding" />
        <StatCard label="Upcoming bills" pence={dashboard.upcomingPence} testId="kpi-upcoming" />
        <StatCard label="Bank balance" pence={dashboard.bankPence} testId="kpi-bank" />
      </section>
      <section className="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {dashboard.kpis.map((kpi) => (
          <StatCard key={kpi.label} label={kpi.label} hint={kpi.value} testId={`kpi-${kpi.label}`} />
        ))}
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold">Revenue and operating costs</h2>
          <RevenueChart points={dashboard.chart} />
        </div>
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold">Alerts</h2>
          <ul className="mt-4 space-y-3">
            {dashboard.alerts.length === 0 ? <li className="text-sm text-muted">Nothing needs attention.</li> : null}
            {dashboard.alerts.map((alert) => (
              <li key={`${alert.kind}-${alert.detail}`} className="rounded-xl border border-line px-3 py-3">
                <p className="text-sm font-medium text-orange-400">{alert.title}</p>
                <p className="mt-1 text-sm text-muted">{alert.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <caption className="px-6 py-4 text-left text-lg font-semibold">Property summary</caption>
            <thead className="text-muted">
              <tr>
                <th className="px-6 py-2 text-left font-medium">Property</th>
                <th className="px-4 py-2 text-right font-medium">Revenue</th>
                <th className="px-4 py-2 text-right font-medium">Expenses</th>
                <th className="px-4 py-2 text-right font-medium">Profit</th>
                <th className="px-6 py-2 text-right font-medium">Margin</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.properties.map((property) => (
                <tr key={property.id} className="border-t border-line">
                  <td className="px-6 py-3">
                    <Link href={`/properties/${property.id}`} className="text-blue-500">
                      {property.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right"><Money pence={property.revenuePence} /></td>
                  <td className="px-4 py-3 text-right"><Money pence={property.expensesPence} /></td>
                  <td className="px-4 py-3 text-right"><Money pence={property.profitPence} /></td>
                  <td className="px-6 py-3 text-right">{property.marginLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold">Upcoming bills</h2>
          <ul className="mt-4 space-y-3">
            {dashboard.upcoming.map((bill) => (
              <li key={`${bill.dateLabel}-${bill.name}`} className="flex items-center justify-between text-sm">
                <span>
                  <span className="text-muted">{bill.dateLabel}</span>
                  <span className="mt-1 block">{bill.name}</span>
                </span>
                <Money pence={bill.amountPence} />
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted">
            Cash this month in {formatGbp(dashboard.cash.inPence)}, out {formatGbp(dashboard.cash.outPence)}.
          </p>
        </div>
      </section>
    </div>
  );
}
