import Link from "next/link";

import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { organizationPath } from "@/domain/organization";
import { listBookings } from "@/server/queries";
import { requireSession } from "@/server/session";

export default async function BookingsPage() {
  const session = await requireSession();
  const base = organizationPath(session.organizationSlug);
  const bookings = await listBookings(session);
  return (
    <div>
      <PageHeader
        eyebrow="Bookings"
        title="Booking financial records"
        detail="Each stay stores gross revenue, platform costs, and the expected payout as three different numbers."
        action={<Link className="primary-button" href={`${base}/bookings/new`}>Add booking</Link>}
      />
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Guest</th>
              <th className="px-4 py-3 text-right">Gross</th>
              <th className="px-4 py-3 text-right">Fees</th>
              <th className="px-4 py-3 text-right">Payout</th>
              <th className="px-4 py-3">Bank</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking.id} className="border-t border-line" data-testid={`booking-${booking.reference}`}>
                <td className="px-4 py-3"><Link className="text-blue-500" href={`${base}/bookings/${booking.id}`}>{booking.reference}</Link></td>
                <td className="px-4 py-3">{booking.platform}<span className="block text-xs text-muted">{booking.externalBookingId}</span></td>
                <td className="px-4 py-3">{booking.property}</td>
                <td className="px-4 py-3">{booking.guest}</td>
                <td className="px-4 py-3 text-right"><Money pence={booking.grossPence} /></td>
                <td className="px-4 py-3 text-right"><Money pence={booking.feePence} /></td>
                <td className="px-4 py-3 text-right"><Money pence={booking.payoutPence} /></td>
                <td className="px-4 py-3">{booking.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
