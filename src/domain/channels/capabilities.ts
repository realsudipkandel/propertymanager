// Capability registry (PRD §3, §90). Every channel exposes a different set
// of connectivity capabilities. The UI must render functionality based on
// what a connection can actually do, never assume parity across providers.

export type ChannelCapabilityKey =
  | "availabilityWrite"
  | "ratesWrite"
  | "restrictionsWrite"
  | "reservationsRead"
  | "reservationsModify"
  | "messagesRead"
  | "reviewsRead"
  | "payoutsRead"
  | "performanceRead";

export type ChannelCapabilities = Record<ChannelCapabilityKey, boolean>;

export const CAPABILITY_LABEL: Record<ChannelCapabilityKey, string> = {
  availabilityWrite: "Push availability",
  ratesWrite: "Push rates",
  restrictionsWrite: "Push restrictions",
  reservationsRead: "Read reservations",
  reservationsModify: "Modify reservations",
  messagesRead: "Guest messaging",
  reviewsRead: "Reviews",
  payoutsRead: "Payout reporting",
  performanceRead: "Performance analytics",
};

const FULL: ChannelCapabilities = {
  availabilityWrite: true,
  ratesWrite: true,
  restrictionsWrite: true,
  reservationsRead: true,
  reservationsModify: true,
  messagesRead: true,
  reviewsRead: true,
  payoutsRead: true,
  performanceRead: true,
};

// Mock providers deliberately withhold different capabilities from each
// other, so the UI code that renders "Unavailable from X" instead of "0" has
// something real to exercise. These mirror the asymmetries described in the
// PRD (Airbnb full vs. ARI-only sync, Booking.com's richer reporting, Vrbo's
// system-of-record model for ARI) without depending on any real OTA API.
export const CHANNEL_PROVIDER_CAPABILITIES: Record<string, ChannelCapabilities> = {
  DIRECT: FULL,
  MOCK_AIRBNB: {
    ...FULL,
    payoutsRead: false,
  },
  MOCK_BOOKING_COM: {
    ...FULL,
    performanceRead: true,
    reviewsRead: true,
  },
  MOCK_VRBO: {
    ...FULL,
    messagesRead: false,
    reviewsRead: false,
  },
};

export function capabilitiesForProvider(provider: string): ChannelCapabilities {
  return CHANNEL_PROVIDER_CAPABILITIES[provider] ?? FULL;
}

/** Renders a metric as "Unavailable from <provider>" rather than a false "0" when the channel does not report it. */
export function capabilityValueLabel(
  capabilities: ChannelCapabilities,
  key: ChannelCapabilityKey,
  providerLabel: string,
  value: string,
): string {
  return capabilities[key] ? value : `Unavailable from ${providerLabel}`;
}
