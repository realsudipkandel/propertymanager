import Link from "next/link";

import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { organizationPath } from "@/domain/organization";
import { listExpenses } from "@/server/queries";
import { requireSession } from "@/server/session";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const params = await searchParams;
  const session = await requireSession();
  const base = organizationPath(session.organizationSlug);
  const category = params.category?.trim() ?? "";
  const loaded = await listExpenses(session);
  const rows = category.length === 0 ? loaded : loaded.filter((row) => row.categoryCode === category || row.leafCode === category);
  return (
    <div>
      <PageHeader eyebrow="Expenses" title="Costs" detail="Rent, utilities, cleaning, platform fees, and company costs. Capital and client entertaining are classified, not assumed to be deductible." action={<Link className="primary-button" href={`${base}/expenses/new`}>Add expense</Link>} />
      {category.length > 0 ? (
        <p className="mb-4 text-sm text-muted">
          Showing {rows[0]?.category ?? category}. <Link className="text-blue-400" href={`${base}/expenses`}>Show every cost</Link>
        </p>
      ) : null}
      <div className="mb-4">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="text-sm text-blue-500" href={`/api/export/expenses?organization=${session.organizationSlug}`} data-testid="export-expenses">Export CSV</a>
      </div>
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Tax</th>
              <th className="px-4 py-3 text-right">Gross</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-4 py-3">{row.date}</td>
                <td className="px-4 py-3">{row.detail}<span className="block text-xs text-muted">{row.reference} · {row.supplier}</span></td>
                <td className="px-4 py-3">{row.property}</td>
                <td className="px-4 py-3">{row.category}</td>
                <td className="px-4 py-3">{row.tax}</td>
                <td className="px-4 py-3 text-right"><Money pence={row.grossPence} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
