import { canViewFinance, canViewOperations } from "@/domain/permissions";
import { serialiseCsv } from "@/domain/csv";
import { attachmentDisposition } from "@/domain/files";
import { exportRows } from "@/server/queries";
import { isSession, requireApiSession } from "@/server/session";

const KINDS = ["expenses", "income", "bookings"] as const;

type ExportKind = (typeof KINDS)[number];

function isKind(value: string): value is ExportKind {
  return KINDS.includes(value as ExportKind);
}

export async function GET(request: Request, context: { params: Promise<{ kind: string }> }): Promise<Response> {
  const slug = new URL(request.url).searchParams.get("organization");
  const session = await requireApiSession(slug);
  if (!isSession(session)) {
    return session;
  }
  const { kind } = await context.params;
  if (!isKind(kind)) {
    return new Response("Unknown export.", { status: 404 });
  }
  const financeExport = kind === "expenses" || kind === "income";
  const allowed = financeExport ? canViewFinance(session.role) : canViewOperations(session.role) || canViewFinance(session.role);
  if (!allowed) {
    return new Response("You do not have permission to do that.", { status: 403 });
  }
  const table = await exportRows(session, kind);
  const body = serialiseCsv(table.headers, table.rows);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": attachmentDisposition(`${kind}.csv`),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
