import { describe, expect, it } from "vitest";

import { channelShare, contributionPerOccupiedNightPence } from "@/domain/channels/channel-kpis";

describe("channelShare", () => {
  it("groups by provider and computes revenue share and margin", () => {
    const rows = channelShare([
      { provider: "MOCK_AIRBNB", label: "Airbnb", nights: 3, grossPence: 60_000, commissionPence: 9_000 },
      { provider: "MOCK_AIRBNB", label: "Airbnb", nights: 2, grossPence: 40_000, commissionPence: 6_000 },
      { provider: "DIRECT", label: "Mira Direct", nights: 3, grossPence: 40_000, commissionPence: 0 },
    ]);
    const airbnb = rows.find((row) => row.provider === "MOCK_AIRBNB");
    const direct = rows.find((row) => row.provider === "DIRECT");
    expect(airbnb?.bookings).toBe(2);
    expect(airbnb?.grossPence).toBe(100_000);
    expect(airbnb?.netContributionPence).toBe(85_000);
    expect(airbnb?.revenueShareBps).toBe(7_143); // 100000 / 140000
    expect(direct?.marginBps).toBe(10_000); // no commission, 100% margin
  });

  it("returns an empty list for no bookings", () => {
    expect(channelShare([])).toEqual([]);
  });
});

describe("contributionPerOccupiedNightPence", () => {
  it("nets commission and variable costs across occupied nights", () => {
    const result = contributionPerOccupiedNightPence({
      grossPence: 100_000,
      commissionPence: 15_000,
      variableCostsPence: 5_000,
      occupiedNights: 4,
    });
    expect(result).toBe(20_000);
  });

  it("returns null when there are no occupied nights", () => {
    expect(contributionPerOccupiedNightPence({ grossPence: 0, commissionPence: 0, variableCostsPence: 0, occupiedNights: 0 })).toBeNull();
  });
});
