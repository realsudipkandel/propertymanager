import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { canAccessPath, homeForRole, navForRole } from "@/domain/navigation";
import { canCreateOrganization } from "@/domain/permissions";
import { isUserRole } from "@/domain/membership";
import { organizationPath, pathWithinOrganization } from "@/domain/organization";
import { prisma } from "@/server/db";
import { requireOrganization } from "@/server/session";

function membershipCanCreateOrganization(membership: { role: string }): boolean {
  return isUserRole(membership.role) && canCreateOrganization(membership.role);
}

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await requireOrganization(slug);
  const pathname = (await headers()).get("x-pathname") ?? organizationPath(slug);
  const within = pathWithinOrganization(pathname) ?? "/";
  if (!canAccessPath(session.role, within)) {
    redirect(organizationPath(slug, homeForRole(session.role)));
  }
  const memberships = await prisma.organizationMembership.findMany({
    where: { userId: session.userId, status: "ACTIVE" },
    include: { organization: true },
    orderBy: { organization: { tradingName: "asc" } },
  });
  const allowCreate = memberships.some(membershipCanCreateOrganization);
  return (
    <AppShell
      companyName={memberships.find((membership) => membership.organizationId === session.organizationId)?.organization.tradingName ?? slug}
      logoUrl={memberships.find((membership) => membership.organizationId === session.organizationId)?.organization.logoUrl ?? null}
      userName={session.name}
      orgBase={organizationPath(slug)}
      items={navForRole(session.role).map((item) => ({ ...item, href: organizationPath(slug, item.href) }))}
      memberships={memberships.map((membership) => ({
        slug: membership.organization.slug,
        name: membership.organization.tradingName,
      }))}
      canCreateOrganization={allowCreate}
    >
      {children}
    </AppShell>
  );
}
