import type { LucideIcon } from 'lucide-react'

type Props = {
  title: string
  value: string | number
  subtitle?: string
  accent?: string   // retained in prop signature for call-site compat, ignored visually
  icon?: LucideIcon
  trend?: { value: number; label: string }
}

export default function StatCard({ title, value, subtitle, icon: Icon, trend }: Props) {
  return (
    <div className="glass-card rounded-xl flex flex-col transition-all duration-200 hover:-translate-y-[1px]">
      <div className="flex flex-col gap-3 px-5 pb-5 pt-4">

        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-[#4A5568] truncate">
            {title}
          </p>
          {Icon && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-white/[0.05]">
              <Icon size={14} strokeWidth={1.75} className="text-gray-400 dark:text-[#525563]" />
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
            <span className={`text-[11px] font-semibold tabular-nums ${trend.value >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-500 dark:text-red-400'}`}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
            <span className="text-[11px] text-gray-400 dark:text-[#4A5568]">{trend.label}</span>
          </div>
        )}

      </div>
    </div>
  )
}
