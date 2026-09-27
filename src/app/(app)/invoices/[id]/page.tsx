import { notFound } from "next/navigation";

import { BrandLogo } from "@/components/BrandLogo";
import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { INVOICE_LABEL } from "@/domain/labels";
import { PaymentForm } from "@/features/forms/LedgerForms";
import { getInvoice } from "@/server/queries";
import { requireSession } from "@/server/session";

function AddressLine({ line }: { line: string }) {
  return <p className="text-sm">{line}</p>;
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const invoice = await getInvoice(session, id);
  if (!invoice) {
    notFound();
  }
  const vatNotice = invoice.vatRegistered
    ? `VAT number ${invoice.vatNumber ?? "not recorded"}`
    : "Not VAT registered. This document is not a VAT invoice.";
  return (
    <div>
      <PageHeader eyebrow={INVOICE_LABEL[invoice.status]} title={invoice.number} detail={`${invoice.customer} · issued ${invoice.issued} · due ${invoice.due}`} action={<a className="primary-button" href={`/api/invoices/${invoice.id}/pdf`}>Download PDF</a>} />
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-card p-6" data-testid="invoice-preview">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="w-44 rounded-2xl bg-[#050505] px-3 py-3">
              <BrandLogo className="h-auto w-full" priority />
            </div>
            <div className="text-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Invoice</p>
              <p className="text-lg font-semibold">{invoice.number}</p>
              <p>Issued {invoice.issued}</p>
              <p>Due {invoice.due}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div data-testid="invoice-from-address">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">From</p>
              <p className="mt-1 font-semibold">{invoice.company}</p>
              {invoice.addressLines.map((line) => (
                <AddressLine key={line} line={line} />
              ))}
              {invoice.companyNumber ? <p className="text-sm">Company number {invoice.companyNumber}</p> : null}
              <p className="text-sm">{invoice.email}</p>
              {invoice.phone ? <p className="text-sm">{invoice.phone}</p> : null}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Bill to</p>
              <p className="mt-1 font-semibold">{invoice.customer}</p>
              {invoice.customerEmail ? <p className="text-sm">{invoice.customerEmail}</p> : null}
            </div>
          </div>
          <table className="mt-6 w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-2">Description</th>
                <th className="py-2 text-right">Net</th>
                <th className="py-2 text-right">VAT</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={`${item.description}-${item.grossPence}`} className="border-t border-line">
                  <td className="py-2">{item.description}</td>
                  <td className="py-2 text-right"><Money pence={item.netPence} /></td>
                  <td className="py-2 text-right"><Money pence={item.vatPence} /></td>
                  <td className="py-2 text-right"><Money pence={item.grossPence} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-6 space-y-2 text-sm">
            <div className="flex justify-between"><dt>Net</dt><dd><Money pence={invoice.netPence} /></dd></div>
            <div className="flex justify-between"><dt>VAT</dt><dd><Money pence={invoice.vatPence} /></dd></div>
            <div className="flex justify-between font-semibold"><dt>Total</dt><dd><Money pence={invoice.totalPence} /></dd></div>
            <div className="flex justify-between"><dt>Paid</dt><dd><Money pence={invoice.paidPence} /></dd></div>
            <div className="flex justify-between"><dt>Balance due</dt><dd><Money pence={invoice.balancePence} testId="invoice-balance" /></dd></div>
          </dl>
          {invoice.notes ? <p className="mt-4 text-sm text-muted">{invoice.notes}</p> : null}
          <p className="mt-4 text-sm text-muted">{vatNotice}</p>
          <h2 className="mt-6 font-semibold">Payments</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {invoice.payments.map((payment) => (
              <li key={payment.reference} className="flex justify-between">
                <span>{payment.date} · {payment.reference}</span>
                <Money pence={payment.amountPence} />
              </li>
            ))}
          </ul>
        </div>
        {invoice.balancePence > 0 ? <PaymentForm invoiceId={invoice.id} /> : <p className="text-sm text-muted">This invoice is settled.</p>}
      </section>
    </div>
  );
}
