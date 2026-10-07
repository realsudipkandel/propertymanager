"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/SubmitButton";
import { USER_ROLE, type UserRole } from "@/domain/constants";
import { idleFormState } from "@/domain/form-state";
import { ROLE_LABEL } from "@/domain/labels";
import { acceptInviteAction, createMemberAction, inviteUserAction, revokeInviteAction, updateMemberAction } from "@/server/mutations";

export type MemberRecord = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

export type InviteRecord = {
  id: string;
  email: string;
  role: UserRole;
  expiresLabel: string;
};

const ROLE_OPTIONS = Object.values(USER_ROLE);
const INTENT_ROLE = "role";
const INTENT_DEACTIVATE = "deactivate";
const INTENT_ACTIVATE = "activate";

function RoleOption({ role }: { role: UserRole }) {
  return <option value={role}>{ROLE_LABEL[role]}</option>;
}

function renderRoleOption(role: UserRole) {
  return <RoleOption key={role} role={role} />;
}

function CreateMemberForm() {
  const [state, action] = useActionState(createMemberAction, idleFormState);
  return (
    <form action={action} className="mt-4 grid gap-3" data-testid="create-user-form">
      <label className="text-sm">Name
        <input className="glass-input mt-1" name="name" autoComplete="off" data-testid="create-user-name" />
      </label>
      <label className="text-sm">Email
        <input className="glass-input mt-1" name="email" type="email" autoComplete="off" data-testid="create-user-email" />
      </label>
      <label className="text-sm">Password
        <input className="glass-input mt-1" name="password" type="password" autoComplete="new-password" data-testid="create-user-password" />
      </label>
      <label className="text-sm">Confirm password
        <input className="glass-input mt-1" name="confirmPassword" type="password" autoComplete="new-password" />
      </label>
      <label className="text-sm">Role
        <select className="glass-input mt-1" name="role" defaultValue={USER_ROLE.VIEWER} data-testid="create-user-role">
          {ROLE_OPTIONS.map(renderRoleOption)}
        </select>
      </label>
      {state.fieldErrors.name ? <p className="text-sm text-pink-500">{state.fieldErrors.name}</p> : null}
      {state.fieldErrors.email ? <p className="text-sm text-pink-500">{state.fieldErrors.email}</p> : null}
      {state.fieldErrors.password ? <p className="text-sm text-pink-500">{state.fieldErrors.password}</p> : null}
      {state.fieldErrors.confirmPassword ? <p className="text-sm text-pink-500">{state.fieldErrors.confirmPassword}</p> : null}
      {state.fieldErrors.role ? <p className="text-sm text-pink-500">{state.fieldErrors.role}</p> : null}
      {state.ok ? <p className="text-sm text-emerald-400" data-testid="create-user-success">{state.message}</p> : null}
      {state.message && !state.ok ? <p className="text-sm text-pink-500">{state.message}</p> : null}
      <SubmitButton label="Create user" pendingLabel="Creating…" />
    </form>
  );
}

function InviteForm() {
  const [state, action] = useActionState(inviteUserAction, idleFormState);
  function copyInviteLink() {
    const inviteUrl = state.inviteUrl;
    if (!inviteUrl) {
      return;
    }
    void navigator.clipboard.writeText(inviteUrl);
  }
  return (
    <form action={action} className="mt-4 grid gap-3" data-testid="invite-form">
      <label className="text-sm">Email
        <input className="glass-input mt-1" name="email" type="email" autoComplete="off" data-testid="invite-email" />
      </label>
      <label className="text-sm">Role
        <select className="glass-input mt-1" name="role" defaultValue={USER_ROLE.VIEWER} data-testid="invite-role">
          {ROLE_OPTIONS.map(renderRoleOption)}
        </select>
      </label>
      {state.fieldErrors.email ? <p className="text-sm text-pink-500">{state.fieldErrors.email}</p> : null}
      {state.inviteUrl ? <p className="text-sm text-muted">{state.message}</p> : null}
      {state.message && !state.inviteUrl ? <p className="text-sm text-pink-500">{state.message}</p> : null}
      {state.inviteUrl ? (
        <div className="grid gap-2">
          <input className="glass-input" readOnly value={state.inviteUrl} data-testid="invite-link" />
          <button className="rounded-full border border-white/15 px-3 py-2 text-sm" type="button" onClick={copyInviteLink}>Copy link</button>
        </div>
      ) : null}
      <SubmitButton label="Create invite link" pendingLabel="Creating…" />
    </form>
  );
}

