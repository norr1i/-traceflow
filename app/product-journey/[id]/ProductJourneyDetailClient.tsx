'use client'

import { Fragment, useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { classifyEvent } from '../../trace/[id]/eventCategories'
import {
  ChevronLeft, Package, Layers, ShieldCheck, Truck, ClipboardList,
  FileWarning, AlertTriangle, Activity, Loader2, User, Calendar,
  Hash, GitBranch, CheckCircle2,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type TraceOrder = {
  id:           string
  product_name: string
  sku:          string
  quantity:     number
  status:       string
  created_at:   string
  started_at:   string | null
  completed_at: string | null
}
type TraceQc = {
  status:         'pass' | 'fail' | 'hold'
  inspector_name: string
  notes:          string | null
  inspected_at:   string
}
type TraceMaterial = {
  material_name: string
  lot_number:    string | null
  quantity:      number
  unit:          string
}
type TraceSale = {
  customer_name: string | null
  quantity:      number
  sold_at:       string
}
type TraceData = {
  order:      TraceOrder
  qc_results: TraceQc[]
  materials:  TraceMaterial[]
  sales:      TraceSale[]
}
type JourneyEvent = {
  event_type:      string
  event_timestamp: string
  title:           string
  description:     string | null
  source_table:    string
  metadata:        Record<string, unknown> | null
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtDateTime(iso: string) {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  )
}
function extractActor(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null
  for (const k of ['inspector_name', 'performed_by', 'created_by', 'user_name']) {
    if (typeof meta[k] === 'string' && meta[k]) return meta[k] as string
  }
  return null
}
function computeCompletion(events: JourneyEvent[], order: TraceOrder, salesLen: number): number {
  if (order.status === 'cancelled') return 0
  const groups = new Set(events.map(e => classifyEvent(e.event_type).stageGroup))
  let pct = 0
  if (groups.has('materials'))                     pct += 20
  if (groups.has('production'))                    pct += 30
  if (groups.has('quality'))                       pct += 25
  if (groups.has('distribution') || salesLen > 0) pct += 25
  if (pct === 0 && order.status === 'in_progress') pct = 15
  if (pct === 0 && order.status === 'completed')   pct = 80
  return Math.min(pct, 100)
}

// ── Badge maps ────────────────────────────────────────────────────────────────

const ORDER_BADGE: Record<string, string> = {
  pending:     'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  completed:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}
const ORDER_LABEL: Record<string, string> = {
  pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled',
}
const QC_BADGE: Record<string, string> = {
  pass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  fail: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  hold: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}
const QC_TEXT: Record<string, string> = {
  pass: 'text-emerald-600 dark:text-emerald-400',
  fail: 'text-red-600 dark:text-red-400',
  hold: 'text-amber-600 dark:text-amber-400',
}
const QC_LABEL: Record<string, string> = {
  pass: 'QC Passed', fail: 'QC Failed', hold: 'QC On Hold',
}

// ── Stage flow ────────────────────────────────────────────────────────────────

const STAGES = [
  { key: 'materials',    label: 'Raw Materials',    dot: 'bg-orange-400', text: 'text-orange-500 dark:text-orange-400' },
  { key: 'production',   label: 'Production',       dot: 'bg-blue-500',   text: 'text-blue-600 dark:text-blue-400'    },
  { key: 'quality',      label: 'Quality Control',  dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'distribution', label: 'Distribution',     dot: 'bg-teal-500',   text: 'text-teal-600 dark:text-teal-400'   },
] as const

function StageFlow({ events }: { events: JourneyEvent[] }) {
  const present = new Set(events.map(e => classifyEvent(e.event_type).stageGroup))
  return (
    <div className="mb-5 flex flex-wrap items-center gap-1.5">
      {STAGES.map((s, i) => {
        const has = present.has(s.key)
        return (
          <Fragment key={s.key}>
            <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 shadow-sm ${has ? 'border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800/60' : 'border-dashed border-gray-200 dark:border-gray-700 bg-transparent opacity-40'}`}>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${s.text}`}>{s.label}</span>
            </div>
            {i < STAGES.length - 1 && (
              <span className="text-[10px] text-gray-300 dark:text-gray-600 select-none">→</span>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

// ── Timeline event card ───────────────────────────────────────────────────────

function TimelineEvent({ event, isLast }: { event: JourneyEvent; isLast: boolean }) {
  const cat   = classifyEvent(event.event_type)
  const actor = extractActor(event.metadata)
  const { Icon, iconBg, iconColor, badgeClass, borderAccent, dotBg, label: catLabel } = cat
  return (
    <div className="flex gap-3 group">
      <div className="flex shrink-0 flex-col items-center" style={{ width: 36 }}>
        <div className={`relative z-10 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white dark:border-gray-900 shadow-sm ${iconBg} transition-transform duration-150 group-hover:scale-105`}>
          <Icon size={15} className={iconColor} />
        </div>
        {!isLast && (
          <div className={`mt-1 w-0.5 flex-1 ${dotBg} opacity-20`} style={{ minHeight: 24 }} />
        )}
      </div>
      <div className={`min-w-0 flex-1 rounded-xl border border-gray-100 dark:border-gray-700/60 border-l-2 ${borderAccent} bg-white dark:bg-gray-800/60 px-3.5 py-3 shadow-sm hover:shadow-md transition-shadow ${isLast ? 'mb-0.5' : 'mb-3'}`}>
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{event.title}</p>
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}>{catLabel}</span>
        </div>
        {event.description && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{event.description}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 tabular-nums">{fmtDateTime(event.event_timestamp)}</span>
          {actor && (
            <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-gray-700/60 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300">
              <User size={9} />{actor}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Timeline skeleton ─────────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div>
      {[65, 80, 55, 70].map((w, i) => (
        <div key={i} className="flex gap-3 mb-3">
          <div className="flex shrink-0 flex-col items-center" style={{ width: 36 }}>
            <div className="mt-0.5 h-9 w-9 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
            {i < 3 && <div className="mt-1 w-0.5 flex-1 bg-gray-200 dark:bg-gray-700" style={{ minHeight: 40 }} />}
          </div>
          <div className="flex-1 rounded-xl border border-gray-100 dark:border-gray-700/60 border-l-2 border-l-gray-200 bg-white dark:bg-gray-800/60 px-3.5 py-3 shadow-sm space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="h-3.5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" style={{ width: `${w}%` }} />
              <div className="h-4 w-20 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="h-2.5 w-4/5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-2 w-1/4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Health panel ──────────────────────────────────────────────────────────────

function HealthRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 dark:border-gray-700/60 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`text-sm font-semibold ${valueClass ?? 'text-gray-900 dark:text-white'}`}>{value}</span>
    </div>
  )
}

function HealthPanel({
  order, qcResults, events, sales, capaCount, recallCount,
}: {
  order:       TraceOrder
  qcResults:   TraceQc[]
  events:      JourneyEvent[]
  sales:       TraceSale[]
  capaCount:   number
  recallCount: number
}) {
  const completion = computeCompletion(events, order, sales.length)
  const latestQc   = qcResults[0] ?? null
  const openIssues = qcResults.filter(r => r.status === 'fail').length
  const stageLabel = ORDER_LABEL[order.status] ?? order.status.replace(/_/g, ' ')
  const qcLabel    = latestQc ? QC_LABEL[latestQc.status] : 'No inspections'
  const qcTextCls  = latestQc ? QC_TEXT[latestQc.status] : 'text-gray-400 dark:text-gray-500'

  return (
    <div className="space-y-4">
      {/* Completion */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Journey Completion</span>
          <span className="text-lg font-bold text-gray-900 dark:text-white">{completion}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${completion === 100 ? 'bg-emerald-500' : completion >= 50 ? 'bg-blue-500' : 'bg-amber-400'}`}
            style={{ width: `${completion}%` }}
          />
        </div>
        {completion === 100 && (
          <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={11} />Complete lifecycle recorded
          </p>
        )}
      </div>

      {/* Health rows */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Journey Health</p>
        <HealthRow label="Current Stage"  value={stageLabel} />
        <HealthRow label="Quality Status" value={qcLabel} valueClass={qcTextCls} />
        <HealthRow
          label="Open Issues"
          value={openIssues > 0 ? `${openIssues} failed QC` : 'None'}
          valueClass={openIssues > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}
        />
        <HealthRow
          label="CAPAs Linked"
          value={String(capaCount)}
          valueClass={capaCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}
        />
        <HealthRow
          label="Recalls Linked"
          value={String(recallCount)}
          valueClass={recallCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}
        />
      </div>

      {/* Navigate */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Navigate To</p>
        <div className="space-y-0.5">
          {[
            { label: 'Production Orders',  href: '/production',      icon: ClipboardList },
            { label: 'Quality Control',    href: '/quality-control', icon: ShieldCheck   },
            { label: 'CAPA Center',        href: '/capa',            icon: FileWarning   },
            { label: 'Recall Center',      href: '/recall',          icon: AlertTriangle },
          ].map(({ label, href, icon: Icon }) => (
            <a key={href} href={href}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/40 hover:text-gray-900 dark:hover:text-white transition-colors group">
              <span className="flex items-center gap-2"><Icon size={13} className="shrink-0" />{label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Batch header ──────────────────────────────────────────────────────────────

function BatchHeader({ order, qcResults, materials, sales }: {
  order: TraceOrder; qcResults: TraceQc[]; materials: TraceMaterial[]; sales: TraceSale[]
}) {
  const latestQc = qcResults[0] ?? null
  return (
    <div className="mb-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{order.product_name}</h2>
          <p className="mt-0.5 font-mono text-xs text-gray-400 dark:text-gray-500">SKU: {order.sku}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${ORDER_BADGE[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {ORDER_LABEL[order.status] ?? order.status.replace(/_/g, ' ')}
          </span>
          {latestQc && (
            <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${QC_BADGE[latestQc.status]}`}>
              {QC_LABEL[latestQc.status]}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { icon: Calendar,    label: 'Production Date', value: fmtDate(order.created_at) },
          { icon: Hash,        label: 'Batch Quantity',  value: `${order.quantity.toLocaleString()} units` },
          { icon: Layers,      label: 'Raw Materials',   value: String(materials.length) },
          { icon: Truck,       label: 'Distribution',    value: `${sales.length} ${sales.length === 1 ? 'shipment' : 'shipments'}` },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl bg-gray-50 dark:bg-gray-700/40 px-3 py-2.5">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
              <Icon size={9} />{label}
            </p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/40 px-3 py-2">
        <Hash size={11} className="shrink-0 text-gray-400" />
        <span className="text-[10px] text-gray-400 mr-1.5">Batch Reference</span>
        <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400 break-all">···{order.id.slice(-16)}</span>
      </div>
    </div>
  )
}

// ── Traceability summary ──────────────────────────────────────────────────────

function TraceabilitySummary({ qcResults, materials, sales, events }: {
  qcResults: TraceQc[]; materials: TraceMaterial[]; sales: TraceSale[]; events: JourneyEvent[]
}) {
  const groups = new Set(events.map(e => classifyEvent(e.event_type).stageGroup))
  const items = [
    { icon: Layers,      label: 'Raw Materials',  value: materials.length,  color: 'text-orange-600 dark:text-orange-400' },
    { icon: ShieldCheck, label: 'QC Inspections', value: qcResults.length,  color: 'text-emerald-600 dark:text-emerald-400' },
    { icon: Truck,       label: 'Distributions',  value: sales.length,      color: 'text-teal-600 dark:text-teal-400' },
    { icon: Activity,    label: 'Journey Events', value: events.length,     color: 'text-blue-600 dark:text-blue-400' },
    { icon: GitBranch,   label: 'Stages Covered', value: groups.size,       color: 'text-violet-600 dark:text-violet-400' },
  ] as const
  return (
    <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-5">
      {items.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-center shadow-sm">
          <div className="flex justify-center mb-1"><Icon size={14} className={color} /></div>
          <p className={`text-xl font-bold leading-tight ${color}`}>{value}</p>
          <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">{label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProductJourneyDetailClient() {
  const { id } = useParams<{ id: string }>()

  const [traceData,   setTraceData]   = useState<TraceData | null>(null)
  const [journey,     setJourney]     = useState<JourneyEvent[]>([])
  const [loading,     setLoading]     = useState(true)
  const [notFound,    setNotFound]    = useState(false)
  const [capaCount,   setCapaCount]   = useState(0)
  const [recallCount, setRecallCount] = useState(0)

  useEffect(() => {
    if (!id) return
    setLoading(true)

    Promise.all([
      supabase.rpc('get_batch_trace',   { p_batch_id: id }).single(),
      supabase.rpc('get_batch_journey', { p_batch_id: id }).single(),
      supabase.from('capas').select('id', { count: 'exact', head: true }).eq('batch_id', id),
      supabase.from('recalls').select('id', { count: 'exact', head: true }).eq('batch_id', id),
    ]).then(([traceRes, journeyRes, capaRes, recallRes]) => {
      if (traceRes.error || !traceRes.data) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setTraceData(traceRes.data as TraceData)

      const jd = journeyRes.data as { timeline?: JourneyEvent[] } | null
      if (jd?.timeline && Array.isArray(jd.timeline)) {
        const sorted = [...jd.timeline].sort(
          (a, b) => new Date(a.event_timestamp).getTime() - new Date(b.event_timestamp).getTime(),
        )
        setJourney(sorted)
      }

      setCapaCount(capaRes.count ?? 0)
      setRecallCount(recallRes.count ?? 0)
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <div className="px-6 py-5">
        <div className="mb-5 flex items-center gap-2">
          <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-4">
            {[120, 80, 400].map((h, i) => (
              <div key={i} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse" style={{ height: h }} />
            ))}
          </div>
          <div className="lg:col-span-4 space-y-4">
            {[100, 200, 180].map((h, i) => (
              <div key={i} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse" style={{ height: h }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (notFound || !traceData) {
    return (
      <div className="px-6 py-5">
        <Link href="/product-journey"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          <ChevronLeft size={15} />Traceability Search
        </Link>
        <div className="flex flex-col items-center py-20 text-center">
          <Package size={40} className="mb-3 text-gray-200 dark:text-gray-700" />
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Batch not found</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            This batch ID may be invalid or the record has been removed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-5">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <Link href="/product-journey"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-[#3a6f8f] dark:hover:text-[#7ab3d0] transition-colors">
          <ChevronLeft size={15} />Traceability Search
        </Link>
        <span className="font-mono text-xs text-gray-400 dark:text-gray-500">···{id.slice(-12)}</span>
      </div>

      {/* Page title */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Product Journey</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          End-to-end traceability for <span className="font-medium text-gray-700 dark:text-gray-300">{traceData.order.product_name}</span>
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: main content */}
        <div className="lg:col-span-8">
          <BatchHeader
            order={traceData.order}
            qcResults={traceData.qc_results}
            materials={traceData.materials}
            sales={traceData.sales}
          />
          <TraceabilitySummary
            qcResults={traceData.qc_results}
            materials={traceData.materials}
            sales={traceData.sales}
            events={journey}
          />

          {/* Timeline */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 border-b border-gray-100 dark:border-gray-700 px-4 py-3">
              <Activity size={15} className="text-gray-400 dark:text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Product Journey Timeline</h2>
              {journey.length > 0 && (
                <span className="ml-auto rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {journey.length} events
                </span>
              )}
            </div>
            <div className="px-4 py-4">
              {journey.length === 0 ? (
                <div className="py-8 text-center">
                  <Activity size={32} className="mx-auto mb-3 text-gray-200 dark:text-gray-700" />
                  <p className="text-sm text-gray-400 dark:text-gray-500">No journey events recorded for this batch.</p>
                  <p className="mt-1 text-xs text-gray-300 dark:text-gray-600">
                    Events appear as production, QC, and distribution activities are recorded.
                  </p>
                </div>
              ) : (
                <>
                  <StageFlow events={journey} />
                  {journey.map((event, i) => (
                    <TimelineEvent
                      key={`${event.event_type}-${event.event_timestamp}-${i}`}
                      event={event}
                      isLast={i === journey.length - 1}
                    />
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: health panel */}
        <div className="lg:col-span-4">
          <HealthPanel
            order={traceData.order}
            qcResults={traceData.qc_results}
            events={journey}
            sales={traceData.sales}
            capaCount={capaCount}
            recallCount={recallCount}
          />
        </div>
      </div>
    </div>
  )
}
