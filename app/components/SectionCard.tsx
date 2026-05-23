type Props = {
  title: string
  subtitle?: string
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
  flush?: boolean
}

export default function SectionCard({
  title,
  subtitle,
  children,
  action,
  className = '',
  flush = false,
}: Props) {
  return (
    <div className={`glass-card overflow-hidden rounded-xl ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 dark:border-white/[0.07] px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="text-[13.5px] font-semibold tracking-[-0.01em] text-gray-900 dark:text-[#E8EDF5] truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-[11px] text-gray-400 dark:text-[#4A5568] truncate">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={flush ? '' : 'px-5 py-4'}>{children}</div>
    </div>
  )
}
