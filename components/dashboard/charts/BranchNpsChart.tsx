'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { DashboardMetrics } from '@/types/database';

function color(nps: number | null) {
  if (nps === null) return '#d1d5db';
  if (nps >= 50) return '#2E7D32';
  if (nps >= 0) return '#FF9800';
  return '#C62828';
}

export function BranchNpsChart({ data }: { data: DashboardMetrics['by_branch'] }) {
  const rows = data.filter((b) => b.responses > 0).sort((a, b) => (b.nps ?? -999) - (a.nps ?? -999));
  return (
    <div className="w-full" style={{ height: Math.max(160, rows.length * 38 + 40) }}>
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2ee" horizontal={false} />
          <XAxis type="number" domain={[-100, 100]} tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: '#374151' }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
          <Bar dataKey="nps" name="NPS" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {rows.map((r) => (
              <Cell key={r.branch_id} fill={color(r.nps)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
