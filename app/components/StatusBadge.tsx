type Props = { status: string }

const styles: Record<string, string> = {
  pending:     'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  in_progress: 'bg-blue-100   text-blue-800   dark:bg-blue-900/30   dark:text-blue-400',
  completed:   'bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-400',
  cancelled:   'bg-red-100    text-red-800    dark:bg-red-900/30    dark:text-red-400',
}

export default function StatusBadge({ status }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
        styles[status] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
      }`}
    >
      {status.replace('_', ' ')}
    </span>
  )
}
