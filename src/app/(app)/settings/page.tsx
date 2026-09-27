import { PageHeader } from "@/components/PageHeader";
import { ROLE_LABEL } from "@/domain/labels";
import type { UserRole } from "@/domain/constants";
import { SettingsForm } from "@/features/forms/LedgerForms";
import { canManageSettings } from "@/domain/permissions";
import { getSettings } from "@/server/queries";
import { requireSession } from "@/server/session";

export default async function SettingsPage() {
  const session = await requireSession();
  const settings = await getSettings(session);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <PageHeader eyebrow="Settings" title={settings.legalName} detail={`${settings.address} · ${settings.email}`} />
        <p className="mb-4 text-sm text-muted">Company number {settings.companyNumber}. Financial year starts {settings.yearStartDay}/{settings.yearStartMonth}. Records are kept for {settings.retentionYears} years.</p>
        {canManageSettings(session.role) ? (
          <SettingsForm tradingName={settings.tradingName} phone={settings.phone} vatRegistered={settings.vatRegistered} retentionYears={settings.retentionYears} />
        ) : <p className="text-sm text-muted">Only an owner can change company settings.</p>}
      </div>
      <div className="space-y-6">
        <section className="glass-card p-6">
          <h2 className="font-semibold">People</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {settings.users.map((user) => (
              <li key={user.email}>{user.name} · {ROLE_LABEL[user.role as UserRole]}</li>
            ))}
          </ul>
        </section>
        <section className="glass-card p-6">
          <h2 className="font-semibold">Audit log</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {settings.audit.map((entry) => (
              <li key={`${entry.when}-${entry.summary}`}>
                <p className="text-muted">{entry.when} · {entry.actor}</p>
                <p>{entry.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
