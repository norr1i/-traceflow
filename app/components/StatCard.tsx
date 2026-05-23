import type { LucideIcon } from 'lucide-react'

type Accent = 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange'

type Props = {
  title: string
  value: string | number
  subtitle?: string
  accent?: Accent
  icon?: LucideIcon
  trend?: { value: number; label: string }
}

const accentTokens: Record<Accent, {
  icon:      string
  trend_pos: string
  trend_neg: string
  dot:       string
  topBar:    string
  glow:      string   // radial gradient color stop for dark mode
}> = {
  blue:   {
    icon:      'bg-[#4a8fb9]/10 text-[#4a8fb9] dark:bg-[#4a8fb9]/15 dark:text-[#60a5d4]',
    trend_pos: 'text-emerald-600 dark:text-emerald-400',
    trend_neg: 'text-red-500 dark:text-red-400',
    dot:       'bg-[#4a8fb9]',
    topBar:    'bg-[#4a8fb9]',
    glow:      'rgba(74,143,185,0.18)',
  },
  green:  {
    icon:      'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    trend_pos: 'text-emerald-600 dark:text-emerald-400',
    trend_neg: 'text-red-500 dark:text-red-400',
    dot:       'bg-emerald-500',
    topBar:    'bg-emerald-500',
    glow:      'rgba(16,185,129,0.15)',
  },
  yellow: {
    icon:      'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
    trend_pos: 'text-emerald-600 dark:text-emerald-400',
    trend_neg: 'text-red-500 dark:text-red-400',
    dot:       'bg-amber-400',
    topBar:    'bg-amber-400',
    glow:      'rgba(245,158,11,0.14)',
  },
  red:    {
    icon:      'bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400',
    trend_pos: 'text-emerald-600 dark:text-emerald-400',
    trend_neg: 'text-red-500 dark:text-red-400',
    dot:       'bg-red-500',
    topBar:    'bg-red-500',
    glow:      'rgba(239,68,68,0.15)',
  },
  purple: {
    icon:      'bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
    trend_pos: 'text-emerald-600 dark:text-emerald-400',
    trend_neg: 'text-red-500 dark:text-red-400',
    dot:       'bg-violet-500',
    topBar:    'bg-violet-500',
    glow:      'rgba(139,92,246,0.15)',
  },
  orange: {
    icon:      'bg-orange-500/10 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400',
    trend_pos: 'text-emerald-600 dark:text-emerald-400',
    trend_neg: 'text-red-500 dark:text-red-400',
    dot:       'bg-orange-400',
    topBar:    'bg-orange-400',
    glow:      'rgba(251,146,60,0.15)',
  },
}

export default function StatCard({ title, value, subtitle, accent = 'blue', icon: Icon, trend }: Props) {
  const tokens = accentTokens[accent]

  return (
    <div className="glass-card rounded-xl overflow-hidden flex flex-col relative group transition-all duration-200 hover:-translate-y-[1px]">

      {/* Accent top line */}
      <div className={`h-[2px] w-full shrink-0 ${tokens.topBar}`} />

      {/* Dark-mode radial glow — animates slowly in background */}
      <div
        className="kpi-glow pointer-events-none absolute inset-0 hidden dark:block rounded-xl"
        style={{
          background: `radial-gradient(ellipse 90% 60% at 95% 0%, ${tokens.glow} 0%, transparent 65%)`,
        }}
      />

      <div className="relative flex flex-col gap-3 px-5 pb-5 pt-4">

        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-[#4A5568] truncate">
            {title}
          </p>
          {Icon && (
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tokens.icon}`}>
              <Icon size={14} strokeWidth={1.75} />
            </span>
          )}
        </div>

        {/* Value */}
        <div>
          <p className="text-[2.5rem] font-bold tabular-nums leading-none tracking-tighter text-gray-900 dark:text-white">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1.5 text-[11px] leading-snug text-gray-400 dark:text-[#4A5568]">
              {subtitle}
            </p>
          )}
        </div>

        {/* Trend */}
        {trend && (
          <div className="flex items-center gap-1.5 border-t border-gray-100 dark:border-white/[0.06] pt-2.5">
            <span className={`text-[11px] font-semibold tabular-nums ${trend.value >= 0 ? tokens.trend_pos : tokens.trend_neg}`}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
            <span className="text-[11px] text-gray-400 dark:text-[#4A5568]">{trend.label}</span>
          </div>
        )}

      </div>
    </div>
  )
}
