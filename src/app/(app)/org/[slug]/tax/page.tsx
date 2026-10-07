import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { formatMargin } from "@/domain/money";
import { VAT_LABEL } from "@/domain/labels";
import type { VatTreatment } from "@/domain/constants";
import { organizationPath } from "@/domain/organization";
import { canViewTax } from "@/domain/permissions";
import { getTax } from "@/server/queries";
import { requireSession } from "@/server/session";
import { redirect } from "next/navigation";

export default async function TaxPage() {
  const session = await requireSession();
  if (!canViewTax(session.role)) {
    redirect(organizationPath(session.organizationSlug));
  }
  const tax = await getTax(session);
  return (
    <div>
      <PageHeader eyebrow="Tax and VAT" title={tax.vatRegistered ? "VAT registered" : "Not VAT registered"} detail="The registration threshold lives in tax settings with an effective date, so a future change does not rewrite history." />
      <section className="grid gap-4 md:grid-cols-3">
        <article className="glass-card p-5" data-testid="vat-turnover">
          <p className="text-xs text-muted">Rolling 12-month net income</p>
          <p className="mt-2 text-2xl"><Money pence={tax.assessment?.rollingTurnoverPence ?? 0} /></p>
        </article>
        <article className="glass-card p-5">
          <p className="text-xs text-muted">Configured threshold</p>
          <p className="mt-2 text-2xl"><Money pence={tax.assessment?.thresholdPence ?? 0} /></p>
        </article>
        <article className="glass-card p-5">
          <p className="text-xs text-muted">Threshold use</p>
          <p className="mt-2 text-2xl">{formatMargin(tax.assessment?.utilisationBps ?? null)}</p>
          <p className="text-sm text-orange-400">{tax.assessment?.warning === "NONE" ? "Below the warning level" : tax.assessment?.warning}</p>
        </article>
      </section>
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="glass-card p-6 text-sm">
          <p>VAT number: {tax.vatNumber ?? "Not issued"}</p>
          <p className="mt-2">Document retention: {tax.retentionYears} years</p>
          <p className="mt-2">Company year: {tax.financialYearLabel}</p>
          <p className="mt-2">UK tax year: {tax.taxYearLabel}</p>
          <p className="mt-4 text-muted">
            Deductible costs in the rolling window <Money pence={tax.deductiblePence} />. Disallowable{" "}
            <Money pence={tax.disallowablePence} />. Pending review <Money pence={tax.pendingPence} />. Capital{" "}
            <Money pence={tax.capitalPence} />. Finance costs <Money pence={tax.financePence} />. This is a classification
            view, not a corporation tax return.
          </p>
        </div>
        <div className="glass-card p-6">
          <h2 className="font-semibold">VAT rates on file</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {tax.rates.map((rate) => (
              <li key={rate.name}>{VAT_LABEL[rate.treatment as VatTreatment]} · {(rate.rateBps / 100).toFixed(0)}%</li>
            ))}
          </ul>
          <h2 className="mt-6 font-semibold">Threshold history</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {tax.configs.map((config) => (
              <li key={config.id}>{config.effectiveFrom} · <Money pence={config.thresholdPence} /></li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
