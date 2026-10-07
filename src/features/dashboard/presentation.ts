import { TONE, type Tone } from "@/domain/dashboard";

export const CHART_COLOUR = {
  REVENUE: "#3b82f6",
  COST: "#ec4899",
  PROFIT: "#10b981",
  PURPLE: "#8b5cf6",
  ORANGE: "#f59e0b",
  TEAL: "#14b8a6",
  SLATE: "#94a3b8",
} as const;

export const STACK_COLOURS = [
  CHART_COLOUR.REVENUE,
  CHART_COLOUR.PURPLE,
  CHART_COLOUR.TEAL,
  CHART_COLOUR.ORANGE,
  CHART_COLOUR.COST,
  CHART_COLOUR.SLATE,
] as const;

export function toneClass(tone: Tone): string {
  if (tone === TONE.POSITIVE) {
    return "text-emerald-400";
  }
  if (tone === TONE.NEGATIVE) {
    return "text-pink-400";
  }
  if (tone === TONE.WARNING) {
    return "text-orange-400";
  }
  return "text-muted";
}

export function heatmapClass(occupancyBps: number | null): string {
  if (occupancyBps === null) {
    return "border border-transparent bg-transparent";
  }
  if (occupancyBps === 0) {
    return "border border-line bg-white/5";
  }
  if (occupancyBps < 4_000) {
    return "border border-blue-500/20 bg-blue-500/25";
  }
  if (occupancyBps < 7_000) {
    return "border border-blue-500/30 bg-blue-500/50";
  }
  if (occupancyBps < 9_000) {
    return "border border-blue-400/40 bg-blue-500/75";
  }
  return "border border-blue-300/50 bg-blue-400 text-slate-950";
}
