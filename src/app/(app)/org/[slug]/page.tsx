import { PageHeader } from "@/components/PageHeader";
import { BusinessOverview } from "@/features/dashboard/BusinessOverview";
import { PeriodToolbar } from "@/features/dashboard/PeriodToolbar";
import { organizationPath } from "@/domain/organization";
import { getDashboard } from "@/server/dashboard";
import { requireSession } from "@/server/session";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; basis?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const session = await requireSession();
  const base = organizationPath(session.organizationSlug);
  const dashboard = await getDashboard(session, {
    range: params.range,
    basis: params.basis,
    from: params.from,
    to: params.to,
  });
  return (
    <div>
      <PageHeader
        eyebrow={dashboard.companyName}
        title="Business overview"
        detail={dashboard.periodLabel}
      />
      <PeriodToolbar
        base={base}
        range={dashboard.range}
        basis={dashboard.basis}
        customStart={dashboard.customStart}
        customEnd={dashboard.customEnd}
      />
      <BusinessOverview view={dashboard} base={base} />
    </div>
  );
}
