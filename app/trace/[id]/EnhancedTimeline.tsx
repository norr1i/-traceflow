import { Fragment } from 'react'
import { classifyEvent, STAGE_META, type EventCategory, type StageGroup } from './eventCategories'

// ── Types ───────────────────────────────────────────────────────────────────

export type JourneyEvent = {
  event_type:       string
  event_timestamp:  string
  title:            string
  description:      string | null
  source_table:     string
  metadata:         Record<string, unknown> | null
}

// ── Source label map ────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  production_orders:    'Production',
  bill_of_materials:    'Materials',
  batch_qc_results:     'QC Results',
  quality_inspections:  'QC Inspection',
  distribution_records: 'Distribution',
  batch_journey_events: 'Journey Log',
  raw_materials:        'Raw Materials',
}

function getSourceLabel(sourceTable: string): string {
  return SOURCE_LABELS[sourceTable] ?? sourceTable.replace(/_/g, ' ')
}

// ── Formatting ──────────────────────────────────────────────────────────────

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Actor extraction ────────────────────────────────────────────────────────

function extractActor(event: JourneyEvent): string | null {
  const m = event.metadata
  if (!m) return null
  if (typeof m.inspector_name === 'string' && m.inspector_name) return m.inspector_name
  if (typeof m.performed_by   === 'string' && m.performed_by)   return m.performed_by
  if (typeof m.created_by     === 'string' && m.created_by)     return m.created_by
  if (typeof m.user_name      === 'string' && m.user_name)      return m.user_name
  if (typeof m.inspector_id   === 'string' && m.inspector_id)
    return `Inspector ···${m.inspector_id.slice(-6)}`
  if (typeof m.user_id        === 'string' && m.user_id)
    return `User ···${m.user_id.slice(-6)}`
  return null
}

// ── Stage flow header ───────────────────────────────────────────────────────
// Shows which manufacturing stages are present in this batch's journey,
// in the order they first appear chronologically.

