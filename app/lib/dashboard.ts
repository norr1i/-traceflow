import { supabase } from './supabase'

export async function getDashboardStats() {
  const [
    { count: totalProducts },
    { count: totalOrders },
    { data: orders },
    { data: materials },
    { data: recentSales },
    { data: recentQc },
    { data: allSales },
  ] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('production_orders').select('*', { count: 'exact', head: true }),
    supabase.from('production_orders').select('status'),
    supabase.from('raw_materials').select('name, quantity_in_stock, reorder_level'),
    supabase
      .from('sales')
      .select('id, quantity, total_price, sold_at')
      .order('sold_at', { ascending: false })
      .limit(30),
    supabase
      .from('qc_results')
      .select('id, passed, notes, inspected_at')
      .order('inspected_at', { ascending: false })
      .limit(5),
    supabase.from('sales').select('total_price'),
  ])

  const ordersByStatus = {
    pending:     orders?.filter((o) => o.status === 'pending').length     ?? 0,
    in_progress: orders?.filter((o) => o.status === 'in_progress').length ?? 0,
    completed:   orders?.filter((o) => o.status === 'completed').length   ?? 0,
    cancelled:   orders?.filter((o) => o.status === 'cancelled').length   ?? 0,
  }

  const lowStockMaterials =
    materials?.filter((m) => m.quantity_in_stock <= m.reorder_level) ?? []

  const totalRevenue =
    allSales?.reduce((sum, s) => sum + (s.total_price ?? 0), 0) ?? 0

  const qcPassRate = recentQc?.length
    ? Math.round((recentQc.filter((q) => q.passed).length / recentQc.length) * 100)
    : null

  return {
    totalProducts:      totalProducts ?? 0,
    totalOrders:        totalOrders   ?? 0,
    totalRevenue,
    ordersByStatus,
    lowStockMaterials,
    recentSales:        recentSales   ?? [],
    recentQc:           recentQc      ?? [],
    qcPassRate,
  }
}
