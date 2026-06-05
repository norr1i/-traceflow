'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import {
  ShieldCheck, Package, FlaskConical, Layers, ShoppingCart,
  AlertCircle, Loader2, QrCode,
  Activity, CheckCircle2, XCircle, Clock, Truck,
} from 'lucide-react'
import { LogoIcon } from '../../components/Logo'

// ── Types ──────────────────────────────────────────────────────────────────

type QcResult = {
  status: 'pass' | 'fail' | 'hold'
  inspector_name: string
  notes: string | null
  inspected_at: string
}

type Material = {
  material_name: string
  lot_number: string | null
  quantity: number
  unit: string
}

type Sale = {
  customer_name: string | null
  quantity: number
  sold_at: string
}

type TraceData = {
  order: {
    id: string
    product_name: string
    sku: string
    quantity: number
    status: string
    created_at: string
    started_at: string | null
    completed_at: string | null
  }
  qc_results: QcResult[]
  materials: Material[]
  sales: Sale[]
}

type JourneyEvent = {
  event_type: string
  event_timestamp: string
  title: string
  description: string | null
  source_table: string
  metadata: Record<string, unknown> | null
}

type JourneyData = {
  batch: Record<string, unknown>
  timeline: JourneyEvent[]
  event_count: number
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function getDotColor(eventType: string): string {
  if (eventType === 'production.completed')         return 'bg-emerald-500'
  if (eventType.startsWith('production.'))          return 'bg-blue-500'
  if (eventType.startsWith('material.'))            return 'bg-orange-400'
  if (eventType === 'qc.pass'      ||
      eventType === 'qc_inspection.passed')         return 'bg-emerald-500'
  if (eventType === 'qc.fail'      ||
      eventType === 'qc_inspection.failed')         return 'bg-red-500'
  if (eventType.startsWith('qc'))                  return 'bg-amber-400'
  if (eventType.startsWith('qr.'))                 return 'bg-purple-500'
  if (eventType.startsWith('distribution.'))       return 'bg-teal-500'
  if (eventType.startsWith('raw_material.'))       return 'bg-orange-400'
  if (eventType.startsWith('supplier.'))           return 'bg-sky-400'
  if (eventType === 'packaging.completed')          return 'bg-indigo-400'
  if (eventType === 'storage.entry')               return 'bg-slate-400'
  if (eventType === 'capa.created')                return 'bg-rose-400'
  return 'bg-gray-400'
}

function getSourceLabel(sourceTable: string): string {
  const labels: Record<string, string> = {
    production_orders:    'Production',
    bill_of_materials:    'Materials',
    batch_qc_results:     'QC',
    quality_inspections:  'QC Inspection',
    scan_events:          'QR Scan',
    distribution_records: 'Distribution',
    batch_journey_events: 'Journey',
  }
  return labels[sourceTable] ?? sourceTable
}

function getEventIcon(eventType: string) {
  if (eventType === 'production.completed' ||
      eventType === 'qc.pass' ||
      eventType === 'qc_inspection.passed')
    return <CheckCircle2 size={11} />
  if (eventType === 'qc.fail' ||
      eventType === 'qc_inspection.failed')
    return <XCircle size={11} />
  if (eventType.startsWith('qc'))
    return <Clock size={11} />
  if (eventType.startsWith('distribution.'))
    return <Truck size={11} />
  return null
}

type QcStatus = 'pass' | 'fail' | 'hold'
const qcBadgeClass: Record<QcStatus, string> = {
  pass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  fail: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  hold: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
}

const orderStatusClass: Record<string, string> = {
  completed:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  pending:     'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  cancelled:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

// ── Shared UI primitives ───────────────────────────────────────────────────

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${className}`}>
      {label}
    </span>
  )
}

function Section({ icon, title, count, children }: {
  icon: React.ReactNode; title: string; count?: number; children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-gray-100 dark:border-gray-700 px-4 py-3">
        <span className="text-gray-400 dark:text-gray-500">{icon}</span>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="ml-auto rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
            {count}
          </span>
        )}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-right font-medium text-gray-900 dark:text-white">{value ?? '—'}</span>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-gray-400 dark:text-gray-500 italic">{text}</p>
}

// ── Timeline event row ─────────────────────────────────────────────────────

function TimelineEvent({ event, isLast }: { event: JourneyEvent; isLast: boolean }) {
  const dotColor    = getDotColor(event.event_type)
  const sourceLabel = getSourceLabel(event.source_table)
  const statusIcon  = getEventIcon(event.event_type)

  return (
    <div className="flex gap-3">

      {/* Left column: dot + connector line */}
      <div className="flex flex-col items-center shrink-0" style={{ width: 10 }}>
        <span className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${dotColor} flex items-center justify-center`} />
        {!isLast && (
          <span className="mt-1 w-px grow bg-gray-200 dark:bg-gray-700" />
        )}
      </div>

      {/* Right column: content */}
      <div className={`min-w-0 flex-1 ${isLast ? 'pb-1' : 'pb-4'}`}>

        {/* Title row */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-snug">
          {statusIcon && (
            <span className={`shrink-0 ${
              event.event_type === 'production.completed' || event.event_type === 'qc.pass' || event.event_type === 'qc_inspection.passed'
                ? 'text-emerald-500' : event.event_type === 'qc.fail' || event.event_type === 'qc_inspection.failed'
                ? 'text-red-500' : 'text-amber-500'
            }`}>
              {statusIcon}
            </span>
          )}
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {event.title}
          </span>
          <span className="rounded bg-gray-100 dark:bg-gray-700/60 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 dark:text-gray-500 shrink-0">
            {sourceLabel}
          </span>
        </div>

        {/* Description */}
        {event.description && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            {event.description}
          </p>
        )}

        {/* Timestamp */}
        <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
          {fmtDateTime(event.event_timestamp)}
        </p>

      </div>
    </div>
  )
}

