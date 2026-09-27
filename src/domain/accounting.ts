import { MESSAGE } from "@/domain/constants";
import { nightsBetween, type IsoDate } from "@/domain/dates";
import { assertNonNegativePence, DomainError } from "@/domain/money";

export type BookingMoneyInput = {
  accommodationPence: number;
  cleaningFeePence: number;
  extraGuestPence: number;
  parkingPence: number;
  otherRevenuePence: number;
  platformCommissionPence: number;
  paymentProcessingFeePence: number;
  refundsPence: number;
  adjustmentsPence: number;
};

export type BookingFinancials = {
  grossRevenuePence: number;
  platformCostsPence: number;
  deductionsPence: number;
  netPayoutPence: number;
  negativePayout: boolean;
};

export function calculateBookingFinancials(input: BookingMoneyInput): BookingFinancials {
  const revenueParts = [
    input.accommodationPence,
    input.cleaningFeePence,
    input.extraGuestPence,
    input.parkingPence,
    input.otherRevenuePence,
  ];
  const costParts = [
    input.platformCommissionPence,
    input.paymentProcessingFeePence,
    input.refundsPence,
    input.adjustmentsPence,
  ];
  for (const amount of [...revenueParts, ...costParts]) {
    assertNonNegativePence(amount, "Booking amount");
  }
  const grossRevenuePence = revenueParts.reduce((total, amount) => total + amount, 0);
  const platformCostsPence =
    input.platformCommissionPence + input.paymentProcessingFeePence;
  const deductionsPence = input.refundsPence + input.adjustmentsPence;
  const netPayoutPence = grossRevenuePence - platformCostsPence - deductionsPence;
  return {
    grossRevenuePence,
    platformCostsPence,
    deductionsPence,
    netPayoutPence,
    negativePayout: netPayoutPence < 0,
  };
}

export function assertStay(checkIn: IsoDate, checkOut: IsoDate, guests: number): number {
  if (!Number.isInteger(guests) || guests < 1) {
    throw new DomainError("A booking needs at least one guest.");
  }
  return nightsBetween(checkIn, checkOut);
}

export function assertExternalBookingReference(reference: string): string {
  const trimmed = reference.trim();
  if (trimmed.length < 3 || trimmed.length > 64) {
    throw new DomainError("Enter the platform booking reference.");
  }
  return trimmed;
}

export type BookingContributionInput = {
  grossRevenuePence: number;
  platformCostsPence: number;
  refundsPence: number;
  directCostsPence: number;
};

export function bookingContributionPence(input: BookingContributionInput): number {
  assertNonNegativePence(input.grossRevenuePence, "Gross revenue");
  assertNonNegativePence(input.platformCostsPence, "Platform costs");
  assertNonNegativePence(input.refundsPence, "Refunds");
  assertNonNegativePence(input.directCostsPence, "Direct costs");
  return (
    input.grossRevenuePence -
    input.platformCostsPence -
    input.refundsPence -
    input.directCostsPence
  );
}

export function rejectEmptyPaymentTarget(links: {
  invoiceId?: string;
  supplierBillId?: string;
  expenseId?: string;
}): void {
  if (!links.invoiceId && !links.supplierBillId && !links.expenseId) {
    throw new DomainError(MESSAGE.VALIDATION);
  }
}
