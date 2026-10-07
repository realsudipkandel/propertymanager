import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { attachmentDisposition, contentTypeForStorageKey, resolveStoragePath } from "@/domain/files";
import { prisma } from "@/server/db";
import { isSession, requireApiSession } from "@/server/session";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const slug = new URL(request.url).searchParams.get("organization");
  const session = await requireApiSession(slug);
  if (!isSession(session)) {
    return session;
  }
  const { id } = await context.params;
  const document = await prisma.document.findFirst({
    where: { id, tenantId: session.tenantId, organizationId: session.organizationId },
  });
  if (!document) {
    return new Response("Not found.", { status: 404 });
  }
  const contentType = contentTypeForStorageKey(document.storageKey);
  const absolute = resolveStoragePath(path.join(process.cwd(), "storage"), document.storageKey);
  if (!contentType || !absolute) {
    return new Response("Not found.", { status: 404 });
  }
  try {
    const info = await stat(absolute);
    const stream = createReadStream(absolute);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(info.size),
        "Content-Disposition": attachmentDisposition(document.title),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("File missing.", { status: 404 });
  }
}
