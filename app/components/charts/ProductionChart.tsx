'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#f59e0b', '#3b82f6', '#22c55e', '#ef4444']

type Props = { data: Record<string, number> }

export default function ProductionChart({ data }: Props) {
  const chartData = Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: name.replace('_', ' '), value }))

  if (chartData.length === 0 || chartData.every(d => d.value === 0)) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-gray-400 dark:text-gray-500">
        No production orders yet.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={58}
          outerRadius={88}
          paddingAngle={3}
          dataKey="value"
          strokeWidth={0}
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#111827',
            border: '1px solid #374151',
            borderRadius: '10px',
            fontSize: '12px',
            color: '#f9fafb',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
          labelStyle={{ color: '#9ca3af' }}
          itemStyle={{ color: '#f9fafb' }}
          formatter={(value: unknown, name: unknown) => [Number(value ?? 0), String(name)]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ paddingTop: 8 }}
          formatter={(value) => (
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