// ── Timeline skeleton ──────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="space-y-0" aria-busy="true" aria-label="Loading timeline">
      {[44, 56, 40].map((w, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center shrink-0" style={{ width: 10 }}>
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
            {i < 2 && <span className="mt-1 w-px flex-1 bg-gray-200 dark:bg-gray-700" style={{ minHeight: 40 }} />}
          </div>
          <div className={`flex-1 ${i < 2 ? 'pb-4' : 'pb-1'} space-y-1.5`}>
            <div className={`h-3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse`} style={{ width: `${w}%` }} />
            <div className="h-2.5 w-4/5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-2 w-1/4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Scan event logging ─────────────────────────────────────────────────────

function logScanEvent(batchId: string) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua)
  const browser =
    /Edg\//i.test(ua)    ? 'Edge'    :
    /OPR\//i.test(ua)    ? 'Opera'   :
    /Chrome\//i.test(ua) ? 'Chrome'  :
    /Safari\//i.test(ua) ? 'Safari'  :
    /Firefox\//i.test(ua)? 'Firefox' : 'Other'

  void supabase
    .from('scan_events')
    .insert({
      batch_id: batchId,
      scanned_at: new Date().toISOString(),
      device_type: isMobile ? 'mobile' : 'desktop',
      browser,
      user_agent: ua.slice(0, 300),
    })
    .then(({ error }) => {
      if (error) console.error('[logScanEvent] insert failed:', error)
    })
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function PublicTracePage() {
  const { id } = useParams<{ id: string }>()

  const [data,          setData]          = useState<TraceData | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [notFound,      setNotFound]      = useState(false)
  const [journey,       setJourney]       = useState<JourneyEvent[]>([])
  const [journeyLoading,setJourneyLoading] = useState(false)

  useEffect(() => {
    if (!id) return

    logScanEvent(id)
    setJourneyLoading(true)

    // Fetch batch trace and company_id in parallel. The journey RPC
    // requires company_id, which is not returned by get_batch_trace.
    // production_orders is accessible to the anon role via the
    // public_trace_orders policy, so this direct select works without auth.
    Promise.all([
      supabase.rpc('get_batch_trace', { p_batch_id: id }).single(),
      supabase.from('production_orders').select('company_id').eq('id', id).single(),
    ]).then(([traceRes, orderRes]) => {
      if (traceRes.error || !traceRes.data) {
        setNotFound(true)
        setLoading(false)
        setJourneyLoading(false)
        return
      }

      setData(traceRes.data as TraceData)
      setLoading(false)

      const cid = (orderRes.data as { company_id: string } | null)?.company_id
      if (!cid) { setJourneyLoading(false); return }

      // Sequential: journey RPC fires once company_id is confirmed.
      // Use .then() for both success and error — PostgrestBuilder is a
      // PromiseLike, not a native Promise, so .catch() is not available.
      supabase
        .rpc('get_batch_journey', { p_batch_id: id, p_company_id: cid })
        .single()
        .then(({ data: jd, error: je }) => {
          if (!je && jd) {
            const timeline = (jd as JourneyData).timeline
            if (Array.isArray(timeline)) setJourney(timeline)
          }
          setJourneyLoading(false)
        }, () => setJourneyLoading(false))
    })
  }, [id])

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 size={28} className="animate-spin text-blue-600" />
      </div>
    )
  }

  // ── Not found ────────────────────────────────────────────────────────────

  if (notFound || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-6 text-center">
        <AlertCircle size={44} className="mb-3 text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Batch not found</p>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">This QR code may be invalid or the batch has been removed.</p>
        <div className="mt-6 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-600">
          <ShieldCheck size={13} />
          <span>Verified by TraceFlow</span>
        </div>
      </div>
    )
  }

  const { order, qc_results, materials, sales } = data
  const latestQc = qc_results[0]

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">

      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm px-4 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <LogoIcon size="sm" />
            <div>
              <p className="text-xs font-bold text-gray-900 dark:text-white leading-tight">{order.product_name}</p>
              <p className="font-mono text-[10px] text-gray-400 leading-tight">{order.sku}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge
              label={order.status.replace('_', ' ')}
              className={orderStatusClass[order.status] ?? 'bg-gray-100 text-gray-600'}
            />
            {latestQc && (
              <Badge label={latestQc.status} className={qcBadgeClass[latestQc.status]} />
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-md px-4 py-5 space-y-4">

        {/* Verified badge */}
        <div className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2.5">
          <ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Verified by TraceFlow — authentic product batch record
          </span>
        </div>

        {/* Batch overview */}
        <Section icon={<Package size={15} />} title="Batch Overview">
          <Row label="Product"   value={order.product_name} />
          <Row label="SKU"       value={<span className="font-mono text-xs">{order.sku}</span>} />
          <Row label="Quantity"  value={order.quantity.toLocaleString()} />
          <Row label="Status"    value={
            <Badge
              label={order.status.replace('_', ' ')}
              className={orderStatusClass[order.status] ?? 'bg-gray-100 text-gray-600'}
            />
          } />
          <Row label="Created"   value={fmt(order.created_at)} />
          {order.started_at   && <Row label="Started"   value={fmt(order.started_at)} />}
          {order.completed_at && <Row label="Completed" value={fmt(order.completed_at)} />}
          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/40 px-3 py-2">
            <QrCode size={12} className="shrink-0 text-gray-400" />
            <span className="font-mono text-[10px] text-gray-400 break-all">{order.id}</span>
          </div>
        </Section>

        {/* QC Inspections */}
        <Section icon={<FlaskConical size={15} />} title="QC Inspections" count={qc_results.length}>
          {qc_results.length === 0 && <Empty text="No QC inspections recorded for this batch." />}
          {qc_results.length > 0 && (
            <div className="space-y-2">
              {qc_results.map((r, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/20 px-3 py-2.5">
                  <Badge label={r.status} className={`mt-0.5 shrink-0 ${qcBadgeClass[r.status]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.inspector_name}</span>
                      <span className="shrink-0 text-[10px] text-gray-400">{fmtDateTime(r.inspected_at)}</span>
                    </div>
                    {r.notes && (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{r.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Raw materials */}
        <Section icon={<Layers size={15} />} title="Raw Materials Used" count={materials.length}>
          {materials.length === 0 && <Empty text="No materials linked to this batch." />}
          {materials.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-400">
                  <th className="pb-2 text-left font-medium">Material</th>
                  <th className="pb-2 text-left font-medium">Lot #</th>
                  <th className="pb-2 text-right font-medium">Qty</th>
                  <th className="pb-2 text-right font-medium">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {materials.map((m, i) => (
                  <tr key={i}>
                    <td className="py-2 font-medium text-gray-900 dark:text-white">{m.material_name}</td>
                    <td className="py-2 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {m.lot_number || <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="py-2 text-right text-gray-700 dark:text-gray-300">{m.quantity.toLocaleString()}</td>
                    <td className="py-2 text-right text-gray-500 dark:text-gray-400">{m.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Distribution */}
        <Section icon={<ShoppingCart size={15} />} title="Distribution" count={sales.length}>
          {sales.length === 0 && <Empty text="No distribution records for this product." />}
          {sales.length > 0 && (
            <div className="space-y-2">
              {sales.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{s.customer_name || 'Customer'}</p>
                    <p className="text-xs text-gray-400">{fmt(s.sold_at)}</p>
                  </div>
                  <span className="shrink-0 text-gray-700 dark:text-gray-300 font-medium">
                    {s.quantity.toLocaleString()} units
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Product Journey Timeline */}
        <Section
          icon={<Activity size={15} />}
          title="Product Journey"
          count={journey.length}
        >
          {journeyLoading ? (
            <TimelineSkeleton />
          ) : journey.length === 0 ? (
            <Empty text="No journey events recorded for this batch." />
          ) : (
            <div className="pt-0.5">
              {journey.map((event, i) => (
                <TimelineEvent
                  key={`${event.event_type}-${event.event_timestamp}-${i}`}
                  event={event}
                  isLast={i === journey.length - 1}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Footer */}
        <div className="pb-4 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-600">
            <ShieldCheck size={12} />
            <span>Verified by TraceFlow · Powered by traceflow.app</span>
          </div>
        </div>

      </div>
    </div>
  )
}
