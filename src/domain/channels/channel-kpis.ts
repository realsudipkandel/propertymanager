import { marginBasisPoints } from "@/domain/money";

// PRD §7: KPI definitions must be explicit and reproducible. These mirror
// src/domain/kpis.ts but work at the channel/portfolio level so one
// occupancy/ADR/RevPAR formula backs both "my portfolio" and "my Airbnb
// listings" questions (PRD §78).

export type ChannelShareRow = {
  provider: string;
  label: string;
  bookings: number;
  nights: number;
  grossPence: number;
  commissionPence: number;
  netContributionPence: number;
  revenueShareBps: number | null;
  marginBps: number | null;
};

export type ChannelAggregateInput = {
  provider: string;
  label: string;
  nights: number;
  grossPence: number;
  commissionPence: number;
};

export function channelShare(rows: ChannelAggregateInput[]): ChannelShareRow[] {
  const totalGross = rows.reduce((sum, row) => sum + row.grossPence, 0);
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.provider, (counts.get(row.provider) ?? 0) + 1);
  }
  const grouped = new Map<string, ChannelShareRow>();
  for (const row of rows) {
    const existing = grouped.get(row.provider);
    const netContribution = row.grossPence - row.commissionPence;
    if (existing) {
      existing.bookings += 1;
      existing.nights += row.nights;
      existing.grossPence += row.grossPence;
      existing.commissionPence += row.commissionPence;
      existing.netContributionPence += netContribution;
    } else {
      grouped.set(row.provider, {
        provider: row.provider,
        label: row.label,
        bookings: 1,
        nights: row.nights,
        grossPence: row.grossPence,
        commissionPence: row.commissionPence,
        netContributionPence: netContribution,
        revenueShareBps: null,
        marginBps: null,
      });
    }
  }
  return [...grouped.values()]
    .map((row) => ({
      ...row,
      revenueShareBps: marginBasisPoints(row.grossPence, totalGross),
      marginBps: marginBasisPoints(row.netContributionPence, row.grossPence),
    }))
    .sort((a, b) => b.grossPence - a.grossPence);
}

export type ContributionPerNightInput = {
  grossPence: number;
  commissionPence: number;
  variableCostsPence: number;
  occupiedNights: number;
};

/** PRD §7: contribution per occupied night — the differentiating "profit, not just revenue" metric. */
export function contributionPerOccupiedNightPence(input: ContributionPerNightInput): number | null {
  if (input.occupiedNights <= 0) {
    return null;
  }
  const contribution = input.grossPence - input.commissionPence - input.variableCostsPence;
  return Math.round(contribution / input.occupiedNights);
}
