import { VAT_WARNING_UTILISATION_BPS } from "@/domain/constants";
import { DomainError } from "@/domain/money";

export const VAT_WARNING = {
  NONE: "NONE",
  APPROACHING: "APPROACHING",
  EXCEEDED: "EXCEEDED",
} as const;

export type VatWarning = (typeof VAT_WARNING)[keyof typeof VAT_WARNING];

export type VatAssessment = {
  rollingTurnoverPence: number;
  thresholdPence: number;
  utilisationBps: number;
  warning: VatWarning;
};

export function assessVatThreshold(
  rollingTurnoverPence: number,
  thresholdPence: number,
): VatAssessment {
  if (!Number.isInteger(rollingTurnoverPence) || rollingTurnoverPence < 0) {
    throw new DomainError("Taxable turnover cannot be negative.");
  }
  if (!Number.isInteger(thresholdPence) || thresholdPence <= 0) {
    throw new DomainError("VAT threshold must be configured as a positive amount.");
  }
  const utilisationBps = Math.round((rollingTurnoverPence * 10_000) / thresholdPence);
  let warning: VatWarning = VAT_WARNING.NONE;
  if (rollingTurnoverPence >= thresholdPence) {
    warning = VAT_WARNING.EXCEEDED;
  } else if (rollingTurnoverPence * 10_000 >= thresholdPence * VAT_WARNING_UTILISATION_BPS) {
    warning = VAT_WARNING.APPROACHING;
  }
  return {
    rollingTurnoverPence,
    thresholdPence,
    utilisationBps,
    warning,
  };
}

export function activeTaxConfig<T extends { effectiveFrom: string; effectiveTo: string | null }>(
  configs: T[],
  onDate: string,
): T | null {
  const active = configs
    .filter((config) => config.effectiveFrom <= onDate)
    .filter((config) => config.effectiveTo === null || config.effectiveTo >= onDate)
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom));
  return active[0] ?? null;
}
