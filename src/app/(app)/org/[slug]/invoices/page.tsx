import Link from "next/link";

import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { INVOICE_LABEL } from "@/domain/labels";
import type { InvoiceStatus } from "@/domain/constants";
import { organizationPath } from "@/domain/organization";
import { ageingSummary, listInvoices } from "@/server/queries";
import { requireSession } from "@/server/session";

export default async function InvoicesPage() {
  const session = await requireSession();
  const base = organizationPath(session.organizationSlug);
  const [invoices, ageing] = await Promise.all([listInvoices(session), ageingSummary(session)]);
  return (
    <div>
      <PageHeader eyebrow="Invoices" title="Accounts receivable" detail="An invoice can have no payments, one payment, or several. The balance is what is still owed." action={<Link className="primary-button" href={`${base}/invoices/new`}>New invoice</Link>} />
      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <article className="glass-card p-4"><p className="text-xs text-muted">Current</p><Money pence={ageing.current} /></article>
        <article className="glass-card p-4"><p className="text-xs text-muted">1–30 days</p><Money pence={ageing.days1to30} /></article>
        <article className="glass-card p-4"><p className="text-xs text-muted">31–60 days</p><Money pence={ageing.days31to60} /></article>
        <article className="glass-card p-4"><p className="text-xs text-muted">60+ days</p><Money pence={ageing.days61plus} /></article>
      </section>
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-t border-line">
                <td className="px-4 py-3"><Link className="text-blue-500" href={`${base}/invoices/${invoice.id}`}>{invoice.number}</Link></td>
                <td className="px-4 py-3">{invoice.customer}</td>
                <td className="px-4 py-3">{invoice.due}</td>
                <td className="px-4 py-3">{INVOICE_LABEL[invoice.status as InvoiceStatus]}</td>
                <td className="px-4 py-3 text-right"><Money pence={invoice.balancePence} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
