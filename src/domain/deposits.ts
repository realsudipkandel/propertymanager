import { DEPOSIT_STATUS, type DepositStatus } from "@/domain/constants";
import { DomainError } from "@/domain/money";

export function revenueFromDeposit(
  status: DepositStatus,
  amountPence: number,
  retainedPence: number,
): number {
  if (amountPence < 0 || retainedPence < 0) {
    throw new DomainError("Deposit amounts cannot be negative.");
  }
  if (retainedPence > amountPence) {
    throw new DomainError("Retained deposit cannot exceed the amount held.");
  }
  if (status === DEPOSIT_STATUS.RETAINED) {
    return amountPence;
  }
  if (status === DEPOSIT_STATUS.PARTIALLY_RETAINED) {
    return retainedPence;
  }
  return 0;
}
