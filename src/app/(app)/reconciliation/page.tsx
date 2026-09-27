import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { MatchForm } from "@/features/forms/LedgerForms";
import { getReconciliation } from "@/server/queries";
import { requireSession } from "@/server/session";

export default async function ReconciliationPage() {
  const session = await requireSession();
  const data = await getReconciliation(session);
  return (
    <div>
      <PageHeader eyebrow="Reconciliation" title="Match payouts to the bank" detail="A single Airbnb payout can contain several bookings. Match is offered only when the amount is unique and the booking allocations add up." />
      <div className="space-y-4">
        {data.rows.length === 0 ? <p className="text-sm text-muted">No unmatched credits.</p> : null}
        {data.rows.map((row) => (
          <article key={row.transactionId} className="glass-card p-6" data-testid="reconcile-row">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-medium">{row.description}</p>
                <p className="text-sm text-muted">{row.date}</p>
              </div>
              <Money pence={row.amountPence} />
            </div>
            {row.payoutId ? (
              <div className="mt-4">
                <p className="text-sm">Suggested {row.payoutReference}</p>
                <ul className="mt-2 text-sm text-muted">
                  {row.allocations.map((allocation) => (
                    <li key={allocation.booking}>{allocation.booking} · <Money pence={allocation.amountPence} /></li>
                  ))}
                </ul>
                <div className="mt-4">
                  <MatchForm bankTransactionId={row.transactionId} payoutId={row.payoutId} />
                </div>
              </div>
            ) : <p className="mt-3 text-sm text-muted">No unique payout matches this amount.</p>}
          </article>
        ))}
      </div>
    </div>
  );
}
