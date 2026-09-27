import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { BankImportForm } from "@/features/forms/LedgerForms";
import { getBanking } from "@/server/queries";
import { requireSession } from "@/server/session";

export default async function BankingPage() {
  const session = await requireSession();
  const accounts = await getBanking(session);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Banking" title="Accounts" detail="Account numbers and sort codes are encrypted. The screen shows only the last four digits." />
      {accounts.map((account) => (
        <section key={account.id} className="glass-card p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="text-lg font-semibold">{account.accountName}</h2>
              <p className="text-sm text-muted">{account.bankName} · {account.masked}</p>
            </div>
            <Money pence={account.balancePence} testId="bank-balance" />
          </div>
          <table className="mt-4 w-full text-sm">
            <tbody>
              {account.transactions.map((transaction) => (
                <tr key={transaction.id} className="border-t border-line">
                  <td className="py-2">{transaction.date}</td>
                  <td>{transaction.description}</td>
                  <td>{transaction.status}</td>
                  <td className="text-right"><Money pence={transaction.direction === "DEBIT" ? -transaction.amountPence : transaction.amountPence} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <BankImportForm />
    </div>
  );
}
