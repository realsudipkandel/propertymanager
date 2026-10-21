import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import { ChannelTabs } from "@/features/channels/ChannelTabs";
import { formatMargin } from "@/domain/money";
import { organizationPath } from "@/domain/organization";
import { channelOverview } from "@/server/channels";
import { requireSession } from "@/server/session";

export default async function ChannelsOverviewPage() {
  const session = await requireSession();
  const base = organizationPath(session.organizationSlug);
  const overview = await channelOverview(session);
  return (
    <div>
      <PageHeader
        eyebrow="Channels"
        title="Distribution overview"
        detail={`${overview.windowLabel}. Mira holds the canonical property, rate and reservation data — every channel below is a connected adapter around it.`}
      />
      <ChannelTabs base={base} active="/channels" />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Gross revenue" pence={overview.grossRevenuePence} testId="stat-gross" />
        <StatCard label="Net of commission" pence={overview.netRevenuePence} testId="stat-net" />
        <StatCard label="Bookings" hint={String(overview.bookingCount)} testId="stat-bookings" />
        <StatCard label="Occupied nights" hint={String(overview.occupiedNights)} testId="stat-nights" />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <StatCard
          label="Occupancy"
          hint={overview.kpis.occupancyBps === null ? "—" : formatMargin(overview.kpis.occupancyBps)}
          testId="stat-occupancy"
        />
        <StatCard label="ADR" pence={overview.kpis.adrPence ?? undefined} hint={overview.kpis.adrPence === null ? "—" : undefined} testId="stat-adr" />
        <StatCard label="RevPAR" pence={overview.kpis.revparPence ?? undefined} hint={overview.kpis.revparPence === null ? "—" : undefined} testId="stat-revpar" />
        <StatCard
          label="Connected channels"
          hint={`${overview.connectivity.connectedAccounts} / ${overview.connectivity.totalAccounts} active · ${overview.connectivity.mappedListings} listings mapped`}
          testId="stat-connectivity"
        />
      </div>
      <div className="glass-card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3 text-right">Bookings</th>
              <th className="px-4 py-3 text-right">Nights</th>
              <th className="px-4 py-3 text-right">Gross revenue</th>
              <th className="px-4 py-3 text-right">Commission</th>
              <th className="px-4 py-3 text-right">Revenue share</th>
              <th className="px-4 py-3 text-right">Margin</th>
            </tr>
          </thead>
          <tbody>
            {overview.channelShare.length === 0 ? (
              <tr><td className="px-4 py-6 text-muted" colSpan={7}>No reservations in the trailing 30 days yet. Connect a channel and pull reservations to populate this view.</td></tr>
            ) : null}
            {overview.channelShare.map((row) => (
              <tr key={`${row.provider}-${row.label}`} className="border-t border-line" data-testid={`channel-share-${row.provider}`}>
                <td className="px-4 py-3">{row.provider}<span className="block text-xs text-muted">{row.label}</span></td>
                <td className="px-4 py-3 text-right">{row.bookings}</td>
                <td className="px-4 py-3 text-right">{row.nights}</td>
                <td className="px-4 py-3 text-right">£{(row.grossPence / 100).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">£{(row.commissionPence / 100).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">{row.revenueShareBps === null ? "—" : formatMargin(row.revenueShareBps)}</td>
                <td className="px-4 py-3 text-right">{row.marginBps === null ? "—" : formatMargin(row.marginBps)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
