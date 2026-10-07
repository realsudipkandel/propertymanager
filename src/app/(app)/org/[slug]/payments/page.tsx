import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { PAYMENT_METHOD_LABEL } from "@/domain/labels";
import type { PaymentMethod } from "@/domain/constants";
import { listPayments } from "@/server/queries";
import { requireSession } from "@/server/session";

export default async function PaymentsPage() {
  const session = await requireSession();
  const payments = await listPayments(session);
  return (
    <div>
      <PageHeader eyebrow="Payments" title="Cash movements against documents" detail="Payments are separate from invoices and bills. One document can collect several payments." />
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Direction</th>
              <th className="px-4 py-3">Against</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-t border-line">
                <td className="px-4 py-3">{payment.date}</td>
                <td className="px-4 py-3">{payment.reference}</td>
                <td className="px-4 py-3">{payment.direction}<span className="block text-xs text-muted">{PAYMENT_METHOD_LABEL[payment.method as PaymentMethod] ?? payment.method}</span></td>
                <td className="px-4 py-3">{payment.against}</td>
                <td className="px-4 py-3 text-right"><Money pence={payment.amountPence} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
