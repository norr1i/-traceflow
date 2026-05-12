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

const iconBg: Record<Accent, string> = {
  blue:   'bg-blue-500',
  green:  'bg-emerald-500',
  yellow: 'bg-yellow-500',
  red:    'bg-red-500',
  purple: 'bg-violet-500',
  orange: 'bg-orange-400',
}

export default function StatCard({ title, value, subtitle, accent = 'blue', icon: Icon, trend }: Props) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white leading-none">{value}</p>
          {subtitle && (
            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>
          )}
          {trend && (
            <p className={`mt-1.5 text-xs font-medium ${trend.value >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        {Icon && (
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg[accent]}`}>
            <Icon size={20} className="text-white" />
          </span>
        )}
      </div>
    </div>
  )
}
