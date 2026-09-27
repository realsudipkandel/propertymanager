import { MESSAGE } from "@/domain/constants";

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export function assertNonNegativePence(amountPence: number, label: string): void {
  if (!Number.isInteger(amountPence) || amountPence < 0) {
    throw new DomainError(`${label}: ${MESSAGE.NEGATIVE_MONEY}`);
  }
}

export function parsePoundsToPence(value: string): number | null {
  const trimmed = value.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  const [whole = "0", fraction = ""] = trimmed.split(".");
  const pence = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(pence)) {
    return null;
  }
  return pence;
}

export function formatGbp(pence: number): string {
  if (!Number.isInteger(pence)) {
    throw new DomainError("Money must be whole pence.");
  }
  const negative = pence < 0;
  const absolute = Math.abs(pence);
  const pounds = Math.trunc(absolute / 100);
  const remainder = absolute % 100;
  const grouped = new Intl.NumberFormat("en-GB").format(pounds);
  const body =
    remainder === 0
      ? grouped
      : `${grouped}.${String(remainder).padStart(2, "0")}`;
  return negative ? `-£${body}` : `£${body}`;
}

export function applyBasisPoints(amountPence: number, basisPoints: number): number {
  if (!Number.isInteger(amountPence) || !Number.isInteger(basisPoints)) {
    throw new DomainError("Basis points must be integers.");
  }
  if (basisPoints < 0 || basisPoints > 10_000) {
    throw new DomainError("Business use must be between 0% and 100%.");
  }
  return Math.round((amountPence * basisPoints) / 10_000);
}

export function marginBasisPoints(profitPence: number, revenuePence: number): number | null {
  if (revenuePence === 0) {
    return null;
  }
  if (revenuePence < 0) {
    throw new DomainError("Revenue denominator cannot be negative.");
  }
  return Math.round((profitPence * 10_000) / revenuePence);
}

export function formatMargin(marginBps: number | null): string {
  if (marginBps === null) {
    return "—";
  }
  const tenths = Math.round(marginBps / 10);
  const sign = tenths < 0 ? "-" : "";
  const absolute = Math.abs(tenths);
  return `${sign}${Math.trunc(absolute / 10)}.${absolute % 10}%`;
}

export function formatRatio(numerator: number, denominator: number): string {
  return formatMargin(marginBasisPoints(numerator, denominator));
}
