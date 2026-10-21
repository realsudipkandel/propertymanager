import { PageHeader } from "@/components/PageHeader";
import { ChannelTabs } from "@/features/channels/ChannelTabs";
import { organizationPath } from "@/domain/organization";
import { multiCalendar } from "@/server/channels";
import { requireSession } from "@/server/session";

export default async function ChannelCalendarPage() {
  const session = await requireSession();
  const base = organizationPath(session.organizationSlug);
  const calendar = await multiCalendar(session);
  return (
    <div>
      <PageHeader eyebrow="Channels" title="Multi-calendar" detail="Next 21 nights, one row per property. Colour reflects where a reservation holds that night." />
      <ChannelTabs base={base} active="/channels/calendar" />
      <div className="glass-card overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-[color:var(--card-bg,transparent)] px-3 py-2 text-left text-muted">Property</th>
              {calendar.dates.map((date) => (
                <th key={date} className="px-1 py-2 text-center text-muted">{date.slice(8, 10)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calendar.rows.length === 0 ? (
              <tr><td className="px-3 py-6 text-muted" colSpan={calendar.dates.length + 1}>No properties yet.</td></tr>
            ) : null}
            {calendar.rows.map((row) => (
              <tr key={row.propertyId} className="border-t border-line" data-testid={`calendar-row-${row.propertyId}`}>
                <td className="sticky left-0 whitespace-nowrap px-3 py-2 font-medium">{row.property}</td>
                {row.cells.map((cell) => (
                  <td
                    key={cell.date}
                    title={cell.occupied ? `${cell.provider} · ${cell.label}` : "Available"}
                    className={`px-1 py-2 text-center ${cell.occupied ? "bg-blue-500/30" : ""}`}
                  >
                    {cell.occupied ? "●" : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
