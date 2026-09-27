import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { resolveStoragePath } from "@/domain/files";
import { prisma } from "@/server/db";
import { getSession } from "@/server/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return new Response("Sign in required.", { status: 401 });
  }
  const { id } = await context.params;
  const document = await prisma.document.findFirst({
    where: { id, tenantId: session.tenantId, companyId: session.companyId },
  });
  if (!document) {
    return new Response("Not found.", { status: 404 });
  }
  const absolute = resolveStoragePath(path.join(process.cwd(), "storage"), document.storageKey);
  if (!absolute) {
    return new Response("Not found.", { status: 404 });
  }
  try {
    const info = await stat(absolute);
    const stream = createReadStream(absolute);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(info.size),
        "Content-Disposition": `attachment; filename="${document.title.replaceAll('"', "")}"`,
      },
    });
  } catch {
    return new Response("File missing.", { status: 404 });
  }
}
