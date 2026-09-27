import { MESSAGE } from "@/domain/constants";
import { DomainError } from "@/domain/money";

export function allocationDifference(payoutPence: number, partsPence: number[]): number {
  if (payoutPence < 0 || partsPence.some((part) => part < 0)) {
    throw new DomainError(MESSAGE.NEGATIVE_MONEY);
  }
  const allocated = partsPence.reduce((total, part) => total + part, 0);
  return payoutPence - allocated;
}

export function isExactAllocation(payoutPence: number, partsPence: number[]): boolean {
  return allocationDifference(payoutPence, partsPence) === 0 && partsPence.length > 0;
}

export function suggestUniqueAmountMatch<T extends { id: string; amountPence: number }>(
  amountPence: number,
  candidates: T[],
): T | null {
  const matches = candidates.filter((candidate) => candidate.amountPence === amountPence);
  if (matches.length !== 1) {
    return null;
  }
  return matches[0] ?? null;
}
