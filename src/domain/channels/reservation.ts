import { DomainError } from "@/domain/money";
import { addDays, nightsBetween, type IsoDate } from "@/domain/dates";

// Canonical reservation state machine (PRD §21). Provider-reported status is
// always kept alongside this — never discarded — but every transition in
// Mira itself must go through here so an invalid jump (e.g. CANCELLED ->
// CONFIRMED) is rejected rather than silently applied.
export const RESERVATION_STATUS = {
  INQUIRY: "INQUIRY",
  CONFIRMED: "CONFIRMED",
  MODIFIED: "MODIFIED",
  CANCELLED: "CANCELLED",
  CHECKED_IN: "CHECKED_IN",
  CHECKED_OUT: "CHECKED_OUT",
} as const;

export type ReservationStatus = (typeof RESERVATION_STATUS)[keyof typeof RESERVATION_STATUS];

const ALLOWED_TRANSITIONS: Record<ReservationStatus, readonly ReservationStatus[]> = {
  INQUIRY: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["MODIFIED", "CANCELLED", "CHECKED_IN"],
  MODIFIED: ["CONFIRMED", "CANCELLED", "CHECKED_IN"],
  CHECKED_IN: ["CHECKED_OUT"],
  CHECKED_OUT: [],
  CANCELLED: [],
};

export function canTransitionReservation(from: ReservationStatus, to: ReservationStatus): boolean {
  if (from === to) {
    return false;
  }
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertReservationTransition(from: ReservationStatus, to: ReservationStatus): void {
  if (!canTransitionReservation(from, to)) {
    throw new DomainError(`Cannot move a reservation from ${from} to ${to}.`);
  }
}

export function reservationHoldsInventory(status: ReservationStatus): boolean {
  return status === "CONFIRMED" || status === "MODIFIED" || status === "CHECKED_IN";
}

/** Every night of the stay, as ISO dates, check-in inclusive and checkout exclusive — the set of nights that must hold an inventory lock. */
export function nightsOccupied(checkIn: IsoDate, checkOut: IsoDate): IsoDate[] {
  const nights = nightsBetween(checkIn, checkOut);
  const dates: IsoDate[] = [];
  let cursor = checkIn;
  for (let i = 0; i < nights; i += 1) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

// --- Idempotency (PRD §36) ---
// A provider may resend the same reservation-created webhook any number of
// times. The dedupe key is provider + externalReservationId, scoped to the
// organisation — identical to the unique index on the Reservation table, so
// the database itself is the second line of defence if application logic is
// ever bypassed.
export function reservationIdempotencyKey(organizationId: string, provider: string, externalReservationId: string): string {
  const trimmed = externalReservationId.trim();
  if (trimmed.length === 0) {
    throw new DomainError("A reservation needs an external reservation id.");
  }
  return `${organizationId}:${provider}:${trimmed}`;
}

// --- Pricing / ARI (PRD §14, §15) ---
// Mira holds one canonical base rate per property per night. Each channel's
// published price is a markup over that base rate — never an independently
// typed-in number — so the base rate always stays the single source of
// truth and channel prices move together when it changes.
export function channelPricePence(basePricePence: number, markupBps: number): number {
  if (!Number.isInteger(basePricePence) || basePricePence < 0) {
    throw new DomainError("Base price must be a non-negative whole number of pence.");
  }
  if (!Number.isInteger(markupBps) || markupBps < -10_000 || markupBps > 20_000) {
    throw new DomainError("Channel markup must be between -100% and 200%.");
  }
  return Math.round((basePricePence * (10_000 + markupBps)) / 10_000);
}

export type ReservationFinancials = {
  grossPence: number;
  netOfCommissionPence: number;
};

export function reservationFinancials(input: {
  accommodationPence: number;
  cleaningPence: number;
  otherPence: number;
  commissionPence: number;
}): ReservationFinancials {
  for (const [label, value] of Object.entries(input)) {
    if (!Number.isInteger(value) || value < 0) {
      throw new DomainError(`${label} must be a non-negative whole number of pence.`);
    }
  }
  const grossPence = input.accommodationPence + input.cleaningPence + input.otherPence;
  return { grossPence, netOfCommissionPence: grossPence - input.commissionPence };
}
