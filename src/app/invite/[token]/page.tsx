import { ROLE_LABEL } from "@/domain/labels";
import { inviteIsOpen, isUserRole } from "@/domain/membership";
import { AcceptInviteForm } from "@/features/people/PeopleAccess";
import { prisma } from "@/server/db";
import { hashInviteToken } from "@/server/invite-token";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: { organization: true },
  });
  const open = invitation && isUserRole(invitation.role) && inviteIsOpen({
    expiresAt: invitation.expiresAt,
    acceptedAt: invitation.acceptedAt,
    revokedAt: invitation.revokedAt,
    now: new Date(),
  });
  if (!invitation || !open) {
    return (
      <main className="mx-auto grid min-h-screen max-w-md place-items-center px-4">
        <section className="glass-card p-6" data-testid="invite-closed">
          <h1 className="text-xl font-semibold">Invite closed</h1>
          <p className="mt-2 text-sm text-muted">This invite is no longer valid. Ask an owner for a new link.</p>
        </section>
      </main>
    );
  }
  return (
    <AcceptInviteForm
      token={token}
      email={invitation.email}
      companyName={invitation.organization.tradingName}
      roleLabel={ROLE_LABEL[invitation.role]}
    />
  );
}
