import { supabase } from './supabase'

// ── Date helpers ────────────────────────────────────────────────────────────

function toDay(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function lastNDays(n: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    )
  }
  return out
}

function shortDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
}

// ── Main fetch ──────────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoIso = sevenDaysAgo.toISOString()

  const [
    { data: batches },
    { data: qcResults },
    { data: topScans },         // last 500 batch_ids for mostScanned ranking
    { count: totalScans },
    { data: salesProducts },
    { data: recentScanList },   // last 12 with device info for the events feed
    { data: trend7DayScans },   // all scans in last 7 days for the trend chart
  ] = await Promise.all([
    supabase
      .from('production_orders')
      .select('id, status, product_id, created_at, products(name, sku)'),
    supabase
      .from('batch_qc_results')
      .select('batch_id, status, inspector_name, notes, inspected_at')
      .order('inspected_at', { ascending: false }),
    supabase
      .from('scan_events')
      .select('batch_id')
      .order('scanned_at', { ascending: false })
      .limit(500),
    supabase.from('scan_events').select('*', { count: 'exact', head: true }),
    supabase.from('sales').select('product_id'),
    supabase
      .from('scan_events')
      .select('batch_id, scanned_at, device_type, browser')
      .order('scanned_at', { ascending: false })
      .limit(12),
    supabase
      .from('scan_events')
      .select('batch_id, scanned_at')
      .gte('scanned_at', sevenDaysAgoIso),
  ])

  type BatchRow = {
    id: string
    status: string
    product_id: string
    created_at: string
    products: { name: string; sku: string } | null
  }

  const batchList = (batches ?? []) as unknown as BatchRow[]
  const qcList    = qcResults ?? []
  const scanTop   = topScans  ?? []
  const scanRecent = recentScanList ?? []
  const scanTrend7 = trend7DayScans ?? []

  // ── QC counts ───────────────────────────────────────────────────────────
  const qcCounts = {
    pass: qcList.filter(q => q.status === 'pass').length,
    fail: qcList.filter(q => q.status === 'fail').length,
    hold: qcList.filter(q => q.status === 'hold').length,
  }

  const totalQc = qcCounts.pass + qcCounts.fail + qcCounts.hold
  const passRate = totalQc > 0 ? Math.round((qcCounts.pass / totalQc) * 100) : null

  // ── Batch / QC maps ──────────────────────────────────────────────────────
  const batchMap = new Map<string, BatchRow>(batchList.map(b => [b.id, b]))

  const latestQcMap = new Map<string, typeof qcList[0]>()
  for (const q of qcList) {
    if (!latestQcMap.has(q.batch_id)) latestQcMap.set(q.batch_id, q)
  }

  // ── Recall risk ──────────────────────────────────────────────────────────
  const batchesWithQc       = new Set(qcList.map(q => q.batch_id))
  const productIdsWithSales = new Set((salesProducts ?? []).map(s => s.product_id as string))

  const failedBatchIds = batchList
    .filter(b => latestQcMap.get(b.id)?.status === 'fail')
    .map(b => b.id)
  const failedBatchSet = new Set(failedBatchIds)

  const failedWithSalesCount = batchList.filter(
    b => failedBatchSet.has(b.id) && productIdsWithSales.has(b.product_id)
  ).length
  const missingQcCount = batchList.filter(b => !batchesWithQc.has(b.id)).length

  // ── Failed QC batches (for table) ────────────────────────────────────────
  const failedBatches = batchList
    .filter(b => failedBatchSet.has(b.id))
    .slice(0, 10)
    .map(b => ({
      id:           b.id,
      batch_status: b.status,
      product_id:   b.product_id,
      product_name: b.products?.name ?? 'Unknown',
      sku:          b.products?.sku  ?? '',
      created_at:   b.created_at,
      has_sales:    productIdsWithSales.has(b.product_id),
      latest_qc:    latestQcMap.get(b.id)!,
    }))

  // ── Recent QC inspections (with product context) ─────────────────────────
  const recentQc = qcList.slice(0, 10).map(q => {
    const b = batchMap.get(q.batch_id)
    return {
      batch_id:       q.batch_id,
      status:         q.status as 'pass' | 'fail' | 'hold',
      inspector_name: q.inspector_name,
      notes:          q.notes as string | null,
      inspected_at:   q.inspected_at,
      product_name:   b?.products?.name ?? 'Unknown',
      sku:            b?.products?.sku  ?? '',
    }
  })

  // ── Most scanned batches ─────────────────────────────────────────────────
  const scanCountMap = new Map<string, number>()
  for (const s of scanTop) {
    scanCountMap.set(s.batch_id, (scanCountMap.get(s.batch_id) ?? 0) + 1)
  }
  const mostScanned = [...scanCountMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([batchId, count]) => {
      const b = batchMap.get(batchId)
      return {
        batch_id:     batchId,
        scan_count:   count,
        product_name: b?.products?.name ?? 'Unknown batch',
        sku:          b?.products?.sku  ?? '',
        batch_status: b?.status ?? '',
      }
    })

  // ── Recent scan events (for the feed) ───────────────────────────────────
  const recentScans = scanRecent.map(s => {
    const b = batchMap.get(s.batch_id)
    return {
      batch_id:     s.batch_id,
      scanned_at:   s.scanned_at,
      device_type:  s.device_type as string | null,
      browser:      s.browser as string | null,
      product_name: b?.products?.name ?? 'Unknown batch',
    }
  })

  // ── Production orders by status ──────────────────────────────────────────
  const ordersByStatus = {
    pending:     batchList.filter(b => b.status === 'pending').length,
    in_progress: batchList.filter(b => b.status === 'in_progress').length,
    completed:   batchList.filter(b => b.status === 'completed').length,
    cancelled:   batchList.filter(b => b.status === 'cancelled').length,
  }

  // ── QC trend (last 7 days) ───────────────────────────────────────────────
  const days7 = lastNDays(7)
  const qcTrend = days7.map(dateStr => ({
    date:  dateStr,
    label: shortDayLabel(dateStr),
    pass:  qcList.filter(q => toDay(q.inspected_at) === dateStr && q.status === 'pass').length,
    fail:  qcList.filter(q => toDay(q.inspected_at) === dateStr && q.status === 'fail').length,
    hold:  qcList.filter(q => toDay(q.inspected_at) === dateStr && q.status === 'hold').length,
  }))

  // ── Scan activity trend (last 7 days) ────────────────────────────────────
  const scanTrend = days7.map(dateStr => {
    const dayScans = scanTrend7.filter(s => toDay(s.scanned_at) === dateStr)
    return {
      date:          dateStr,
      label:         shortDayLabel(dateStr),
      scans:         dayScans.length,
      uniqueBatches: new Set(dayScans.map(s => s.batch_id)).size,
    }
  })

  // ── Weekly inspections count ─────────────────────────────────────────────
  const weeklyInspections = qcList.filter(q => toDay(q.inspected_at) >= days7[0]).length

  return {
    totalBatches: batchList.length,
    totalScans:   totalScans ?? 0,
    passRate,
    weeklyInspections,
    qcCounts,
    ordersByStatus,
    qcTrend,
    scanTrend,
    recentQc,
    failedBatches,
    mostScanned,
    recentScans,
    recallRisk: {
      failedQcCount:   failedBatchIds.length,
      failedWithSales: failedWithSalesCount,
      missingQcCount,
    },
  }
}

export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>
