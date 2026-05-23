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

const iconStyle: Record<Accent, string> = {
  blue:   'bg-[#4a8fb9]/10 text-[#4a8fb9] dark:bg-[#4a8fb9]/12 dark:text-[#60a5d4]',
  green:  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  yellow: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  red:    'bg-red-500/10 text-red-600 dark:text-red-400',
  purple: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
}

export default function StatCard({ title, value, subtitle, accent = 'blue', icon: Icon, trend }: Props) {
  return (
    <div className="glass-card group rounded-2xl p-5 transition-all duration-200 hover:-translate-y-px">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">
          {title}
        </p>
        {Icon && (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${iconStyle[accent]}`}>
            <Icon size={16} strokeWidth={1.75} />
          </span>
        )}
      </div>
      <p className="text-[2.25rem] font-bold tabular-nums leading-none tracking-tight text-[#0F1923] dark:text-[#E2E8F0]">
        {value}
      </p>
      {subtitle && (
        <p className="mt-2 text-xs text-[#6B7280]">{subtitle}</p>
      )}
      {trend && (
        <p className={`mt-2 text-xs font-semibold ${trend.value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
          {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
        </p>
      )}
    </div>
  )
}
