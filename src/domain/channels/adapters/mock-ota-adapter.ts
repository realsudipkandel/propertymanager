import type { ChannelAdapter, ChannelHealth, DiscoveredListing, InboundReservation } from "@/domain/channels/adapter";
import { capabilitiesForProvider } from "@/domain/channels/capabilities";
import { addDays, todayIso } from "@/domain/dates";

const PROVIDER_LABEL: Record<string, string> = {
  MOCK_AIRBNB: "Airbnb",
  MOCK_BOOKING_COM: "Booking.com",
  MOCK_VRBO: "Vrbo",
};

const PROVIDER_GUESTS: Record<string, readonly [string, string]> = {
  MOCK_AIRBNB: ["Priya Nair", "priya.nair@example.com"],
  MOCK_BOOKING_COM: ["Marco Bianchi", "marco.bianchi@example.com"],
  MOCK_VRBO: ["Grace Oliveira", "grace.oliveira@example.com"],
};

function stableOffset(seed: string): number {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.codePointAt(0)!) % 97;
  }
  return hash % 14;
}

/**
 * Simulates an OTA connectivity partner. There are no real Airbnb/Booking.com/Vrbo
 * credentials in this environment, so this adapter stands in for the real
 * ones behind the ChannelAdapter interface: deterministic (same inputs
 * produce the same reservation + event ids every call, exercising the
 * idempotency path), and respecting the capability differences registered
 * for the provider. Swapping this for a certified direct integration later
 * means implementing this same interface — nothing above the adapter layer
 * changes.
 */
export function createMockOtaAdapter(provider: "MOCK_AIRBNB" | "MOCK_BOOKING_COM" | "MOCK_VRBO"): ChannelAdapter {
  const label = PROVIDER_LABEL[provider] ?? provider;
  const [guestName, guestEmail] = PROVIDER_GUESTS[provider] ?? ["Guest", null];

  return {
    provider,
    capabilities: capabilitiesForProvider(provider),

    async discoverListings(accountId: string): Promise<DiscoveredListing[]> {
      return [
        { externalListingId: `${provider}-${accountId.slice(0, 8)}-1`, name: `${label} listing 1` },
        { externalListingId: `${provider}-${accountId.slice(0, 8)}-2`, name: `${label} listing 2` },
      ];
    },

    async pullReservations(externalListingId: string): Promise<InboundReservation[]> {
      const today = todayIso();
      const offset = stableOffset(externalListingId);
      const checkIn = addDays(today, offset + 2);
      const checkOut = addDays(checkIn, 3);
      const accommodationPence = 9_000 + offset * 350;
      const commissionPence = Math.round(accommodationPence * 0.15);
      return [
        {
          externalReservationId: `${externalListingId}-RES-1`,
          externalEventId: `${externalListingId}-EVT-1`,
          guestName,
          guestEmail,
          checkIn,
          checkOut,
          guests: 2,
          accommodationPence,
          cleaningPence: 5_500,
          otherPence: 0,
          commissionPence,
          currency: "GBP",
        },
      ];
    },

    async pushRate(): Promise<void> {
      // Mock: a real adapter calls the provider's ARI endpoint here.
    },

    async healthCheck(): Promise<ChannelHealth> {
      return {
        score: 94,
        label: "Excellent",
        issues: [],
      };
    },
  };
}

export function mockOtaDisplayName(provider: string): string {
  return PROVIDER_LABEL[provider] ?? provider;
}
