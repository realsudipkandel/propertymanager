import { describe, expect, it } from "vitest";

import { DomainError } from "@/domain/money";
import {
  assertReservationTransition,
  canTransitionReservation,
  channelPricePence,
  nightsOccupied,
  reservationFinancials,
  reservationHoldsInventory,
  reservationIdempotencyKey,
} from "@/domain/channels/reservation";

describe("reservation state machine", () => {
  it("allows the documented forward transitions", () => {
    expect(canTransitionReservation("INQUIRY", "CONFIRMED")).toBe(true);
    expect(canTransitionReservation("CONFIRMED", "CHECKED_IN")).toBe(true);
    expect(canTransitionReservation("CHECKED_IN", "CHECKED_OUT")).toBe(true);
    expect(canTransitionReservation("CONFIRMED", "CANCELLED")).toBe(true);
  });

  it("rejects transitions out of terminal states and no-ops", () => {
    expect(canTransitionReservation("CANCELLED", "CONFIRMED")).toBe(false);
    expect(canTransitionReservation("CHECKED_OUT", "CHECKED_IN")).toBe(false);
    expect(canTransitionReservation("CONFIRMED", "CONFIRMED")).toBe(false);
    expect(() => assertReservationTransition("CANCELLED", "CONFIRMED")).toThrow(DomainError);
  });

  it("only counts inventory as held for live states", () => {
    expect(reservationHoldsInventory("CONFIRMED")).toBe(true);
    expect(reservationHoldsInventory("CHECKED_IN")).toBe(true);
    expect(reservationHoldsInventory("CANCELLED")).toBe(false);
    expect(reservationHoldsInventory("CHECKED_OUT")).toBe(false);
  });
});

describe("nightsOccupied", () => {
  it("enumerates check-in inclusive, checkout exclusive nights", () => {
    expect(nightsOccupied("2026-11-12", "2026-11-15")).toEqual(["2026-11-12", "2026-11-13", "2026-11-14"]);
  });
});

describe("reservationIdempotencyKey", () => {
  it("is stable for the same provider event and rejects blank ids", () => {
    const key1 = reservationIdempotencyKey("org-1", "MOCK_AIRBNB", "HMABC123");
    const key2 = reservationIdempotencyKey("org-1", "MOCK_AIRBNB", "HMABC123");
    expect(key1).toBe(key2);
    expect(() => reservationIdempotencyKey("org-1", "MOCK_AIRBNB", "   ")).toThrow(DomainError);
  });
});

describe("channelPricePence", () => {
  it("applies a channel markup over the canonical base rate", () => {
    expect(channelPricePence(10_000, 1_500)).toBe(11_500);
    expect(channelPricePence(10_000, -500)).toBe(9_500);
    expect(channelPricePence(10_000, 0)).toBe(10_000);
  });

  it("rejects an out-of-range markup or a negative base rate", () => {
    expect(() => channelPricePence(10_000, 25_000)).toThrow(DomainError);
    expect(() => channelPricePence(-1, 0)).toThrow(DomainError);
  });
});

describe("reservationFinancials", () => {
  it("sums gross revenue and nets off commission", () => {
    const result = reservationFinancials({
      accommodationPence: 50_000,
      cleaningPence: 7_000,
      otherPence: 0,
      commissionPence: 8_550,
    });
    expect(result.grossPence).toBe(57_000);
    expect(result.netOfCommissionPence).toBe(48_450);
  });

  it("rejects negative components", () => {
    expect(() =>
      reservationFinancials({ accommodationPence: -1, cleaningPence: 0, otherPence: 0, commissionPence: 0 }),
    ).toThrow(DomainError);
  });
});
