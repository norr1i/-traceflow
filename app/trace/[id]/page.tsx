'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import StatusBadge from '../../components/StatusBadge'
import {
  ArrowLeft, Package, FlaskConical, Layers, ShoppingCart,
  AlertCircle, Loader2, QrCode,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type TraceOrder = {
  id: string
  product_id: string
  quantity: number
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  started_at?: string | null
  completed_at?: string | null
  created_at: string
  products: { name: string; sku: string; description?: string | null } | null
}

type BatchQcResult = {
  id: string
  status: 'pass' | 'fail' | 'hold'
  inspector_name: string
  notes?: string | null
  inspected_at: string
}

type BomRow = {
  id: string
  material_name: string
  lot_number?: string | null
  quantity: number
  unit: string
}

type SaleRow = {
  id: string
  quantity: number
  unit_price?: number | null
  total_price: number
  customer_name?: string | null
  status?: string | null
  sold_at: string
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

type QcStatus = 'pass' | 'fail' | 'hold'
const qcBadgeClass: Record<QcStatus, string> = {
  pass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  fail: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  hold: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
}

function QcBadge({ status }: { status: QcStatus }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${qcBadgeClass[status]}`}>
      {status}
    </span>
  )
}

function SectionCard({ icon, title, children, count }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; count?: number
}) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-gray-100 dark:border-gray-700 px-5 py-3.5">
        <span className="text-gray-400 dark:text-gray-500">{icon}</span>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="ml-auto rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
            {count}
          </span>
        )}
      </div>
      <div className="px-5 py-4">{children}</div>
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

// ── Page ───────────────────────────────────────────────────────────────────

export default function TracePage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [order,      setOrder]      = useState<TraceOrder | null>(null)
  const [qcResults,  setQcResults]  = useState<BatchQcResult[]>([])
  const [materials,  setMaterials]  = useState<BomRow[]>([])
  const [sales,      setSales]      = useState<SaleRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [notFound,   setNotFound]   = useState(false)

  useEffect(() => {
    if (!id) return
    async function load() {
      const { data: orderData } = await supabase
        .from('production_orders')
        .select('*, products(name, sku, description)')
        .eq('id', id)
        .single()

      if (!orderData) { setNotFound(true); setLoading(false); return }
      setOrder(orderData as TraceOrder)

      const [
        { data: qcData },
        { data: bomData },
        { data: salesData },
      ] = await Promise.all([
        supabase.from('batch_qc_results').select('*').eq('batch_id', id).order('inspected_at', { ascending: false }),
        supabase.from('bill_of_materials').select('*').eq('production_order_id', id).order('created_at'),
        supabase.from('sales').select('*').eq('product_id', orderData.product_id).order('sold_at', { ascending: false }).limit(10),
      ])

      setQcResults(qcData ?? [])
      setMaterials(bomData ?? [])
      setSales(salesData ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  // ── Loading / not found ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={24} className="animate-spin text-blue-600" />
      </div>
    )
  }

  if (notFound || !order) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
        <AlertCircle size={40} className="mb-3 text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Batch not found</p>
        <p className="mt-1 text-xs text-gray-400">This QR code may be invalid or you may not have access.</p>
        <button onClick={() => router.back()} className="mt-4 text-xs text-blue-600 hover:underline">Go back</button>
      </div>
    )
  }

  // ── Derive latest QC status for summary pill ────────────────────────────
  const latestQc = qcResults[0]

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">

      {/* Header */}
      <div className="mb-6">
        <button onClick={() => router.push('/production')}
          className="mb-4 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
          <ArrowLeft size={13} /> Production orders
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                <QrCode size={16} />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Batch Trace Report</h1>
            </div>
            <p className="font-mono text-xs text-gray-400">{order.id}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge status={order.status} />
            {latestQc && <QcBadge status={latestQc.status} />}
          </div>
        </div>
      </div>

      <div className="space-y-4">

        {/* Production order */}
        <SectionCard icon={<Package size={15} />} title="Production Order">
          <Row label="Product"  value={order.products?.name} />
          <Row label="SKU"      value={order.products?.sku} />
          <Row label="Quantity" value={order.quantity.toLocaleString()} />
          <Row label="Status"   value={<StatusBadge status={order.status} />} />
          <Row label="Created"  value={fmt(order.created_at)} />
          {order.started_at   && <Row label="Started"   value={fmt(order.started_at)} />}
          {order.completed_at && <Row label="Completed" value={fmt(order.completed_at)} />}
          {order.products?.description && (
            <div className="mt-2 rounded-lg bg-gray-50 dark:bg-gray-700/40 px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
              {order.products.description}
            </div>
          )}
        </SectionCard>

        {/* QC inspections */}
        <SectionCard icon={<FlaskConical size={15} />} title="QC Inspections" count={qcResults.length}>
          {qcResults.length === 0 && <Empty text="No QC inspections recorded for this batch." />}

          {qcResults.length > 0 && (
            <div className="space-y-2">
              {qcResults.map((r) => (
                <div key={r.id} className="flex items-start gap-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/20 px-4 py-3">
                  <QcBadge status={r.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{r.inspector_name}</span>
                      <span className="shrink-0 text-xs text-gray-400">{fmtDateTime(r.inspected_at)}</span>
                    </div>
                    {r.notes && (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{r.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Raw materials */}
        <SectionCard icon={<Layers size={15} />} title="Raw Materials Used" count={materials.length}>
          {materials.length === 0 && <Empty text="No materials linked to this batch." />}
          {materials.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500">
                  <th className="pb-2 text-left font-medium">Material</th>
                  <th className="pb-2 text-left font-medium">Lot #</th>
                  <th className="pb-2 text-right font-medium">Qty</th>
                  <th className="pb-2 text-right font-medium">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {materials.map((m) => (
                  <tr key={m.id}>
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
        </SectionCard>

        {/* Sales */}
        <SectionCard icon={<ShoppingCart size={15} />} title="Sales / Distribution" count={sales.length}>
          {sales.length === 0 && <Empty text="No sales records linked to this product." />}
          {sales.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 dark:text-gray-500">
                  <th className="pb-2 text-left font-medium">Customer</th>
                  <th className="pb-2 text-left font-medium">Date</th>
                  <th className="pb-2 text-right font-medium">Qty</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td className="py-1.5 text-gray-700 dark:text-gray-300">{s.customer_name || '—'}</td>
                    <td className="py-1.5 text-gray-500 dark:text-gray-400">{fmt(s.sold_at)}</td>
                    <td className="py-1.5 text-right text-gray-900 dark:text-white">{s.quantity.toLocaleString()}</td>
                    <td className="py-1.5 text-right font-medium text-gray-900 dark:text-white">
                      ${s.total_price.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

      </div>
    </div>
  )
}
