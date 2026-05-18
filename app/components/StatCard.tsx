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

/* Muted, desaturated gradient stops — warm not harsh */
const iconGradient: Record<Accent, string> = {
  blue:   'from-blue-400/60 to-indigo-500/70',
  green:  'from-emerald-400/60 to-teal-500/70',
  yellow: 'from-amber-300/60 to-amber-500/70',
  red:    'from-rose-400/60 to-red-500/70',
  purple: 'from-violet-400/60 to-purple-600/70',
  orange: 'from-orange-300/60 to-orange-500/70',
}

/* Diffuse ambient glow — wide spread, low saturation */
const iconGlow: Record<Accent, string> = {
  blue:   'shadow-[0_0_28px_rgba(79,109,232,0.30)]',
  green:  'shadow-[0_0_28px_rgba(20,184,166,0.28)]',
  yellow: 'shadow-[0_0_28px_rgba(217,119,6,0.28)]',
  red:    'shadow-[0_0_28px_rgba(220,38,38,0.26)]',
  purple: 'shadow-[0_0_28px_rgba(124,58,237,0.28)]',
  orange: 'shadow-[0_0_28px_rgba(234,88,12,0.26)]',
}

/* Soft accent line gradient (fully transparent at edges) */
const accentLine: Record<Accent, string> = {
  blue:   'from-transparent via-indigo-400/40 to-transparent',
  green:  'from-transparent via-teal-400/40 to-transparent',
  yellow: 'from-transparent via-amber-400/40 to-transparent',
  red:    'from-transparent via-rose-400/40 to-transparent',
  purple: 'from-transparent via-violet-400/40 to-transparent',
  orange: 'from-transparent via-orange-400/40 to-transparent',
}

export default function StatCard({ title, value, subtitle, accent = 'blue', icon: Icon, trend }: Props) {
  return (
    <div className="
      glass-card
      group relative rounded-2xl p-5
      transition-all duration-300
      hover:-translate-y-0.5
    ">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            {title}
          </p>
          <p className="mt-2.5 text-3xl font-bold tracking-tight text-gray-900 dark:text-white leading-none">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>
          )}
          {trend && (
            <p className={`mt-1.5 text-xs font-semibold ${trend.value >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-400 dark:text-rose-400'}`}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        {Icon && (
          <span className={`
            flex h-11 w-11 shrink-0 items-center justify-center rounded-xl
            bg-gradient-to-br ${iconGradient[accent]}
            ${iconGlow[accent]}
            transition-all duration-300
            group-hover:scale-105
          `}>
            <Icon size={19} className="text-white/90" />
          </span>
        )}
      </div>

      {/* Soft accent line — fades in on hover */}
      <div className={`
        absolute bottom-0 left-8 right-8 h-px rounded-full opacity-0
        bg-gradient-to-r ${accentLine[accent]}
        dark:group-hover:opacity-100 transition-opacity duration-500
      `} />
    </div>
  )
}
