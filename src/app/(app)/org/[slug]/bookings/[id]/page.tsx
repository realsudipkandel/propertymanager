import { notFound } from "next/navigation";

import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { DEPOSIT_LABEL } from "@/domain/labels";
import type { DepositStatus } from "@/domain/constants";
import { getBooking } from "@/server/queries";
import { requireSession } from "@/server/session";

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const booking = await getBooking(session, id);
  if (!booking) {
    notFound();
  }
  const lines = [
    ["Accommodation", booking.accommodationPence],
    ["Cleaning fee", booking.cleaningPence],
    ["Extra guest", booking.extraPence],
    ["Parking", booking.parkingPence],
    ["Other", booking.otherPence],
    ["Gross revenue", booking.grossPence],
    ["Platform commission", -booking.commissionPence],
    ["Processing fee", -booking.processingPence],
    ["Refunds", -booking.refundPence],
    ["Adjustments", -booking.adjustmentPence],
    ["Expected payout", booking.payoutPence],
  ] as const;
  return (
    <div>
      <PageHeader
        eyebrow={booking.platform}
        title={booking.reference}
        detail={`${booking.guest} · ${booking.property} · ${booking.checkIn} to ${booking.checkOut} · ${booking.nights} nights · ${booking.externalBookingId}`}
      />
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card p-6" data-testid="booking-breakdown">
          <h2 className="text-lg font-semibold">Gross, fees, cash</h2>
          <dl className="mt-4 divide-y divide-line">
            {lines.map((line) => (
              <div key={line[0]} className="flex justify-between py-2 text-sm">
                <dt className="text-muted">{line[0]}</dt>
                <dd><Money pence={line[1]} /></dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm">
            Contribution after linked cleaning, laundry, and consumables: <Money pence={booking.contributionPence} testId="booking-contribution" />
          </p>
          <p className="mt-2 text-xs text-muted">Bank status: {booking.reconciliation}</p>
        </div>
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="font-semibold">Linked costs</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {booking.expenses.map((expense) => (
                <li key={`${expense.label}-${expense.amountPence}`} className="flex justify-between">
                  <span>{expense.label}</span>
                  <Money pence={expense.amountPence} />
                </li>
              ))}
            </ul>
          </div>
          <div className="glass-card p-6">
            <h2 className="font-semibold">Deposits</h2>
            {booking.deposits.length === 0 ? <p className="mt-2 text-sm text-muted">No deposit on this stay.</p> : null}
            {booking.deposits.map((deposit) => (
              <p key={deposit.status} className="mt-2 text-sm">
                {DEPOSIT_LABEL[deposit.status as DepositStatus]} <Money pence={deposit.amountPence} />
                {deposit.retainedPence > 0 ? <span> · retained <Money pence={deposit.retainedPence} /></span> : null}
              </p>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
