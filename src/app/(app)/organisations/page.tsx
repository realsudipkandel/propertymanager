import Link from "next/link";
import { redirect } from "next/navigation";

import { organizationPath } from "@/domain/organization";
import { prisma } from "@/server/db";
import { getAuthenticatedUser, userCanCreateOrganization } from "@/server/session";

type OrganisationChoice = {
  id: string;
  slug: string;
  tradingName: string;
};

function renderOrganisationChoice(membership: OrganisationChoice) {
  return (
    <li key={membership.id}>
      <Link className="glass-card block p-4" href={organizationPath(membership.slug)}>
        {membership.tradingName}
      </Link>
    </li>
  );
}

export default async function OrganisationsPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }
  const [memberships, canCreate] = await Promise.all([
    prisma.organizationMembership.findMany({
      where: { userId: user.userId, status: "ACTIVE" },
      include: { organization: true },
      orderBy: { organization: { tradingName: "asc" } },
    }),
    userCanCreateOrganization(user.userId),
  ]);
  const choices = memberships.map(toOrganisationChoice);
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-semibold">Choose an organisation</h1>
      {choices.length === 0 ? <p className="mt-6 text-muted">You do not belong to an organisation yet. Ask an owner or organisation admin to invite you.</p> : null}
      <ul className="mt-6 space-y-3" data-testid="organisation-list">
        {choices.map(renderOrganisationChoice)}
      </ul>
      {canCreate ? <p className="mt-6"><Link className="text-blue-500" href="/organisations/new" data-testid="create-organisation-link">Create organisation</Link></p> : null}
    </main>
  );
}

function toOrganisationChoice(membership: { id: string; organization: { slug: string; tradingName: string } }): OrganisationChoice {
  return {
    id: membership.id,
    slug: membership.organization.slug,
    tradingName: membership.organization.tradingName,
  };
}
