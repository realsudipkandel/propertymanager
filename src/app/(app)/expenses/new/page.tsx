import { PageHeader } from "@/components/PageHeader";
import { ExpenseForm } from "@/features/forms/LedgerForms";
import { expenseFormOptions } from "@/server/queries";
import { requireSession } from "@/server/session";

export default async function NewExpensePage() {
  const session = await requireSession();
  const options = await expenseFormOptions(session);
  return (
    <div>
      <PageHeader eyebrow="Expenses" title="Add expense" detail="Net, VAT, and gross are stored separately. Leave property blank for a company cost. Receipts stay in file storage, not in the database." />
      <ExpenseForm properties={options.properties} suppliers={options.suppliers} categories={options.categories} bookings={options.bookings} />
    </div>
  );
}
