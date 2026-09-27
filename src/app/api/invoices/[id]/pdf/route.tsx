import path from "node:path";

import { renderToBuffer } from "@react-pdf/renderer";

import { InvoiceDocument } from "@/features/invoices/InvoiceDocument";
import { getInvoice } from "@/server/queries";
import { getSession } from "@/server/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return new Response("Sign in required.", { status: 401 });
  }
  const { id } = await context.params;
  const invoice = await getInvoice(session, id);
  if (!invoice) {
    return new Response("Not found.", { status: 404 });
  }
  const buffer = await renderToBuffer(
    <InvoiceDocument
      number={invoice.number}
      company={invoice.company}
      addressLines={invoice.addressLines}
      companyNumber={invoice.companyNumber}
      email={invoice.email}
      phone={invoice.phone}
      vatRegistered={invoice.vatRegistered}
      vatNumber={invoice.vatNumber}
      customer={invoice.customer}
      customerEmail={invoice.customerEmail}
      issued={invoice.issued}
      due={invoice.due}
      notes={invoice.notes}
      items={invoice.items}
      netPence={invoice.netPence}
      vatPence={invoice.vatPence}
      totalPence={invoice.totalPence}
      paidPence={invoice.paidPence}
      balancePence={invoice.balancePence}
      logoPath={path.join(process.cwd(), "public/brand/mira-logo.png")}
    />,
  );
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.number}.pdf"`,
    },
  });
}
