import { Prisma, type PrismaClient } from "@prisma/client";

import type { Session } from "@/server/session";

type Writer = Prisma.TransactionClient | PrismaClient;

export async function appendAuditLog(
  client: Writer,
  session: Session,
  entry: {
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
  },
): Promise<void> {
  await client.auditLog.create({
    data: {
      tenantId: session.tenantId,
      companyId: session.companyId,
      actorId: session.userId,
      actorName: session.name,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      summary: entry.summary,
    },
  });
}
