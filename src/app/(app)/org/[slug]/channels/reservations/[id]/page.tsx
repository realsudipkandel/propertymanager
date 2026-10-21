import { notFound } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { CancelReservationForm } from "@/features/channels/ChannelForms";
import { canMutateFinance } from "@/domain/permissions";
import { getReservation } from "@/server/channels";
import { requireSession } from "@/server/session";

export default async function ReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const reservation = await getReservation(session, id);
  if (!reservation) {
    notFound();
  }
  const canManage = canMutateFinance(session.role);
  return (
    <div>
      <PageHeader
        eyebrow={`${reservation.provider} · ${reservation.status}`}
        title={reservation.guestName}
        detail={`${reservation.property} · ${reservation.checkIn} → ${reservation.checkOut} · ${reservation.nights} night(s) · ${reservation.guests} guest(s)`}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Financials</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <Row label="Accommodation" pence={reservation.accommodationPence} />
            <Row label="Cleaning" pence={reservation.cleaningPence} />
            <Row label="Other" pence={reservation.otherPence} />
            <Row label="Gross revenue" pence={reservation.grossPence} />
            <Row label="Channel commission" pence={reservation.commissionPence} />
            <Row label="Net" pence={reservation.netPence} />
          </dl>
        </div>
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Channel data</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <Row label="Channel account" value={reservation.channel} />
            <Row label="External reservation id" value={reservation.externalReservationId} />
            <Row label="Guest email" value={reservation.guestEmail ?? "—"} />
          </dl>
          {canManage && reservation.canCancel ? (
            <div className="mt-5">
              <CancelReservationForm reservationId={reservation.id} />
              <p className="mt-2 text-xs text-muted">Cancelling releases its night locks immediately so other channels can sell those dates.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ label, pence, value }: { label: string; pence?: number; value?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd>{typeof pence === "number" ? `£${(pence / 100).toFixed(2)}` : value}</dd>
    </div>
  );
}
