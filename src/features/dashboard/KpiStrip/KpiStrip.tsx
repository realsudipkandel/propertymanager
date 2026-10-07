import type { KpiCard } from "@/domain/dashboard";
import { toneClass } from "@/features/dashboard/presentation";

function Sparkline({ values, className }: { values: number[]; className: string }) {
  if (values.length < 2) {
    return null;
  }
  const lowest = Math.min(...values);
  const highest = Math.max(...values);
  const span = highest - lowest || 1;
  const step = 100 / (values.length - 1);
  const points = values
    .map((value, index) => {
      const x = index * step;
      const y = 24 - ((value - lowest) / span) * 20;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 28" className={`mt-3 h-7 w-full ${className}`} aria-hidden="true">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
    </svg>
  );
}

function KpiTile({ card }: { card: KpiCard }) {
  return (
    <article className="glass-card p-5" data-testid={card.testId}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{card.label}</p>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{card.value}</p>
      <p className={`mt-2 text-sm ${toneClass(card.tone)}`}>{card.secondary}</p>
      <Sparkline values={card.sparkline} className={toneClass(card.tone)} />
    </article>
  );
}

export function KpiStrip({ cards }: { cards: KpiCard[] }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" data-testid="kpi-strip">
      {cards.map(renderCard)}
    </section>
  );
}

function renderCard(card: KpiCard) {
  return <KpiTile key={card.id} card={card} />;
}
