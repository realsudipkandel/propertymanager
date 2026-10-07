"use client";

import Link from "next/link";
import { useState, type ChangeEvent, type ReactNode } from "react";

import { PROPERTY_SORT, PROPERTY_SORT_OPTIONS, sortProperties, type PropertyPerformance, type PropertySort } from "@/domain/dashboard";
import { formatGbp, formatMargin } from "@/domain/money";

function isPropertySort(value: string): value is PropertySort {
  return PROPERTY_SORT_OPTIONS.some((option) => option.id === value);
}

export function PropertyLeaderboard({ properties, base }: { properties: PropertyPerformance[]; base: string }) {
  const [sort, setSort] = useState<PropertySort>(PROPERTY_SORT.PROFIT);
  const rows = sortProperties(properties, sort);
  const peak = rows.reduce((highest, row) => Math.max(highest, Math.abs(metric(row, sort))), 0);

  function changeSort(event: ChangeEvent<HTMLSelectElement>): void {
    if (isPropertySort(event.target.value)) {
      setSort(event.target.value);
    }
  }

  function renderOption(option: (typeof PROPERTY_SORT_OPTIONS)[number]): ReactNode {
    return (
      <option key={option.id} value={option.id}>
        {option.label}
      </option>
    );
  }

  function renderRow(row: PropertyPerformance): ReactNode {
    const value = metric(row, sort);
    const width = peak === 0 ? 0 : Math.round((Math.abs(value) / peak) * 100);
    return (
      <li key={row.id}>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <Link href={`${base}/properties/${row.id}`} className="font-medium text-blue-400">
            {row.name}
          </Link>
          <span className="tabular-nums text-muted">
            {formatMetric(row, sort)} · {formatMargin(row.marginBps)}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
          <div className={value < 0 ? "h-full rounded-full bg-pink-500" : "h-full rounded-full bg-emerald-400"} style={{ width: `${width}%` }} />
        </div>
      </li>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted">Add a property to see which homes make money.</p>;
  }

  return (
    <div data-testid="property-leaderboard">
      <label className="mb-4 flex items-center justify-end gap-2 text-sm text-muted">
        Sort
        <select className="glass-input w-auto" value={sort} onChange={changeSort} data-testid="property-sort">
          {PROPERTY_SORT_OPTIONS.map(renderOption)}
        </select>
      </label>
      <ul className="space-y-4">{rows.map(renderRow)}</ul>
    </div>
  );
}

function metric(row: PropertyPerformance, sort: PropertySort): number {
  if (sort === PROPERTY_SORT.REVENUE) {
    return row.revenuePence;
  }
  if (sort === PROPERTY_SORT.MARGIN) {
    return row.marginBps ?? 0;
  }
  if (sort === PROPERTY_SORT.OCCUPANCY) {
    return row.occupancyBps ?? 0;
  }
  if (sort === PROPERTY_SORT.ADR) {
    return row.adrPence ?? 0;
  }
  if (sort === PROPERTY_SORT.REVPAN) {
    return row.revpanPence ?? 0;
  }
  return row.profitPence;
}

function formatMetric(row: PropertyPerformance, sort: PropertySort): string {
  if (sort === PROPERTY_SORT.MARGIN) {
    return formatMargin(row.marginBps);
  }
  if (sort === PROPERTY_SORT.OCCUPANCY) {
    return formatMargin(row.occupancyBps);
  }
  if (sort === PROPERTY_SORT.ADR) {
    return row.adrPence === null ? "—" : formatGbp(row.adrPence);
  }
  if (sort === PROPERTY_SORT.REVPAN) {
    return row.revpanPence === null ? "—" : formatGbp(row.revpanPence);
  }
  if (sort === PROPERTY_SORT.REVENUE) {
    return formatGbp(row.revenuePence);
  }
  return formatGbp(row.profitPence);
}
