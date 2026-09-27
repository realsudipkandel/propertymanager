import { PageHeader } from "@/components/PageHeader";
import { PartyForm } from "@/features/forms/LedgerForms";
import { listParties } from "@/server/queries";
import { requireSession } from "@/server/session";

export default async function CustomersPage() {
  const session = await requireSession();
  const rows = await listParties(session, "customers");
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
      <div>
        <PageHeader eyebrow="Customers" title="Guests and corporate clients" />
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="glass-card px-4 py-3">
              <p className="font-medium">{row.name}</p>
              <p className="text-sm text-muted">{row.detail} {row.extra}</p>
            </li>
          ))}
        </ul>
      </div>
      <PartyForm kind="customer" />
    </div>
  );
}
