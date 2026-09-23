'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatDate } from '@/lib/utils';
import type { DashboardMetrics } from '@/types/database';

export function TrendChart({ data }: { data: DashboardMetrics['trend'] }) {
  const rows = data.map((d) => ({ ...d, label: formatDate(d.day) }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2ee" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[-100, 100]}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
            formatter={(value: number, name: string) => [value ?? '—', name]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="left" dataKey="responses" name="Respuestas" fill="#A5D6A7" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Line
            yAxisId="right"
            dataKey="nps"
            name="NPS"
            stroke="#2E7D32"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            connectNulls
            type="monotone"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
