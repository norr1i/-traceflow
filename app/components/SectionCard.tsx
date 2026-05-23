type Props = {
  title: string
  subtitle?: string
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export default function SectionCard({ title, subtitle, children, action, className = '' }: Props) {
  return (
    <div className={`glass-card overflow-hidden rounded-2xl ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 dark:border-white/[0.06] px-6 py-4">
        <div>
          <h2 className="text-[13px] font-semibold text-gray-900 dark:text-[#E2E8F0] tracking-tight">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-gray-400 dark:text-[#525563]">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}
