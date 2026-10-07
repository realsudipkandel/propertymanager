import { PageHeader } from "@/components/PageHeader";
import { SettingsForm } from "@/features/forms/LedgerForms";
import { CreateOrganizationForm } from "@/features/organisations/CreateOrganizationForm";
import { canManageSettings } from "@/domain/permissions";
import { getSettings } from "@/server/queries";
import { requireSession } from "@/server/session";

export default async function SettingsPage() {
  const session = await requireSession();
  const settings = await getSettings(session);
  const canManage = canManageSettings(session.role);
  return (
    <div className="grid gap-6">
      <div>
        <PageHeader eyebrow="Settings" title={settings.legalName} detail={`${settings.address} · ${settings.email}`} />
        <p className="mb-4 text-sm text-muted">Company number {settings.companyNumber}. Financial year starts {settings.yearStartDay}/{settings.yearStartMonth}. Records are kept for {settings.retentionYears} years.</p>
        {canManage ? (
          <SettingsForm tradingName={settings.tradingName} phone={settings.phone} vatRegistered={settings.vatRegistered} retentionYears={settings.retentionYears} />
        ) : <p className="text-sm text-muted">Only an owner or organisation admin can change company settings.</p>}
        {canManage ? (
          <section className="mt-6" data-testid="settings-create-organisation">
            <h2 className="mb-3 font-semibold">Create organisation</h2>
            <CreateOrganizationForm email={session.email} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
