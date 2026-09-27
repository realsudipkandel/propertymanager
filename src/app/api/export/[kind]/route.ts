import { serialiseCsv } from "@/domain/csv";
import { exportRows } from "@/server/queries";
import { getSession } from "@/server/session";

const KINDS = ["expenses", "income", "bookings"] as const;

type ExportKind = (typeof KINDS)[number];

function isKind(value: string): value is ExportKind {
  return KINDS.includes(value as ExportKind);
}

export async function GET(_request: Request, context: { params: Promise<{ kind: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return new Response("Sign in required.", { status: 401 });
  }
  const { kind } = await context.params;
  if (!isKind(kind)) {
    return new Response("Unknown export.", { status: 404 });
  }
  const table = await exportRows(session, kind);
  const body = serialiseCsv(table.headers, table.rows);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}.csv"`,
    },
  });
}
