import { PageHeader } from "@/components/PageHeader";
import { CreateListingMappingForm, ImportReservationsForm } from "@/features/channels/ChannelForms";
import { ChannelTabs } from "@/features/channels/ChannelTabs";
import { organizationPath } from "@/domain/organization";
import { canMutateFinance } from "@/domain/permissions";
import { listListingMappings, mappingFormOptions } from "@/server/channels";
import { requireSession } from "@/server/session";

const SYNC_MODE_LABEL: Record<string, string> = {
  FULL_SYNC: "Full sync",
  ARI_ONLY: "ARI only",
  RESERVATIONS_ONLY: "Reservations only",
};

export default async function ChannelMappingPage() {
  const session = await requireSession();
  const base = organizationPath(session.organizationSlug);
  const [mappings, options] = await Promise.all([listListingMappings(session), mappingFormOptions(session)]);
  const canManage = canMutateFinance(session.role);
  return (
    <div>
      <PageHeader
        eyebrow="Channels"
        title="Listings & mapping"
        detail="Property → unit type → channel listing, never one flat property-to-listing assumption. Pulling reservations is idempotent and double-booking-safe."
      />
      <ChannelTabs base={base} active="/channels/mapping" />
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">External listing id</th>
              <th className="px-4 py-3">Sync mode</th>
              <th className="px-4 py-3 text-right">Markup</th>
              <th className="px-4 py-3">Pull reservations</th>
            </tr>
          </thead>
          <tbody>
            {mappings.length === 0 ? (
              <tr><td className="px-4 py-6 text-muted" colSpan={6}>No listings mapped yet. Connect a channel, then map a property to one of its listings below.</td></tr>
            ) : null}
            {mappings.map((mapping) => (
              <tr key={mapping.id} className="border-t border-line" data-testid={`mapping-${mapping.id}`}>
                <td className="px-4 py-3">{mapping.property}</td>
                <td className="px-4 py-3">{mapping.provider}</td>
                <td className="px-4 py-3">{mapping.externalListingId}</td>
                <td className="px-4 py-3">{SYNC_MODE_LABEL[mapping.syncMode] ?? mapping.syncMode}</td>
                <td className="px-4 py-3 text-right">{(mapping.markupBps / 100).toFixed(1)}%</td>
                <td className="px-4 py-3">{canManage ? <ImportReservationsForm mappingId={mapping.id} /> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canManage ? (
        <div className="mt-6">
          <CreateListingMappingForm properties={options.properties} accounts={options.accounts} />
        </div>
      ) : null}
    </div>
  );
}
