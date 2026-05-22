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

// ── Row types ────────────────────────────────────────────────────────────────

export type BatchRow = {
  id: string
  status: string
  product_id: string
  quantity: number
  created_at: string
  products: { name: string; sku: string } | null
}

export type RawMaterialRow = {
  id: string
  name: string
  unit: string
  quantity_in_stock: number
  reorder_level: number
}

export type SaleRow = {
  id: string
  product_id: string
  product_name: string | null
  quantity: number
  unit_price: number
  total_price: number
  customer_name: string | null
  status: string
  sold_at: string
  created_at: string
}

export type ActivityLogRow = {
  id:          string
  action_type: string
  entity_type: string
  entity_id:   string | null
  message:     string
  actor_email: string | null
  metadata:    Record<string, unknown> | null
  created_at:  string
}

export type TopProduct = {
  product_id: string
  product_name: string
  units_sold: number
  revenue: number
}

// ── Main fetch ───────────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoIso = sevenDaysAgo.toISOString()

  const [
    { data: batches },
    { data: qcResults },
    { data: topScans },
    { count: totalScans },
    { data: salesProducts },
    { data: recentScanList },
    { data: trend7DayScans },
    { data: inventoryData },
    { data: allSalesData },
    { data: activityData },
  ] = await Promise.all([
    supabase
      .from('production_orders')
      .select('id, status, product_id, quantity, created_at, products(name, sku)')
      .order('created_at', { ascending: false }),
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
    supabase
      .from('raw_materials')
      .select('id, name, unit, quantity_in_stock, reorder_level')
      .order('quantity_in_stock', { ascending: true }),
    supabase
      .from('sales')
      .select('id, product_id, product_name, quantity, unit_price, total_price, customer_name, status, sold_at, created_at')
      .order('sold_at', { ascending: false }),
    supabase
      .from('activity_logs')
      .select('id, action_type, entity_type, entity_id, message, actor_email, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const batchList   = (batches    ?? []) as unknown as BatchRow[]
  const qcList      = qcResults  ?? []
  const scanTop     = topScans       ?? []
  const scanRecent  = recentScanList ?? []
  const scanTrend7  = trend7DayScans ?? []
  // numeric columns (quantity_in_stock, reorder_level) come from Postgres as strings via Supabase
  const rawMaterials = ((inventoryData ?? []) as unknown as RawMaterialRow[]).map(m => ({
    ...m,
    quantity_in_stock: Number(m.quantity_in_stock),
    reorder_level:     Number(m.reorder_level),
  }))
  const salesList    = (allSalesData  ?? []) as unknown as SaleRow[]
  const activityFeed = (activityData  ?? []) as unknown as ActivityLogRow[]

  // ── QC counts ───────────────────────────────────────────────────────────
  const qcCounts = {
    pass: qcList.filter(q => q.status === 'pass').length,
    fail: qcList.filter(q => q.status === 'fail').length,
    hold: qcList.filter(q => q.status === 'hold').length,
  }
  const totalQc  = qcCounts.pass + qcCounts.fail + qcCounts.hold
  const passRate = totalQc > 0 ? Math.round((qcCounts.pass / totalQc) * 100) : null

  // ── Batch / QC maps ──────────────────────────────────────────────────────
  const batchMap     = new Map<string, BatchRow>(batchList.map(b => [b.id, b]))
  const latestQcMap  = new Map<string, typeof qcList[0]>()
  for (const q of qcList) {
    if (!latestQcMap.has(q.batch_id)) latestQcMap.set(q.batch_id, q)
  }

  // ── Recall risk ──────────────────────────────────────────────────────────
  const batchesWithQc       = new Set(qcList.map(q => q.batch_id))
  const productIdsWithSales = new Set((salesProducts ?? []).map(s => s.product_id as string))
  const failedBatchIds      = batchList.filter(b => latestQcMap.get(b.id)?.status === 'fail').map(b => b.id)
  const failedBatchSet      = new Set(failedBatchIds)
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

  // ── Recent QC inspections ────────────────────────────────────────────────
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

  // ── Recent scan events ───────────────────────────────────────────────────
  const recentScans = scanRecent.map(s => {
    const b = batchMap.get(s.batch_id)
    return {
      batch_id:     s.batch_id,
      scanned_at:   s.scanned_at,
      device_type:  s.device_type as string | null,
      browser:      s.browser     as string | null,
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

  // ── Trend data ───────────────────────────────────────────────────────────
  const days7 = lastNDays(7)

  const qcTrend = days7.map(dateStr => ({
    date:  dateStr,
    label: shortDayLabel(dateStr),
    pass:  qcList.filter(q => toDay(q.inspected_at) === dateStr && q.status === 'pass').length,
    fail:  qcList.filter(q => toDay(q.inspected_at) === dateStr && q.status === 'fail').length,
    hold:  qcList.filter(q => toDay(q.inspected_at) === dateStr && q.status === 'hold').length,
  }))

  const scanTrend = days7.map(dateStr => {
    const dayScans = scanTrend7.filter(s => toDay(s.scanned_at) === dateStr)
    return {
      date:          dateStr,
      label:         shortDayLabel(dateStr),
      scans:         dayScans.length,
      uniqueBatches: new Set(dayScans.map(s => s.batch_id)).size,
    }
  })

  const weeklyInspections = qcList.filter(q => toDay(q.inspected_at) >= days7[0]).length
  const ordersThisWeek    = batchList.filter(b => toDay(b.created_at) >= days7[0]).length

  // ── Inventory ────────────────────────────────────────────────────────────
  const lowStockCount = rawMaterials.filter(
    m => isFinite(m.quantity_in_stock) && isFinite(m.reorder_level) && m.quantity_in_stock <= m.reorder_level
  ).length

  const inProgressOrders = batchList.filter(b => b.status === 'in_progress').slice(0, 8)

  // ── Sales aggregates ─────────────────────────────────────────────────────
  const completedSales     = salesList.filter(s => s.status === 'completed')
  const totalSalesRevenue  = Math.round(completedSales.reduce((sum, s) => sum + (Number(s.total_price) || 0), 0))
  const totalSalesCount    = salesList.length

  const productRevenueMap  = new Map<string, { product_name: string; units_sold: number; revenue: number }>()
  for (const s of completedSales) {
    const entry = productRevenueMap.get(s.product_id) ?? { product_name: s.product_name ?? s.product_id, units_sold: 0, revenue: 0 }
    entry.units_sold += Number(s.quantity) || 0
    entry.revenue    += Number(s.total_price) || 0
    productRevenueMap.set(s.product_id, entry)
  }
  const topProducts: TopProduct[] = [...productRevenueMap.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 6)
    .map(([product_id, d]) => ({ product_id, ...d }))

  return {
    // Core production
    totalBatches: batchList.length,
    totalScans:   totalScans ?? 0,
    passRate,
    weeklyInspections,
    qcCounts,
    ordersByStatus,
    ordersThisWeek,
    // Trend
    qcTrend,
    scanTrend,
    // Lists
    recentQc,
    failedBatches,
    mostScanned,
    recentScans,
    recallRisk: {
      failedQcCount:   failedBatchIds.length,
      failedWithSales: failedWithSalesCount,
      missingQcCount,
    },
    // Operations
    recentOrders: batchList.slice(0, 10),
    // Inventory (warehouse)
    rawMaterials,
    lowStockCount,
    inProgressOrders,
    // Sales
    recentSales:       salesList.slice(0, 15),
    totalSalesRevenue,
    totalSalesCount,
    topProducts,
    // Activity feed
    activityFeed,
  }
}

export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>