function MemberAccess({ member, actorUserId, canManage }: { member: MemberRecord; actorUserId: string; canManage: boolean }) {
  const [state, action] = useActionState(updateMemberAction, idleFormState);
  const isSelf = member.id === actorUserId;
  return (
    <form action={action} className="grid gap-2 border-b border-white/10 py-3 last:border-0" data-testid={`member-${member.email}`}>
      <input type="hidden" name="userId" value={member.id} />
      <p className="text-sm font-medium">{member.name}</p>
      <p className="text-sm text-muted">{member.email} · {ROLE_LABEL[member.role]}{member.isActive ? "" : " · access off"}</p>
      {canManage && !isSelf ? (
        <div className="flex flex-wrap items-center gap-2">
          <select className="glass-input" name="role" defaultValue={member.role} aria-label={`Role for ${member.name}`}>
            {ROLE_OPTIONS.map(renderRoleOption)}
          </select>
          <button className="primary-button" type="submit" name="intent" value={INTENT_ROLE}>Save role</button>
          {member.isActive ? (
            <button className="rounded-full border border-white/15 px-3 py-2 text-sm" type="submit" name="intent" value={INTENT_DEACTIVATE}>Turn access off</button>
          ) : (
            <button className="primary-button" type="submit" name="intent" value={INTENT_ACTIVATE}>Turn access on</button>
          )}
        </div>
      ) : null}
      {canManage && isSelf ? <p className="text-sm text-muted">This is you</p> : null}
      {state.message ? <p className="text-sm text-muted">{state.message}</p> : null}
    </form>
  );
}

function PendingInvite({ invite }: { invite: InviteRecord }) {
  const [state, action] = useActionState(revokeInviteAction, idleFormState);
  return (
    <form action={action} className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid={`invite-${invite.email}`}>
      <input type="hidden" name="invitationId" value={invite.id} />
      <p className="text-sm">{invite.email} · {ROLE_LABEL[invite.role]} · expires {invite.expiresLabel}</p>
      <button className="rounded-full border border-white/15 px-3 py-2 text-sm" type="submit">Revoke</button>
      {state.message ? <p className="text-sm text-muted">{state.message}</p> : null}
    </form>
  );
}

export function PeopleAccess({
  actorUserId,
  canManage,
  members,
  invites,
  organizationName,
}: {
  actorUserId: string;
  canManage: boolean;
  members: MemberRecord[];
  invites: InviteRecord[];
  organizationName: string;
}) {
  function renderMember(member: MemberRecord) {
    return <MemberAccess key={member.id} member={member} actorUserId={actorUserId} canManage={canManage} />;
  }
  function renderInvite(invite: InviteRecord) {
    return <PendingInvite key={invite.id} invite={invite} />;
  }
  return (
    <section className="glass-card p-6" data-testid="people-access">
      <h2 className="font-semibold">People in {organizationName}</h2>
      <p className="mt-2 text-sm text-muted">These accounts belong to {organizationName}. They do not appear in another organisation unless an admin adds them there.</p>
      {canManage ? <CreateMemberForm /> : <p className="mt-2 text-sm text-muted">Only an owner or organisation admin can add people or change roles.</p>}
      {canManage ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted">Invite with a link instead</summary>
          <InviteForm />
        </details>
      ) : null}
      <div className="mt-4">{members.map(renderMember)}</div>
      {canManage && invites.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Pending invites</h3>
          {invites.map(renderInvite)}
        </div>
      ) : null}
    </section>
  );
}

export function AcceptInviteForm({ token, email, companyName, roleLabel }: {
  token: string;
  email: string;
  companyName: string;
  roleLabel: string;
}) {
  const [state, action] = useActionState(acceptInviteAction, idleFormState);
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-4">
      <form action={action} className="glass-card grid w-full gap-4 p-6" data-testid="accept-invite">
        <h1 className="text-xl font-semibold">Join {companyName}</h1>
        <p className="text-sm text-muted">{email} · {roleLabel}</p>
        <input type="hidden" name="token" value={token} />
        <label className="text-sm">Your name
          <input className="glass-input mt-1" name="name" autoComplete="name" data-testid="accept-name" />
        </label>
        <label className="text-sm">Password
          <input className="glass-input mt-1" name="password" type="password" autoComplete="new-password" data-testid="accept-password" />
        </label>
        <label className="text-sm">Confirm password
          <input className="glass-input mt-1" name="confirmPassword" type="password" autoComplete="new-password" />
        </label>
        {state.message ? <p className="text-sm text-pink-500">{state.message}</p> : null}
        <SubmitButton label="Create account" pendingLabel="Creating…" />
      </form>
    </main>
  );
}
