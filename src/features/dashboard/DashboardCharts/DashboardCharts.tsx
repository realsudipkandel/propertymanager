"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  ReferenceLine,
  BarChart,
  LineChart,
} from "recharts";

import type { CompositionPoint, ExpenseTrendPoint, HospitalityPoint, PropertyPerformance, ShareBar, TrendPoint, CashPoint } from "@/domain/dashboard";
import { formatGbp } from "@/domain/money";
import { CHART_COLOUR, STACK_COLOURS } from "@/features/dashboard/presentation";

function formatPounds(value: unknown): string {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) {
    return "";
  }
  return formatGbp(Math.round(amount * 100));
}

function formatTooltip(value: unknown): string {
  return formatPounds(value);
}

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const data = points.map((point) => ({
    label: point.label,
    Revenue: point.revenuePence / 100,
    Costs: point.costPence / 100,
    Profit: point.profitPence / 100,
  }));
  const empty = data.every((point) => point.Revenue === 0 && point.Costs === 0 && point.Profit === 0);
  if (empty) {
    return <p className="text-sm text-muted">No ledger movement in this range yet.</p>;
  }
  return (
    <div className="h-72" data-testid="revenue-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(148,163,184,0.15)" vertical={false} />
          <XAxis dataKey="label" stroke="currentColor" fontSize={12} />
          <YAxis stroke="currentColor" fontSize={12} />
          <Tooltip formatter={formatTooltip} />
          <Legend />
          <Line type="monotone" dataKey="Revenue" stroke={CHART_COLOUR.REVENUE} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Costs" stroke={CHART_COLOUR.COST} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Profit" stroke={CHART_COLOUR.PROFIT} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CompositionChart({ points }: { points: CompositionPoint[] }) {
  const data = points.map((point) => ({
    label: point.label,
    Accommodation: point.accommodationPence / 100,
    Cleaning: point.cleaningPence / 100,
    "Extra guest": point.extraGuestPence / 100,
    Parking: point.parkingPence / 100,
    "Other charges": point.otherPence / 100,
  }));
  const empty = data.every((point) => point.Accommodation + point.Cleaning + point["Extra guest"] + point.Parking + point["Other charges"] === 0);
  if (empty) {
    return <p className="text-sm text-muted">No check-ins in this range yet.</p>;
  }
  return (
    <div className="h-72" data-testid="composition-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="rgba(148,163,184,0.15)" vertical={false} />
          <XAxis dataKey="label" stroke="currentColor" fontSize={12} />
          <YAxis stroke="currentColor" fontSize={12} />
          <Tooltip formatter={formatTooltip} />
          <Legend />
          <Bar dataKey="Accommodation" stackId="revenue" fill={CHART_COLOUR.REVENUE} />
          <Bar dataKey="Cleaning" stackId="revenue" fill={CHART_COLOUR.TEAL} />
          <Bar dataKey="Extra guest" stackId="revenue" fill={CHART_COLOUR.PURPLE} />
          <Bar dataKey="Parking" stackId="revenue" fill={CHART_COLOUR.ORANGE} />
          <Bar dataKey="Other charges" stackId="revenue" fill={CHART_COLOUR.SLATE} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HospitalityChart({ points }: { points: HospitalityPoint[] }) {
  const data = points.map((point) => ({
    label: point.label,
    Occupancy: point.occupancyBps === null ? null : point.occupancyBps / 100,
    ADR: point.adrPence === null ? null : point.adrPence / 100,
  }));
  return (
    <div className="h-72" data-testid="hospitality-chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid stroke="rgba(148,163,184,0.15)" vertical={false} />
          <XAxis dataKey="label" stroke="currentColor" fontSize={12} />
          <YAxis yAxisId="occupancy" stroke={CHART_COLOUR.TEAL} fontSize={12} unit="%" />
          <YAxis yAxisId="adr" orientation="right" stroke={CHART_COLOUR.REVENUE} fontSize={12} />
          <Tooltip />
          <Legend />
          <Line yAxisId="occupancy" type="monotone" dataKey="Occupancy" stroke={CHART_COLOUR.TEAL} strokeWidth={2} dot={false} />
          <Line yAxisId="adr" type="monotone" dataKey="ADR" stroke={CHART_COLOUR.REVENUE} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ExpenseDonut({ rows }: { rows: ShareBar[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">No operating costs in this range.</p>;
  }
  const data = rows.map((row) => ({ name: row.label, value: row.amountPence / 100 }));
  return (
    <div className="h-72" data-testid="expense-donut">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={2}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={STACK_COLOURS[index % STACK_COLOURS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={formatTooltip} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ExpenseStack({ points, keys }: { points: ExpenseTrendPoint[]; keys: string[] }) {
  const data = points.map((point) => {
    const row: Record<string, string | number> = { label: point.label };
    for (const key of keys) {
      row[key] = (point.amounts[key] ?? 0) / 100;
    }
    return row;
  });
  if (keys.length === 0) {
    return <p className="text-sm text-muted">No cost categories in this range.</p>;
  }
  return (
    <div className="h-72" data-testid="expense-trend">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="rgba(148,163,184,0.15)" vertical={false} />
          <XAxis dataKey="label" stroke="currentColor" fontSize={12} />
          <YAxis stroke="currentColor" fontSize={12} />
          <Tooltip formatter={formatTooltip} />
          <Legend />
          {keys.map((key, index) => (
            <Bar key={key} dataKey={key} stackId="costs" fill={STACK_COLOURS[index % STACK_COLOURS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CashFlowChart({ points }: { points: CashPoint[] }) {
  const data = points.map((point) => ({
    label: point.label,
    "Money in": point.inPence / 100,
    "Money out": point.outPence / 100,
    "Closing balance": point.closingPence / 100,
  }));
  return (
    <div className="h-72" data-testid="cash-flow-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(148,163,184,0.15)" vertical={false} />
          <XAxis dataKey="label" stroke="currentColor" fontSize={12} />
          <YAxis stroke="currentColor" fontSize={12} />
          <Tooltip formatter={formatTooltip} />
          <Legend />
          <Line type="monotone" dataKey="Money in" stroke={CHART_COLOUR.TEAL} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Money out" stroke={CHART_COLOUR.COST} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Closing balance" stroke={CHART_COLOUR.REVENUE} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PropertyMatrix({
  properties,
  guides,
}: {
  properties: PropertyPerformance[];
  guides: { occupancyBps: number; marginBps: number } | null;
}) {
  const data = properties
    .filter((property) => property.occupancyBps !== null && property.marginBps !== null)
    .map((property) => ({
      name: property.name,
      occupancy: (property.occupancyBps ?? 0) / 100,
      margin: (property.marginBps ?? 0) / 100,
      revenue: Math.max(property.revenuePence / 100, 1),
    }));
  if (data.length === 0) {
    return <p className="text-sm text-muted">Occupancy and margin appear once a property has nights and revenue.</p>;
  }
  return (
    <div className="h-80" data-testid="property-matrix">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart>
          <CartesianGrid stroke="rgba(148,163,184,0.15)" />
          <XAxis dataKey="occupancy" name="Occupancy" unit="%" stroke="currentColor" fontSize={12} />
          <YAxis dataKey="margin" name="Margin" unit="%" stroke="currentColor" fontSize={12} />
          <ZAxis dataKey="revenue" range={[60, 240]} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(value, name) => [typeof value === "number" ? value.toFixed(1) : value, name]} />
          {guides ? <ReferenceLine x={guides.occupancyBps / 100} stroke={CHART_COLOUR.SLATE} strokeDasharray="4 4" /> : null}
          {guides ? <ReferenceLine y={guides.marginBps / 100} stroke={CHART_COLOUR.SLATE} strokeDasharray="4 4" /> : null}
          <Scatter data={data} fill={CHART_COLOUR.PURPLE} />
        </ScatterChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-muted">
        Dashed lines are the portfolio medians. High occupancy with low margin is a cost problem. Low occupancy with high margin is a pricing or marketing opportunity.
      </p>
    </div>
  );
}
