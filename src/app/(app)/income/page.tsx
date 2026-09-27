import Link from "next/link";

import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { listIncome } from "@/server/queries";
import { requireSession } from "@/server/session";

export default async function IncomePage() {
  const session = await requireSession();
  const rows = await listIncome(session);
  return (
    <div>
      <PageHeader
        eyebrow="Income"
        title="Gross income"
        detail="These lines are what the guest paid, not what the platform transferred."
        action={
          <>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="primary-button" href="/api/export/income" data-testid="export-income">Export CSV</a>
          </>
        }
      />
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Guest</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3 text-right">Gross</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-4 py-3">{row.date}</td>
                <td className="px-4 py-3">{row.category}</td>
                <td className="px-4 py-3">{row.property}</td>
                <td className="px-4 py-3">{row.guest}</td>
                <td className="px-4 py-3">{row.channel}</td>
                <td className="px-4 py-3 text-right"><Money pence={row.grossPence} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-muted">Post new accommodation through <Link className="text-blue-500" href="/bookings/new">bookings</Link> so fees stay attached to the stay.</p>
    </div>
  );
}
