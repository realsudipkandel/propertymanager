export function logServerError(scope: string, error: unknown): void {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(JSON.stringify({ scope, message }));
}

export function nextReference(prefix: string, latest: string | null, width: number): string {
  const current = latest?.startsWith(prefix) ? Number(latest.slice(prefix.length)) : 0;
  const sequence = Number.isInteger(current) ? current + 1 : 1;
  return `${prefix}${String(sequence).padStart(width, "0")}`;
}
