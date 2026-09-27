"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function RevenueChart({
  points,
}: {
  points: Array<{ month: string; revenue: number; expenses: number }>;
}) {
  return (
    <div className="h-72" data-testid="revenue-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points}>
          <XAxis dataKey="month" stroke="currentColor" fontSize={12} />
          <YAxis stroke="currentColor" fontSize={12} />
          <Tooltip />
          <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={6} />
          <Bar dataKey="expenses" name="Expenses" fill="#ec4899" radius={6} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
