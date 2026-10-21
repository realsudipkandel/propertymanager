import { PageHeader } from "@/components/PageHeader";
import { ConnectChannelForm, DisconnectChannelForm } from "@/features/channels/ChannelForms";
import { ChannelTabs } from "@/features/channels/ChannelTabs";
import { organizationPath } from "@/domain/organization";
import { canMutateFinance } from "@/domain/permissions";
import { connectableProviders, listChannelAccounts } from "@/server/channels";
import { requireSession } from "@/server/session";

const STATUS_LABEL: Record<string, string> = {
  AUTHORIZING: "Authorising",
  MAPPING_REQUIRED: "Mapping required",
  ACTIVE: "Active",
  DEGRADED: "Degraded",
  ACTION_REQUIRED: "Action required",
  DISCONNECTED: "Disconnected",
};

export default async function ChannelConnectionsPage() {
  const session = await requireSession();
  const base = organizationPath(session.organizationSlug);
  const [accounts, providers] = await Promise.all([listChannelAccounts(session), connectableProviders()]);
  const canManage = canMutateFinance(session.role);
  return (
    <div>
      <PageHeader eyebrow="Channels" title="Connections" detail="Each connection carries its own capability registry — the UI only offers what that channel actually supports." />
      <ChannelTabs base={base} active="/channels/connections" />
      <div className="grid gap-4 md:grid-cols-2">
        {accounts.length === 0 ? <p className="text-sm text-muted">No channels connected yet.</p> : null}
        {accounts.map((account) => (
          <article key={account.id} className="glass-card p-5" data-testid={`channel-account-${account.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{account.providerLabel}</h2>
                <p className="text-sm text-muted">{account.displayName}</p>
              </div>
              <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold">{STATUS_LABEL[account.status] ?? account.status}</span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-muted">Listings mapped</dt><dd>{account.listingCount}</dd></div>
              <div><dt className="text-muted">Last sync</dt><dd>{account.lastSyncAt ?? "Never"}</dd></div>
            </dl>
            <p className="mt-3 text-xs uppercase tracking-wide text-muted">Capabilities</p>
            <p className="mt-1 text-sm">{account.capabilities.join(" · ") || "None"}</p>
            {canManage && account.status !== "DISCONNECTED" ? (
              <div className="mt-4"><DisconnectChannelForm channelAccountId={account.id} /></div>
            ) : null}
          </article>
        ))}
      </div>
      {canManage ? (
        <div className="mt-6">
          <ConnectChannelForm providers={providers} />
        </div>
      ) : null}
    </div>
  );
}
