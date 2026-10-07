import Link from "next/link";
import type { ReactNode } from "react";

import { DASHBOARD_RANGE_OPTIONS, LEDGER_BASIS_OPTIONS, type DashboardRange, type LedgerBasis } from "@/domain/dashboard";

function rangeHref(base: string, range: DashboardRange, basis: LedgerBasis): string {
  const params = new URLSearchParams({ range, basis });
  return `${base}?${params.toString()}`;
}

export function PeriodToolbar({
  base,
  range,
  basis,
  customStart,
  customEnd,
}: {
  base: string;
  range: DashboardRange;
  basis: LedgerBasis;
  customStart: string;
  customEnd: string;
}) {
  function renderRange(option: (typeof DASHBOARD_RANGE_OPTIONS)[number]): ReactNode {
    const active = option.id === range;
    return (
      <Link
        key={option.id}
        href={rangeHref(base, option.id, basis)}
        data-testid={`range-${option.id}`}
        className={active ? "rounded-full bg-blue-500/15 px-3 py-1 text-blue-400" : "rounded-full px-3 py-1 text-muted"}
      >
        {option.label}
      </Link>
    );
  }

  function renderBasis(option: (typeof LEDGER_BASIS_OPTIONS)[number]): ReactNode {
    const active = option.id === basis;
    return (
      <Link
        key={option.id}
        href={rangeHref(base, range, option.id)}
        data-testid={`basis-${option.id}`}
        className={active ? "rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-400" : "rounded-full px-3 py-1 text-muted"}
      >
        {option.label} basis
      </Link>
    );
  }

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">{DASHBOARD_RANGE_OPTIONS.map(renderRange)}</div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-2 text-sm">{LEDGER_BASIS_OPTIONS.map(renderBasis)}</div>
        <form method="get" className="flex flex-wrap items-end gap-2" data-testid="custom-range">
          <input type="hidden" name="range" value="custom" />
          <input type="hidden" name="basis" value={basis} />
          <label className="text-xs text-muted">
            From
            <input className="glass-input mt-1" type="date" name="from" defaultValue={customStart} required />
          </label>
          <label className="text-xs text-muted">
            To
            <input className="glass-input mt-1" type="date" name="to" defaultValue={customEnd} required />
          </label>
          <button className="primary-button" type="submit">
            Apply
          </button>
        </form>
      </div>
    </div>
  );
}
