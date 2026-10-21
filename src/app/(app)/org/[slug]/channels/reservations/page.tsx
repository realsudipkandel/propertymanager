import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { ChannelTabs } from "@/features/channels/ChannelTabs";
import { organizationPath } from "@/domain/organization";
import { listReservations } from "@/server/channels";
import { requireSession } from "@/server/session";

export default async function ChannelReservationsPage() {
  const session = await requireSession();
  const base = organizationPath(session.organizationSlug);
  const reservations = await listReservations(session);
  return (
    <div>
      <PageHeader eyebrow="Channels" title="Reservations" detail="The canonical operational record raised by (or sent to) a channel. Provider status is always preserved alongside Mira's own state." />
      <ChannelTabs base={base} active="/channels/reservations" />
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="px-4 py-3">External id</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Guest</th>
              <th className="px-4 py-3">Stay</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Gross</th>
            </tr>
          </thead>
          <tbody>
            {reservations.length === 0 ? (
              <tr><td className="px-4 py-6 text-muted" colSpan={7}>No reservations yet. Pull reservations from a mapped listing on the mapping tab.</td></tr>
            ) : null}
            {reservations.map((reservation) => (
              <tr key={reservation.id} className="border-t border-line" data-testid={`reservation-${reservation.id}`}>
                <td className="px-4 py-3">
                  <Link className="text-blue-500" href={`${base}/channels/reservations/${reservation.id}`}>{reservation.externalReservationId}</Link>
                </td>
                <td className="px-4 py-3">{reservation.provider}<span className="block text-xs text-muted">{reservation.channel}</span></td>
                <td className="px-4 py-3">{reservation.property}</td>
                <td className="px-4 py-3">{reservation.guestName}</td>
                <td className="px-4 py-3">{reservation.checkIn} → {reservation.checkOut} · {reservation.nights}n</td>
                <td className="px-4 py-3">{reservation.status}</td>
                <td className="px-4 py-3 text-right">£{(reservation.grossPence / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
