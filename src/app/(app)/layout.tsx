import { navForRole } from "@/domain/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/server/db";
import { requireSession } from "@/server/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const company = await prisma.company.findFirst({
    where: { id: session.companyId, tenantId: session.tenantId },
  });
  return (
    <AppShell companyName={company?.tradingName ?? "Mira Properties"} userName={session.name} items={navForRole(session.role)}>
      {children}
    </AppShell>
  );
}
