'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = {
  page:       number
  totalPages: number
  totalCount: number
  pageSize:   number
  onPage:     (p: number) => void
}

export default function PaginationBar({ page, totalPages, totalCount, pageSize, onPage }: Props) {
  if (totalPages <= 1) return null

  const start = (page - 1) * pageSize + 1
  const end   = Math.min(page * pageSize, totalCount)

  return (
    <div className="flex items-center justify-between border-t border-gray-100 dark:border-[#B3B7BA]/[0.10] px-5 py-3">
      <p className="text-[12px] text-gray-400 dark:text-[#525563]">
        {start.toLocaleString()}–{end.toLocaleString()} of {totalCount.toLocaleString()}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 dark:border-white/[0.09] bg-white dark:bg-[#161B22] text-gray-500 dark:text-[#8B9BAA] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
        >
          <ChevronLeft size={13} />
        </button>
        <span className="px-2 text-[12px] font-medium text-gray-600 dark:text-[#A8B3C0]">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 dark:border-white/[0.09] bg-white dark:bg-[#161B22] text-gray-500 dark:text-[#8B9BAA] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
        >
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  )
}
