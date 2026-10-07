import { PageHeader } from "@/components/PageHeader";
import { isUserRole } from "@/domain/membership";
import { PeopleAccess, type InviteRecord, type MemberRecord } from "@/features/people/PeopleAccess";
import { canManageSettings } from "@/domain/permissions";
import { getSettings } from "@/server/queries";
import { requireSession } from "@/server/session";

type ActivityEntry = {
  id: string;
  when: string;
  actor: string;
  summary: string;
};

function toMember(user: { id: string; name: string; email: string; role: string; isActive: boolean }): MemberRecord | null {
  if (!isUserRole(user.role)) {
    return null;
  }
  return { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive };
}

function toInvite(invite: { id: string; email: string; role: string; expiresLabel: string }): InviteRecord | null {
  if (!isUserRole(invite.role)) {
    return null;
  }
  return { id: invite.id, email: invite.email, role: invite.role, expiresLabel: invite.expiresLabel };
}

function renderActivity(entry: ActivityEntry) {
  return (
    <li key={entry.id} className="border-b border-white/10 py-3 last:border-0" data-testid="activity-entry">
      <p className="text-sm text-muted">{entry.when} · {entry.actor}</p>
      <p className="text-sm">{entry.summary}</p>
    </li>
  );
}

export default async function TeamPage() {
  const session = await requireSession();
  const settings = await getSettings(session);
  const canManage = canManageSettings(session.role);
  const members = settings.users.map(toMember).filter((member): member is MemberRecord => member !== null);
  const invites = settings.invites.map(toInvite).filter((invite): invite is InviteRecord => invite !== null);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <PageHeader eyebrow={settings.tradingName} title="Team" detail={`People and activity for ${settings.tradingName} only.`} />
        <PeopleAccess
          actorUserId={session.userId}
          canManage={canManage}
          members={members}
          invites={invites}
          organizationName={settings.tradingName}
        />
      </div>
      <section className="glass-card p-6" data-testid="organisation-activity">
        <h2 className="font-semibold">Activity in {settings.tradingName}</h2>
        <p className="mt-2 text-sm text-muted">This thread records changes in {settings.tradingName}. Another organisation has its own.</p>
        {settings.audit.length === 0 ? <p className="mt-4 text-sm text-muted">Nothing has been recorded yet.</p> : null}
        <ul className="mt-3">{settings.audit.map(renderActivity)}</ul>
      </section>
    </div>
  );
}
