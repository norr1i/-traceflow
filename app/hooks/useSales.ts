// src/hooks/useSales.ts
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface SaleRecord {
  id: string
  product_id?: string
  product_name?: string
  quantity: number
  unit_price?: number
  total_price: number
  customer_name?: string
  status?: string
  sold_at: string
}

export type SaleFormData = {
  product_name: string
  customer_name: string
  quantity: number
  unit_price: number
  total_price: number
  status: string
}

export interface SalesMetrics {
  total_revenue: number
  total_orders: number
  avg_order_value: number
  top_product?: string
}

function deriveMetrics(rows: SaleRecord[]): SalesMetrics {
  if (rows.length === 0) return { total_revenue: 0, total_orders: 0, avg_order_value: 0 }
  const total_revenue = rows.reduce((sum, r) => sum + (r.total_price ?? 0), 0)
  const total_orders = rows.length
  const avg_order_value = total_revenue / total_orders
  const byProduct: Record<string, number> = {}
  rows.forEach((r) => {
    const key = r.product_name ?? r.product_id ?? 'Unknown'
    byProduct[key] = (byProduct[key] ?? 0) + (r.total_price ?? 0)
  })
  const top_product = Object.entries(byProduct).sort((a, b) => b[1] - a[1])[0]?.[0]
  return { total_revenue, total_orders, avg_order_value, top_product }
}

function extractMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message
  return (err as { message?: string })?.message ?? fallback
}

export function useSales() {
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [metrics, setMetrics] = useState<SalesMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSales = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('sales')
        .select('*')
        .order('sold_at', { ascending: false })

      if (fetchError) throw fetchError

      const rows: SaleRecord[] = data ?? []
      setSales(rows)
      setMetrics(deriveMetrics(rows))
    } catch (err) {
      setError(extractMessage(err, 'Failed to fetch sales'))
    } finally {
      setLoading(false)
    }
  }, [])

  const createSale = async (data: SaleFormData): Promise<SaleRecord | null> => {
    try {
      const { data: newSale, error: insertError } = await supabase
        .from('sales')
        .insert([{ ...data, sold_at: new Date().toISOString() }])
        .select()
        .single()

      if (insertError) throw insertError

      setSales((prev) => {
        const next = [newSale, ...prev]
        setMetrics(deriveMetrics(next))
        return next
      })
      return newSale
    } catch (err) {
      setError(extractMessage(err, 'Failed to create sale'))
      return null
    }
  }

  const deleteSale = async (id: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase.from('sales').delete().eq('id', id)
      if (deleteError) throw deleteError

      setSales((prev) => {
        const next = prev.filter((s) => s.id !== id)
        setMetrics(deriveMetrics(next))
        return next
      })
      return true
    } catch (err) {
      setError(extractMessage(err, 'Failed to delete sale'))
      return false
    }
  }

  useEffect(() => {
    supabase
      .from('sales')
      .select('*')
      .order('sold_at', { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError(fetchError.message)
        } else {
          const rows: SaleRecord[] = data ?? []
          setSales(rows)
          setMetrics(deriveMetrics(rows))
        }
        setLoading(false)
      })
  }, [])

  return { sales, metrics, loading, error, refetch: fetchSales, createSale, deleteSale }
}
