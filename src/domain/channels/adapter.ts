import type { ChannelCapabilities } from "@/domain/channels/capabilities";
import type { IsoDate } from "@/domain/dates";

// The connectivity abstraction boundary (PRD §89/§133). Business logic in
// the server layer must only ever talk to a ChannelAdapter — never branch on
// `if (provider === "airbnb")`. Adding channel #20 means writing one new
// adapter, not touching reservation/ARI/analytics code.
//
// This is deliberately a small slice of the full interface sketched in the
// PRD (no messaging/reviews/payouts yet — see §124 Phase 2) because no real
// OTA credentials exist in this environment; the mock adapters simulate the
// shapes a real Airbnb/Booking.com/Vrbo adapter would return so the core can
// be built and tested against the interface now, and a real adapter can be
// dropped in later without touching anything above this line.

export type DiscoveredListing = {
  externalListingId: string;
  name: string;
};

export type InboundReservation = {
  externalReservationId: string;
  externalEventId: string;
  guestName: string;
  guestEmail: string | null;
  checkIn: IsoDate;
  checkOut: IsoDate;
  guests: number;
  accommodationPence: number;
  cleaningPence: number;
  otherPence: number;
  commissionPence: number;
  currency: string;
};

export type ChannelHealth = {
  score: number;
  label: "Excellent" | "Good" | "Degraded" | "Action required";
  issues: string[];
};

export interface ChannelAdapter {
  readonly provider: string;
  readonly capabilities: ChannelCapabilities;

  discoverListings(accountId: string): Promise<DiscoveredListing[]>;

  /** Pull new/changed reservations for a mapped listing. Must be safe to call repeatedly — the caller de-duplicates on externalEventId. */
  pullReservations(externalListingId: string): Promise<InboundReservation[]>;

  /** Push the canonical nightly price (already including channel markup) outward. Mock adapters accept and no-op; a real adapter would call the OTA's ARI API here. */
  pushRate(externalListingId: string, date: IsoDate, pricePence: number): Promise<void>;

  healthCheck(): Promise<ChannelHealth>;
}
