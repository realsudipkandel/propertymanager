import { PageHeader } from "@/components/PageHeader";
import { InvoiceForm } from "@/features/forms/LedgerForms";
import { bookingFormOptions } from "@/server/queries";
import { requireSession } from "@/server/session";

export default async function NewInvoicePage() {
  const session = await requireSession();
  const options = await bookingFormOptions(session);
  return (
    <div>
      <PageHeader eyebrow="Invoices" title="Issue an invoice" detail="VAT is added only when the company is marked VAT registered. Otherwise the invoice says it is not a VAT invoice." />
      <InvoiceForm customers={options.customers} />
    </div>
  );
}
