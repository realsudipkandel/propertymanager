import { formatGbp } from "@/domain/money";

export function Money({ pence, testId }: { pence: number; testId?: string }) {
  const tone = pence < 0 ? "text-pink-500" : "text-ink";
  return (
    <span className={`tabular-nums ${tone}`} data-testid={testId}>
      {formatGbp(pence)}
    </span>
  );
}
