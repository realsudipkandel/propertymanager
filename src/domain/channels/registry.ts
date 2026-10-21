import type { ChannelAdapter } from "@/domain/channels/adapter";
import { createDirectAdapter } from "@/domain/channels/adapters/direct-adapter";
import { createMockOtaAdapter } from "@/domain/channels/adapters/mock-ota-adapter";

export const CHANNEL_PROVIDER = {
  DIRECT: "DIRECT",
  MOCK_AIRBNB: "MOCK_AIRBNB",
  MOCK_BOOKING_COM: "MOCK_BOOKING_COM",
  MOCK_VRBO: "MOCK_VRBO",
} as const;

export type ChannelProviderCode = (typeof CHANNEL_PROVIDER)[keyof typeof CHANNEL_PROVIDER];

export const CHANNEL_PROVIDER_LABEL: Record<ChannelProviderCode, string> = {
  DIRECT: "Mira Direct",
  MOCK_AIRBNB: "Airbnb",
  MOCK_BOOKING_COM: "Booking.com",
  MOCK_VRBO: "Vrbo",
};

export function isChannelProviderCode(value: string): value is ChannelProviderCode {
  return value in CHANNEL_PROVIDER_LABEL;
}

/** The single place in the codebase allowed to branch on a provider string — every other layer only sees a ChannelAdapter. */
export function adapterForProvider(provider: ChannelProviderCode): ChannelAdapter {
  if (provider === "DIRECT") {
    return createDirectAdapter();
  }
  return createMockOtaAdapter(provider);
}
