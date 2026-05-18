'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { FlaskConical } from 'lucide-react'

export type QcTrendPoint = {
  date:  string
  label: string
  pass:  number
  fail:  number
  hold:  number
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

export default function QcTrendChart({ data }: { data: QcTrendPoint[] }) {
  const hasData = data.some(d => d.pass + d.fail + d.hold > 0)

  if (!hasData) {
    return (
      <div className="flex h-52 flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-500">
        <FlaskConical size={28} className="opacity-40" />
        <p className="text-sm">No QC inspections in the last 7 days.</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={208}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
        <defs>
          <linearGradient id="tfQcPass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#10b981" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="tfQcFail" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#ef4444" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="tfQcHold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#f59e0b" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
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
        />
        <Legend
          iconType="circle"
          iconSize={7}
          wrapperStyle={{ paddingTop: 8 }}
          formatter={(v) => <span style={{ fontSize: 11, color: '#9ca3af' }}>{v}</span>}
        />

        <Area
          type="monotone"
          dataKey="pass"
          name="Pass"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#tfQcPass)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: '#10b981' }}
          isAnimationActive
          animationDuration={700}
        />
        <Area
          type="monotone"
          dataKey="fail"
          name="Fail"
          stroke="#ef4444"
          strokeWidth={2}
          fill="url(#tfQcFail)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: '#ef4444' }}
          isAnimationActive
          animationDuration={700}
          animationBegin={100}
        />
        <Area
          type="monotone"
          dataKey="hold"
          name="Hold"
          stroke="#f59e0b"
          strokeWidth={2}
          fill="url(#tfQcHold)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: '#f59e0b' }}
          isAnimationActive
          animationDuration={700}
          animationBegin={200}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
