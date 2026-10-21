import type { ChannelAdapter, ChannelHealth, DiscoveredListing, InboundReservation } from "@/domain/channels/adapter";
import { capabilitiesForProvider } from "@/domain/channels/capabilities";

/**
 * Mira Direct is treated as a channel like any other (PRD §58) so direct
 * reservations participate in the same inventory, pricing and analytics
 * pipeline as OTA bookings. It never has reservations to pull — they are
 * created inside Mira — and it owns 100% of its own content/rates.
 */
export function createDirectAdapter(): ChannelAdapter {
  return {
    provider: "DIRECT",
    capabilities: capabilitiesForProvider("DIRECT"),

    async discoverListings(): Promise<DiscoveredListing[]> {
      return [];
    },

    async pullReservations(): Promise<InboundReservation[]> {
      return [];
    },

    async pushRate(): Promise<void> {
      // Direct bookings read the canonical rate straight from Mira — nothing to push.
    },

    async healthCheck(): Promise<ChannelHealth> {
      return { score: 100, label: "Excellent", issues: [] };
    },
  };
}