function StageFlowHeader({ stages }: { stages: StageGroup[] }) {
  const meaningful = stages.filter(s => s !== 'other')
  if (meaningful.length < 2) return null

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {meaningful.map((stage, i) => {
        const meta = STAGE_META[stage]
        return (
          <Fragment key={stage}>
            <div className="flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800/60 px-2.5 py-1 shadow-sm">
              <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dotColor}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${meta.textColor}`}>
                {meta.label}
              </span>
            </div>
            {i < meaningful.length - 1 && (
              <span className="text-[10px] text-gray-300 dark:text-gray-600 select-none">→</span>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

// ── Stage transition divider ────────────────────────────────────────────────
// Rendered between consecutive events that belong to different stage groups.
// Visually breaks the timeline into named manufacturing phases.

function StageDivider({ group }: { group: StageGroup }) {
  const meta = STAGE_META[group]
  return (
    <div className="flex items-center gap-3 mb-3" role="separator">
      {/* Left gutter — aligns with the center of the icon column */}
      <div className="flex shrink-0 items-center justify-center" style={{ width: 36 }}>
        <span className={`h-2 w-2 rounded-full ${meta.dotColor} opacity-70`} />
      </div>
      {/* Rule + label + rule */}
      <div className="flex flex-1 items-center gap-2">
        <div className={`h-px flex-1 ${meta.lineColor}`} />
        <span className={`shrink-0 text-[10px] font-bold uppercase tracking-widest ${meta.textColor}`}>
          {meta.label}
        </span>
        <div className={`h-px flex-1 ${meta.lineColor}`} />
      </div>
    </div>
  )
}

// ── Attribution chip ────────────────────────────────────────────────────────

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-gray-700/60 px-1.5 py-0.5 text-[10px] font-medium">
      <span className="text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-gray-600 dark:text-gray-300">{value}</span>
    </span>
  )
}

// ── Event card ──────────────────────────────────────────────────────────────

function EventCard({
  event,
  category,
  isLast,
}: {
  event:    JourneyEvent
  category: EventCategory
  isLast:   boolean
}) {
  const actor  = extractActor(event)
  const source = getSourceLabel(event.source_table)
  const {
    Icon,
    iconBg,
    iconColor,
    badgeClass,
    borderAccent,
    dotBg,
    label: categoryLabel,
  } = category

  return (
    <div className="relative flex gap-3 group">

      {/* Left column: icon circle + colored connector spine */}
      <div className="flex shrink-0 flex-col items-center" style={{ width: 36 }}>
        {/* Icon circle — slightly larger than before (h-9 w-9) */}
        <div
          className={`relative z-10 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white dark:border-gray-900 shadow-sm ${iconBg} transition-transform duration-150 group-hover:scale-110`}
        >
          <Icon size={15} className={iconColor} />
        </div>

        {/* Connector spine — colored by this event's category */}
        {!isLast && (
          <div
            className={`mt-1 w-0.5 flex-1 ${dotBg} opacity-30`}
            style={{ minHeight: 20 }}
          />
        )}
      </div>

      {/* Right column: event card with colored left accent border */}
      <div
        className={`min-w-0 flex-1 rounded-xl border border-gray-100 dark:border-gray-700/60 border-l-2 ${borderAccent} bg-white dark:bg-gray-800/60 px-3.5 py-3 shadow-sm transition-shadow duration-150 group-hover:shadow-md ${
          isLast ? 'mb-0.5' : 'mb-3'
        }`}
      >
        {/* Title row + category badge */}
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
            {event.title}
          </p>
          <span
            className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}
          >
            {categoryLabel}
          </span>
        </div>

        {/* Description */}
        {event.description && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            {event.description}
          </p>
        )}

        {/* Timestamp */}
        <p className="mt-2 text-[10px] font-medium text-gray-400 dark:text-gray-500 tabular-nums">
          {fmtDateTime(event.event_timestamp)}
        </p>

        {/* Attribution — Actor / Source / Category, always shown */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip label="Actor"    value={actor ?? 'System'} />
          <Chip label="Source"   value={source} />
          <Chip label="Category" value={categoryLabel} />
        </div>
      </div>
    </div>
  )
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading timeline">
      {/* Flow header skeleton */}
      <div className="mb-5 flex items-center gap-2">
        {[56, 52, 60, 52].map((w, i) => (
          <Fragment key={i}>
            <div
              className="h-6 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"
              style={{ width: w }}
            />
            {i < 3 && (
              <div className="h-2 w-3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            )}
          </Fragment>
        ))}
      </div>

      {/* Event card skeletons */}
      {[55, 70, 45].map((w, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex shrink-0 flex-col items-center" style={{ width: 36 }}>
            <div className="mt-0.5 h-9 w-9 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
            {i < 2 && (
              <div
                className="mt-1 w-0.5 flex-1 bg-gray-200 dark:bg-gray-700"
                style={{ minHeight: 44 }}
              />
            )}
          </div>
          <div
            className={`flex-1 rounded-xl border border-gray-100 dark:border-gray-700/60 border-l-2 border-l-gray-200 dark:border-l-gray-700 bg-white dark:bg-gray-800/60 px-3.5 py-3 shadow-sm ${
              i < 2 ? 'mb-3' : 'mb-0.5'
            } space-y-2`}
          >
            <div className="flex items-start justify-between gap-2">
              <div
                className="h-3.5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"
                style={{ width: `${w}%` }}
              />
              <div className="h-4 w-20 shrink-0 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="h-2.5 w-4/5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-2 w-1/4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="flex gap-1.5">
              {[28, 36, 32].map((bw, bi) => (
                <div
                  key={bi}
                  className="h-4 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse"
                  style={{ width: `${bw}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Fixed manufacturing lifecycle stage order ───────────────────────────────
// Events are grouped by stage in this order regardless of when they were
// recorded. Within each stage, events remain sorted by their timestamp.

const LIFECYCLE_ORDER: StageGroup[] = [
  'materials',
  'production',
  'quality',
  'distribution',
  'compliance',
  'other',
]

// ── EnhancedTimeline (public export) ───────────────────────────────────────

export function EnhancedTimeline({
  events,
  isLoading,
}: {
  events:    JourneyEvent[]
  isLoading: boolean
}) {
  if (isLoading) return <TimelineSkeleton />

  if (events.length === 0) {
    return (
      <p className="text-sm italic text-gray-400 dark:text-gray-500">
        No manufacturing events recorded for this batch.
      </p>
    )
  }

  // Classify every event once.
  const classified = events.map(e => ({ event: e, category: classifyEvent(e.event_type) }))

  // Group by stage.
  const groups = new Map<StageGroup, typeof classified>()
  for (const item of classified) {
    const list = groups.get(item.category.stageGroup) ?? []
    list.push(item)
    groups.set(item.category.stageGroup, list)
  }

  // Sort each stage group internally by timestamp ascending (earliest first).
  for (const list of groups.values()) {
    list.sort(
      (a, b) =>
        new Date(a.event.event_timestamp).getTime() -
        new Date(b.event.event_timestamp).getTime(),
    )
  }

  // Determine which stages are present, in fixed lifecycle order.
  const presentStages = LIFECYCLE_ORDER.filter(s => groups.has(s))

  // Flatten into a single render list.
  // showDivider is true for the first event of every stage except the very
  // first event overall (StageFlowHeader already labels the first stage).
  const flat = presentStages.flatMap(s => groups.get(s)!)
  const renderList = flat.map((item, i) => ({
    ...item,
    isLast:      i === flat.length - 1,
    showDivider: i > 0 && flat[i - 1].category.stageGroup !== item.category.stageGroup,
  }))

  return (
    <div className="pt-0.5">
      {/* Stage flow header — stages in fixed lifecycle order */}
      <StageFlowHeader stages={presentStages} />

      {renderList.map((item, i) => (
        <Fragment key={`${item.event.event_type}-${item.event.event_timestamp}-${i}`}>
          {item.showDivider && <StageDivider group={item.category.stageGroup} />}
          <EventCard
            event={item.event}
            category={item.category}
            isLast={item.isLast}
          />
        </Fragment>
      ))}
    </div>
  )
}
