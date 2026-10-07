import Link from "next/link";
import type { ReactNode } from "react";

import { WATERFALL_KIND, type ShareBar, type WaterfallStep } from "@/domain/dashboard";
import { formatGbp, formatMargin } from "@/domain/money";
import { toneClass } from "@/features/dashboard/presentation";

function joined(base: string, hint: string | null): string | null {
  if (!hint) {
    return null;
  }
  return `${base}${hint}`;
}

export function ShareMeters({
  rows,
  base,
  formatAmount,
}: {
  rows: ShareBar[];
  base: string;
  formatAmount?: (row: ShareBar) => string;
}) {
  const peak = rows.reduce((highest, row) => Math.max(highest, Math.abs(row.amountPence)), 0);
  if (rows.length === 0) {
    return <p className="text-sm text-muted">Nothing to show in this range.</p>;
  }

  function renderRow(row: ShareBar): ReactNode {
    const width = peak === 0 ? 0 : Math.round((Math.abs(row.amountPence) / peak) * 100);
    const href = joined(base, row.hrefHint);
    const amount = formatAmount ? formatAmount(row) : formatGbp(row.amountPence);
    const label = href ? (
      <Link href={href} className="text-blue-400">
        {row.label}
      </Link>
    ) : (
      <span>{row.label}</span>
    );
    return (
      <li key={row.key}>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          {label}
          <span className={`tabular-nums ${toneClass(row.tone)}`}>
            {amount}
            {row.shareBps === null ? "" : ` · ${formatMargin(row.shareBps)}`}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
          <div className={row.tone === "warning" ? "h-full rounded-full bg-orange-400" : "h-full rounded-full bg-blue-500"} style={{ width: `${width}%` }} />
        </div>
      </li>
    );
  }

  return <ul className="space-y-3">{rows.map(renderRow)}</ul>;
}

export function WaterfallList({ steps, base }: { steps: WaterfallStep[]; base: string }) {
  const bounds = steps.flatMap((step) => [step.barStartPence, step.barEndPence]);
  const lowest = Math.min(0, ...bounds);
  const highest = Math.max(1, ...bounds);
  const span = highest - lowest || 1;

  function renderStep(step: WaterfallStep): ReactNode {
    const left = ((step.barStartPence - lowest) / span) * 100;
    const width = (Math.abs(step.barEndPence - step.barStartPence) / span) * 100;
    const href = step.categoryCode ? `${base}/expenses?category=${encodeURIComponent(step.categoryCode)}` : null;
    const colour =
      step.kind === WATERFALL_KIND.DECREASE ? "bg-pink-500" : step.kind === WATERFALL_KIND.INCREASE ? "bg-teal-400" : "bg-blue-500";
    const label = href ? (
      <Link href={href} className="text-blue-400">
        {step.label}
      </Link>
    ) : (
      <span className={step.kind === WATERFALL_KIND.RESULT ? "font-medium" : ""}>{step.label}</span>
    );
    return (
      <li key={step.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
        {label}
        <div className="relative h-3 rounded-full bg-white/5">
          <div className={`absolute top-0 h-3 rounded-full ${colour}`} style={{ left: `${left}%`, width: `${Math.max(width, 1.5)}%` }} />
        </div>
        <span className="tabular-nums">{formatGbp(step.amountPence)}</span>
      </li>
    );
  }

  return (
    <ul className="space-y-3" data-testid="profit-waterfall">
      {steps.map(renderStep)}
    </ul>
  );
}

export function DualMeter({
  leftLabel,
  leftBps,
  rightLabel,
  rightBps,
}: {
  leftLabel: string;
  leftBps: number | null;
  rightLabel: string;
  rightBps: number | null;
}) {
  return (
    <div className="space-y-3" data-testid="ota-dependency">
      <Meter label={leftLabel} shareBps={leftBps} colour="bg-orange-400" />
      <Meter label={rightLabel} shareBps={rightBps} colour="bg-emerald-400" />
    </div>
  );
}

function Meter({ label, shareBps, colour }: { label: string; shareBps: number | null; colour: string }) {
  const width = shareBps === null ? 0 : Math.min(100, Math.round(shareBps / 100));
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums">{formatMargin(shareBps)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
        <div className={`h-full rounded-full ${colour}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
