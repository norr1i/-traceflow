'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { QrCode } from 'lucide-react'

export type ScanTrendPoint = {
  date:          string
  label:         string
  scans:         number
  uniqueBatches: number
}

const TIP_STYLE = {
  backgroundColor: '#111827',
  border: '1px solid #374151',
  borderRadius: '10px',
  fontSize: '12px',
  color: '#f9fafb',
  padding: '8px 12px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
}

export default function ScanActivityChart({ data }: { data: ScanTrendPoint[] }) {
  const hasData = data.some(d => d.scans > 0)

  if (!hasData) {
    return (
      <div className="flex h-52 flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-500">
        <QrCode size={28} className="opacity-40" />
        <p className="text-sm">No QR scan activity in the last 7 days.</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={208}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barSize={20}>
        <defs>
          <linearGradient id="tfScanBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.6} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />

        <XAxis
          dataKey="label"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={32}
        />

        <Tooltip
          contentStyle={TIP_STYLE}
          labelStyle={{ color: '#9ca3af', marginBottom: 4, fontSize: 11 }}
          itemStyle={{ color: '#f9fafb', fontSize: 12 }}
          cursor={{ fill: '#374151', opacity: 0.25 }}
          formatter={(val) => [Number(val ?? 0), 'Total scans'] as [number, string]}
        />

        <Bar
          dataKey="scans"
          name="scans"
          fill="url(#tfScanBar)"
          radius={[4, 4, 0, 0]}
          isAnimationActive
          animationDuration={700}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
