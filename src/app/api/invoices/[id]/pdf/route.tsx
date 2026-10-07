import path from "node:path";

import { renderToBuffer } from "@react-pdf/renderer";

import { attachmentDisposition } from "@/domain/files";
import { canViewFinance } from "@/domain/permissions";
import { InvoiceDocument } from "@/features/invoices/InvoiceDocument";
import { getInvoice } from "@/server/queries";
import { isSession, requireApiSession } from "@/server/session";

function brandFilePath(logoUrl: string | null): string | undefined {
  if (!logoUrl || !logoUrl.startsWith("/brand/") || logoUrl.includes("..")) {
    return undefined;
  }
  return path.join(process.cwd(), "public", logoUrl.slice(1));
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const slug = new URL(request.url).searchParams.get("organization");
  const session = await requireApiSession(slug);
  if (!isSession(session)) {
    return session;
  }
  if (!canViewFinance(session.role)) {
    return new Response("You do not have permission to do that.", { status: 403 });
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
      logoPath={brandFilePath(invoice.logoUrl)}
    />,
  );
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": attachmentDisposition(`${invoice.number}.pdf`),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
