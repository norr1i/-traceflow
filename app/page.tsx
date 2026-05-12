'use client'

import { useState, useEffect } from 'react'
import { getDashboardStats } from './lib/dashboard'
import StatCard from './components/StatCard'
import SectionCard from './components/SectionCard'
import ProductionChart from './components/charts/ProductionChart'
import SalesChart from './components/charts/SalesChart'
import {
  Package, ClipboardList, DollarSign, ShieldCheck, AlertTriangle,
} from 'lucide-react'

type Stats = Awaited<ReturnType<typeof getDashboardStats>>

const EMPTY_STATS: Stats = {
  totalProducts: 0,
  totalOrders: 0,
  totalRevenue: 0,
  ordersByStatus: { pending: 0, in_progress: 0, completed: 0, cancelled: 0 },
  lowStockMaterials: [],
  recentSales: [],
  recentQc: [],
  qcPassRate: null,
}

function DashboardSkeleton() {
  return (
    <div className="px-4 sm:px-6 py-8 max-w-7xl mx-auto space-y-8">
      <div className="space-y-1.5">
        <div className="h-7 w-36 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-64 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
      </div>
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
        ))}
      </section>
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
        <div className="h-64 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
      </section>
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-48 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
        <div className="h-48 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
      </section>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats]   = useState<Stats>(EMPTY_STATS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const fmtUSD = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  if (loading) return <DashboardSkeleton />

  return (
    <div className="px-4 sm:px-6 py-8 max-w-7xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Welcome back — here&apos;s what&apos;s happening today.
        </p>
      </div>

      {/* KPI cards */}
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          title="Total Products"
          value={stats.totalProducts}
          subtitle="in catalog"
          accent="blue"
          icon={Package}
        />
        <StatCard
          title="Production Orders"
          value={stats.totalOrders}
          subtitle={`${stats.ordersByStatus.in_progress} in progress`}
          accent="purple"
          icon={ClipboardList}
        />
        <StatCard
          title="Total Revenue"
          value={fmtUSD(stats.totalRevenue)}
          subtitle="all time"
          accent="green"
          icon={DollarSign}
        />
        <StatCard
          title="QC Pass Rate"
          value={stats.qcPassRate !== null ? `${stats.qcPassRate}%` : '—'}
          subtitle="last 5 inspections"
          accent={stats.qcPassRate === null ? 'blue' : stats.qcPassRate >= 80 ? 'green' : 'red'}
          icon={ShieldCheck}
        />
      </section>

      {/* Low-stock alert */}
      {stats.lowStockMaterials.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-5 py-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {stats.lowStockMaterials.length} material{stats.lowStockMaterials.length > 1 ? 's' : ''} at or below reorder level
            </p>
            <ul className="mt-1 space-y-0.5">
              {stats.lowStockMaterials.map((m, i) => (
                <li key={i} className="text-xs text-amber-700 dark:text-amber-400">
                  {m.name} — {m.quantity_in_stock} in stock (reorder at {m.reorder_level})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Charts */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Revenue Trend" subtitle="Last 30 sales">
          <SalesChart data={stats.recentSales} />
        </SectionCard>
        <SectionCard title="Orders by Status" subtitle="All production orders">
          <ProductionChart data={stats.ordersByStatus} />
        </SectionCard>
      </section>

      {/* Recent activity tables */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Recent Sales */}
        <SectionCard title="Recent Sales">
          {stats.recentSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
              <DollarSign size={32} className="mb-2 opacity-40" />
              <p className="text-sm">No sales recorded yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-left">
                  <th className="pb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="pb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Qty</th>
                  <th className="pb-2 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentSales.slice(0, 5).map((sale) => (
                  <tr key={sale.id} className="border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                    <td className="py-2.5 text-gray-600 dark:text-gray-400">
                      {new Date(sale.sold_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-2.5 text-gray-800 dark:text-gray-300">{sale.quantity}</td>
                    <td className="py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      {fmtUSD(sale.total_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        {/* Recent QC */}
        <SectionCard title="Recent QC Results">
          {stats.recentQc.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
              <ShieldCheck size={32} className="mb-2 opacity-40" />
              <p className="text-sm">No QC records yet.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {stats.recentQc.map((qc) => (
                <li key={qc.id} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(qc.inspected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{qc.notes ?? 'No notes'}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    qc.passed
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {qc.passed ? 'Passed' : 'Failed'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

      </section>
    </div>
  )
}
