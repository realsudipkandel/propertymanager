import { DomainError, marginBasisPoints } from "@/domain/money";

export type PropertyKpis = {
  occupancyBps: number | null;
  occupancyExceedsAvailability: boolean;
  adrPence: number | null;
  revparPence: number | null;
  averageStayNights: number | null;
  averageBookingValuePence: number | null;
  cleaningCostPerBookingPence: number | null;
  otaFeeBps: number | null;
  operatingMarginBps: number | null;
};

export type KpiInput = {
  availableNights: number;
  occupiedNights: number;
  accommodationRevenuePence: number;
  grossRevenuePence: number;
  bookingCount: number;
  cleaningCostPence: number;
  otaFeesPence: number;
  operatingProfitPence: number;
};

function assertCount(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new DomainError(`${label} cannot be negative.`);
  }
}

export function calculatePropertyKpis(input: KpiInput): PropertyKpis {
  assertCount(input.availableNights, "Available nights");
  assertCount(input.occupiedNights, "Occupied nights");
  assertCount(input.bookingCount, "Booking count");
  assertCount(input.accommodationRevenuePence, "Accommodation revenue");
  assertCount(input.grossRevenuePence, "Gross revenue");
  assertCount(input.cleaningCostPence, "Cleaning cost");
  assertCount(input.otaFeesPence, "OTA fees");

  const occupancyExceedsAvailability = input.occupiedNights > input.availableNights;
  return {
    occupancyBps:
      input.availableNights === 0
        ? null
        : Math.round((input.occupiedNights * 10_000) / input.availableNights),
    occupancyExceedsAvailability,
    adrPence:
      input.occupiedNights === 0
        ? null
        : Math.round(input.accommodationRevenuePence / input.occupiedNights),
    revparPence:
      input.availableNights === 0
        ? null
        : Math.round(input.accommodationRevenuePence / input.availableNights),
    averageStayNights:
      input.bookingCount === 0 ? null : input.occupiedNights / input.bookingCount,
    averageBookingValuePence:
      input.bookingCount === 0 ? null : Math.round(input.grossRevenuePence / input.bookingCount),
    cleaningCostPerBookingPence:
      input.bookingCount === 0 ? null : Math.round(input.cleaningCostPence / input.bookingCount),
    otaFeeBps: marginBasisPoints(input.otaFeesPence, input.grossRevenuePence),
    operatingMarginBps: marginBasisPoints(input.operatingProfitPence, input.grossRevenuePence),
  };
}
