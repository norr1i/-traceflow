'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { ProductionOrder } from '../types/traceflow'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmDialog'
import { Plus, Pencil, Trash2, X, Check, AlertTriangle, ClipboardList } from 'lucide-react'

type OrderWithProduct = ProductionOrder & { products?: { name: string } | null }
type SimpleProduct = { id: string; name: string }

const empty = { product_id: '', quantity: 1, status: 'pending' as ProductionOrder['status'] }
const statuses: ProductionOrder['status'][] = ['pending', 'in_progress', 'completed', 'cancelled']

export default function ProductionClient() {
  const toast   = useToast()
  const confirm = useConfirm()

  const [orders, setOrders]       = useState<OrderWithProduct[]>([])
  const [products, setProducts]   = useState<SimpleProduct[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState<OrderWithProduct | null>(null)
  const [form, setForm]           = useState(empty)
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('production_orders').select('*, products(name)').order('created_at', { ascending: false }),
      supabase.from('products').select('id, name'),
    ]).then(([{ data: orderData }, { data: productData }]) => {
      setOrders(orderData ?? [])
      setProducts(productData ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>
    )
  }

  function openCreate() {
    setEditing(null)
    setForm({ ...empty, product_id: products[0]?.id ?? '' })
    setFormError(null); setShowForm(true)
  }

  function openEdit(o: OrderWithProduct) {
    setEditing(o)
    setForm({ product_id: o.product_id, quantity: o.quantity, status: o.status })
    setFormError(null); setShowForm(true)
  }

  function closeForm() {
    setShowForm(false); setFormError(null)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setFormError(null)
    const payload = {
      product_id: form.product_id,
      quantity: Number(form.quantity),
      status: form.status,
    }

    if (editing) {
      const { data, error: err } = await supabase
        .from('production_orders').update(payload).eq('id', editing.id)
        .select('*, products(name)').single()
      if (err) {
        setFormError(err.message)
        toast.error('Failed to update order')
        setSaving(false)
        return
      }
      setOrders((prev) => prev.map((o) => (o.id === editing.id ? data : o)))
      toast.success('Order updated')
    } else {
      const { data, error: err } = await supabase
        .from('production_orders').insert([payload])
        .select('*, products(name)').single()
      if (err) {
        setFormError(err.message)
        toast.error('Failed to create order')
        setSaving(false)
        return
      }
      setOrders((prev) => [data, ...prev])
      toast.success('Order created')
    }

    setSaving(false); setShowForm(false)
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: 'Delete production order?',
      message: 'This action cannot be undone.',
      confirmLabel: 'Delete',
    })
    if (!ok) return

    const { error: err } = await supabase.from('production_orders').delete().eq('id', id)
    if (err) {
      toast.error(err.message)
      return
    }
    setOrders((prev) => prev.filter((o) => o.id !== id))
    toast.success('Order deleted')
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {orders.length} order{orders.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> New Order
        </button>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editing ? 'Edit Order' : 'New Production Order'}
              </h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Product</label>
                <select
                  required
                  value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Quantity</label>
                <input
                  required
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as ProductionOrder['status'] })}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              {formError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                  <AlertTriangle size={14} className="shrink-0" />
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  <Check size={15} /> {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <ClipboardList size={40} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">No production orders yet</p>
            <p className="mt-1 text-xs">Create your first order to start tracking production.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Product</th>
                <th className="px-4 py-3 text-left font-medium">Quantity</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Created</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{o.products?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{o.quantity}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 text-gray-400 dark:text-gray-500 hidden sm:table-cell">
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(o)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(o.id)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
