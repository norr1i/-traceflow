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

/* Muted, palette-aligned gradient stops */
const iconGradient: Record<Accent, string> = {
  blue:   'from-[#3a6f8f]/65 to-[#2d5a74]/75',
  green:  'from-[#2d7a5a]/65 to-[#245f46]/75',
  yellow: 'from-[#8a6530]/65 to-[#6e5025]/75',
  red:    'from-[#8a3535]/65 to-[#6e2828]/75',
  purple: 'from-[#5a4690]/65 to-[#46386e]/75',
  orange: 'from-[#8a6030]/65 to-[#6e4c25]/75',
}

/* Soft ambient glow — diffuse, palette-aligned */
const iconGlow: Record<Accent, string> = {
  blue:   'shadow-[0_0_28px_rgba(58,111,143,0.28)]',
  green:  'shadow-[0_0_28px_rgba(45,122,90,0.24)]',
  yellow: 'shadow-[0_0_28px_rgba(138,101,48,0.24)]',
  red:    'shadow-[0_0_28px_rgba(138,53,53,0.24)]',
  purple: 'shadow-[0_0_28px_rgba(90,70,144,0.24)]',
  orange: 'shadow-[0_0_28px_rgba(138,96,48,0.24)]',
}

/* Subtle accent line — fades out at edges */
const accentLine: Record<Accent, string> = {
  blue:   'from-transparent via-[#4a7fa5]/30 to-transparent',
  green:  'from-transparent via-[#2d7a5a]/28 to-transparent',
  yellow: 'from-transparent via-[#8a6530]/28 to-transparent',
  red:    'from-transparent via-[#8a3535]/28 to-transparent',
  purple: 'from-transparent via-[#5a4690]/28 to-transparent',
  orange: 'from-transparent via-[#8a6030]/28 to-transparent',
}

export default function StatCard({ title, value, subtitle, accent = 'blue', icon: Icon, trend }: Props) {
  return (
    <div className="glass-card group relative rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#6C6D74]">
            {title}
          </p>
          <p className="mt-2.5 text-3xl font-bold tracking-tight text-[#090F15] dark:text-[#D3D1CE] leading-none">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1.5 text-xs text-[#6C6D74]">{subtitle}</p>
          )}
          {trend && (
            <p className={`mt-1.5 text-xs font-semibold ${trend.value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
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

      {/* Soft accent line on hover */}
      <div className={`
        absolute bottom-0 left-8 right-8 h-px rounded-full opacity-0
        bg-gradient-to-r ${accentLine[accent]}
        dark:group-hover:opacity-100 transition-opacity duration-500
      `} />
    </div>
  )
}
