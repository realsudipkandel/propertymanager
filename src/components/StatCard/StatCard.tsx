import { Money } from "@/components/Money";

export function StatCard({
  label,
  pence,
  hint,
  testId,
}: {
  label: string;
  pence?: number;
  hint?: string;
  testId: string;
}) {
  return (
    <article className="glass-card p-5" data-testid={testId}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-3 text-2xl font-semibold">
        {typeof pence === "number" ? <Money pence={pence} /> : hint}
      </p>
    </article>
  );
}
