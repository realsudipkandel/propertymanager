import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { UpdateDailyRatesForm } from "@/features/channels/ChannelForms";
import { ChannelTabs } from "@/features/channels/ChannelTabs";
import { organizationPath } from "@/domain/organization";
import { canMutateFinance } from "@/domain/permissions";
import { dailyRates } from "@/server/channels";
import { prisma } from "@/server/db";
import { organizationScope, requireSession } from "@/server/session";

export default async function ChannelRatesPage({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) {
  const session = await requireSession();
  const base = organizationPath(session.organizationSlug);
  const { propertyId: requestedId } = await searchParams;
  const properties = await prisma.property.findMany({ where: organizationScope(session), orderBy: { name: "asc" } });
  const propertyId = requestedId ?? properties[0]?.id ?? null;
  const rates = propertyId ? await dailyRates(session, propertyId) : null;
  const canManage = canMutateFinance(session.role);
  return (
    <div>
      <PageHeader eyebrow="Channels" title="Rates & inventory" detail="One canonical base rate per property per night. Each connected channel's published price is this rate plus its own markup — never typed in separately." />
      <ChannelTabs base={base} active="/channels/rates" />
      <div className="mb-4 flex flex-wrap gap-2">
        {properties.map((property) => (
          <Link
            key={property.id}
            href={`${base}/channels/rates?propertyId=${property.id}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${property.id === propertyId ? "bg-white/15" : "text-muted hover:text-foreground"}`}
          >
            {property.name}
          </Link>
        ))}
      </div>
      {rates ? (
        <>
          <div className="glass-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Base rate</th>
                  <th className="px-4 py-3 text-right">Min stay</th>
                  <th className="px-4 py-3">Stop sell</th>
                  {rates.channels.map((channel) => (
                    <th key={channel.mappingId} className="px-4 py-3 text-right">{channel.provider}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rates.days.map((day) => (
                  <tr key={day.date} className="border-t border-line" data-testid={`rate-${day.date}`}>
                    <td className="px-4 py-3">{day.date}</td>
                    <td className="px-4 py-3 text-right">{day.basePricePence === null ? "Not set" : `£${(day.basePricePence / 100).toFixed(2)}`}</td>
                    <td className="px-4 py-3 text-right">{day.minStay}</td>
                    <td className="px-4 py-3">{day.stopSell ? "Closed" : "Open"}</td>
                    {rates.channels.map((channel) => {
                      const price = day.channelPrices.find((item) => item.provider === channel.provider);
                      return (
                        <td key={channel.mappingId} className="px-4 py-3 text-right">
                          {price ? `£${(price.pricePence / 100).toFixed(2)}` : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canManage ? (
            <div className="mt-6">
              <UpdateDailyRatesForm propertyId={propertyId!} />
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted">Add a property to manage rates.</p>
      )}
    </div>
  );
}
