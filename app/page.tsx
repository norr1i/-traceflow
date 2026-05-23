'use client'

import { useState, useEffect, useCallback } from 'react'
import { getDashboardStats, type DashboardStats } from './lib/dashboard'
import SectionCard from './components/SectionCard'
import StatCard from './components/StatCard'
import ProductionChart from './components/charts/ProductionChart'
import QcTrendChart from './components/charts/QcTrendChart'
import ScanActivityChart from './components/charts/ScanActivityChart'
import SalesChart from './components/charts/SalesChart'
import { useRole } from './lib/auth-context'
import { canView } from './lib/permissions'
import { ACTION_TYPES_BY_SECTION } from './lib/activity'
import {
  ClipboardList, QrCode, AlertTriangle, FlaskConical,
  Smartphone, Monitor, CheckCircle2, Clock, ShieldCheck,
  XCircle, RefreshCw, LayoutDashboard, Calendar,
  TrendingUp, ShoppingCart, Boxes, Package, AlertCircle,
} from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtRevenue(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M SAR`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K SAR`
  return `${n.toLocaleString()} SAR`
}

// ── Status components ──────────────────────────────────────────────────────

type QcStatus = 'pass' | 'fail' | 'hold'

function QcBadge({ status }: { status: QcStatus }) {
  const cfg: Record<QcStatus, string> = {
    pass: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-500/20',
    fail: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-500/20',
    hold: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-500/20',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${cfg[status]}`}>
      {status}
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    completed:   'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-500/20',
    in_progress: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-500/20',
    pending:     'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-500/20',
    cancelled:   'bg-gray-50 dark:bg-white/[0.05] text-gray-500 dark:text-gray-400 ring-1 ring-gray-200 dark:ring-white/[0.07]',
    refunded:    'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-500/20',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${cfg[status] ?? cfg.pending}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

// ── QC breakdown bar ───────────────────────────────────────────────────────

function QcBar({ pass, fail, hold }: { pass: number; fail: number; hold: number }) {
  const total = pass + fail + hold
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-[#525563]">
        <FlaskConical size={22} strokeWidth={1.5} className="opacity-40" />
        <p className="text-sm">No QC inspections recorded yet.</p>
      </div>
    )
  }
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`
  return (
    <div className="space-y-5">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.05]">
        {pass > 0 && <div style={{ width: pct(pass) }} className="bg-emerald-500 transition-all duration-700" />}
        {fail > 0 && <div style={{ width: pct(fail) }} className="bg-red-500 transition-all duration-700" />}
        {hold > 0 && <div style={{ width: pct(hold) }} className="bg-amber-400 transition-all duration-700" />}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            { label: 'Pass', value: pass, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/8 dark:bg-emerald-500/10', dot: 'bg-emerald-500' },
            { label: 'Fail', value: fail, color: 'text-red-600 dark:text-red-400',         bg: 'bg-red-500/8 dark:bg-red-500/10',         dot: 'bg-red-500'     },
            { label: 'Hold', value: hold, color: 'text-amber-600 dark:text-amber-400',      bg: 'bg-amber-500/8 dark:bg-amber-500/10',      dot: 'bg-amber-400'   },
          ] as const
        ).map(({ label, value, color, bg, dot }) => (
          <div key={label} className={`rounded-xl ${bg} px-3 py-3 text-center`}>
            <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
            <div className="mt-1.5 flex items-center justify-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
              <span className="text-[11px] text-gray-500 dark:text-[#525563]">{label} · {pct(value)}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-[#525563]">{total.toLocaleString()} total inspections</p>
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function SkeletonBlock({ h, className = '' }: { h: string; className?: string }) {
  return <div className={`${h} animate-pulse rounded-2xl bg-gray-200 dark:bg-white/[0.05] ${className}`} />
}

function Skeleton() {
  return (
    <div className="px-6 py-10 max-w-screen-xl mx-auto space-y-8">
      <div className="flex items-center justify-between pb-6 border-b border-gray-100 dark:border-white/[0.06]">
        <div className="space-y-2">
          <SkeletonBlock h="h-6" className="w-40" />
          <SkeletonBlock h="h-4" className="w-28" />
        </div>
        <SkeletonBlock h="h-8" className="w-20" />
      </div>
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} h="h-32" />)}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SkeletonBlock h="h-72" />
        <SkeletonBlock h="h-72" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SkeletonBlock h="h-64" />
        <SkeletonBlock h="h-64" />
      </div>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 py-12 text-[#525563]">
      <Icon size={22} strokeWidth={1.5} className="opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

// ── Activity timeline ──────────────────────────────────────────────────────

function ActivityTimeline({ entries }: { entries: DashboardStats['activityFeed'] }) {
  return (
    <div className="relative pl-6">
      <div className="absolute left-[7px] top-1.5 h-[calc(100%-12px)] w-px bg-gray-100 dark:bg-white/[0.06]" />
      <ul className="space-y-5">
        {entries.map((entry) => (
          <li key={entry.id} className="relative">
            <span className="absolute -left-6 top-1 flex h-3 w-3 items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-[#4a8fb9]/40 ring-2 ring-[#4a8fb9]/20" />
            </span>
            <p className="text-[13px] leading-snug text-gray-800 dark:text-[#C9C7C4]">
              {entry.message}
            </p>
            <p className="mt-0.5 text-[11px] text-gray-400 dark:text-[#525563]">
              {entry.actor_email ?? 'System'} · {timeAgo(entry.created_at)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const role = useRole()

  const showProduction = canView(role, 'dashboard.production')
  const showQuality    = canView(role, 'dashboard.quality')
  const showTracing    = canView(role, 'dashboard.tracing')
  const showInventory  = canView(role, 'dashboard.inventory')
  const showSales      = canView(role, 'dashboard.sales')

  const hasAnySections = showProduction || showQuality || showTracing || showInventory || showSales

  const [stats,       setStats]       = useState<DashboardStats | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    try {
      const data = await getDashboardStats()
      setStats(data)
      setLastUpdated(new Date())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), 30_000)
    return () => clearInterval(interval)
  }, [load])

  if (loading) return <Skeleton />
  if (!stats)  return null

  const {
    totalBatches, totalScans, passRate, weeklyInspections,
    qcCounts, ordersByStatus, ordersThisWeek,
    qcTrend, scanTrend,
    recentQc, failedBatches, mostScanned, recentScans, recallRisk,
    recentOrders,
    rawMaterials, lowStockCount, inProgressOrders,
    recentSales, totalSalesRevenue, totalSalesCount, topProducts,
    activityFeed,
  } = stats

  const maxScanCount      = mostScanned[0]?.scan_count ?? 1
  const maxProductRevenue = topProducts[0]?.revenue ?? 1
  const hasRisk = recallRisk.failedQcCount > 0 || recallRisk.missingQcCount > 0

  const passRateAccent = passRate === null ? 'blue'
    : passRate >= 80 ? 'green'
    : passRate >= 60 ? 'yellow'
    : 'red'

  // ── Role-smart KPI cards ─────────────────────────────────────────────────
  const kpiCards: React.ReactNode[] = (() => {
    if (showProduction && showQuality) {
      return [
        <StatCard key="batches"  title="Total Batches"  value={totalBatches}  subtitle={`${ordersByStatus.in_progress} in progress`}      accent="blue"         icon={ClipboardList}  />,
        <StatCard key="passrate" title="QC Pass Rate"   value={passRate !== null ? `${passRate}%` : '—'} subtitle={`${qcCounts.pass + qcCounts.fail + qcCounts.hold} total inspections`} accent={passRateAccent} icon={passRate !== null && passRate >= 80 ? CheckCircle2 : passRate !== null && passRate < 60 ? XCircle : ShieldCheck} />,
        <StatCard key="scans"    title="QR Scans"       value={totalScans.toLocaleString()}              subtitle="all-time trace events"  accent="purple"       icon={QrCode}         />,
        <StatCard key="weekly"   title="This Week"      value={weeklyInspections}                        subtitle="QC inspections last 7d" accent={weeklyInspections > 0 ? 'orange' : 'yellow'} icon={FlaskConical} />,
      ]
    }
    if (showQuality && !showProduction) {
      return [
        <StatCard key="passrate" title="QC Pass Rate" value={passRate !== null ? `${passRate}%` : '—'} subtitle={`${qcCounts.pass + qcCounts.fail + qcCounts.hold} total inspections`} accent={passRateAccent} icon={passRate !== null && passRate >= 80 ? CheckCircle2 : passRate !== null && passRate < 60 ? XCircle : ShieldCheck} />,
        <StatCard key="failed"   title="Failed"       value={qcCounts.fail}    subtitle="batches with QC fail"      accent="red"    icon={XCircle}      />,
        <StatCard key="hold"     title="On Hold"      value={qcCounts.hold}    subtitle="pending re-inspection"     accent="yellow" icon={Clock}        />,
        <StatCard key="weekly"   title="This Week"    value={weeklyInspections} subtitle="inspections last 7 days"  accent={weeklyInspections > 0 ? 'orange' : 'yellow'} icon={FlaskConical} />,
      ]
    }
    if (showProduction && showTracing && !showInventory && !showSales) {
      return [
        <StatCard key="batches"    title="Total Batches" value={totalBatches}               subtitle={`${ordersByStatus.completed} completed`}      accent="blue"   icon={ClipboardList} />,
        <StatCard key="inprogress" title="In Progress"   value={ordersByStatus.in_progress} subtitle="active production orders"                     accent="orange" icon={Clock}         />,
        <StatCard key="thisweek"   title="This Week"     value={ordersThisWeek}             subtitle="orders created last 7 days"                   accent="green"  icon={Calendar}      />,
        <StatCard key="scans"      title="QR Scans"      value={totalScans.toLocaleString()} subtitle="all-time trace events"                       accent="purple" icon={QrCode}        />,
      ]
    }
    if (showInventory && !showQuality) {
      return [
        <StatCard key="materials" title="Raw Materials" value={rawMaterials.length}         subtitle="tracked inventory items"                        accent="green"                                 icon={Boxes}                                                  />,
        <StatCard key="lowstock"  title="Low Stock"     value={lowStockCount}               subtitle={lowStockCount > 0 ? 'at or below reorder level' : 'all items stocked'} accent={lowStockCount > 0 ? 'red' : 'green'} icon={lowStockCount > 0 ? AlertTriangle : CheckCircle2} />,
        <StatCard key="active"    title="Active Orders" value={ordersByStatus.in_progress}  subtitle="production orders using materials"              accent="orange"                                icon={ClipboardList}                                          />,
        <StatCard key="batches"   title="Total Batches" value={totalBatches}                subtitle={`${ordersByStatus.completed} completed`}        accent="blue"                                  icon={Package}                                                />,
      ]
    }
    if (showSales && !showQuality) {
      return [
        <StatCard key="salescount" title="Total Sales"    value={totalSalesCount}             subtitle="all-time orders"                                                      accent="purple"                                          icon={ShoppingCart}                                    />,
        <StatCard key="salesrev"   title="Revenue"        value={fmtRevenue(totalSalesRevenue)} subtitle="from completed sales"                                               accent="green"                                           icon={TrendingUp}                                      />,
        <StatCard key="recall"     title="Recall Risk"    value={recallRisk.failedQcCount}    subtitle={recallRisk.failedWithSales > 0 ? `${recallRisk.failedWithSales} distributed` : 'failed QC batches'} accent={recallRisk.failedQcCount > 0 ? 'red' : 'green'} icon={recallRisk.failedQcCount > 0 ? AlertTriangle : CheckCircle2} />,
        <StatCard key="products"   title="Products Sold"  value={topProducts.length}          subtitle="distinct products with sales"                                         accent="blue"                                            icon={Package}                                         />,
      ]
    }
    return []
  })()

  return (
    <div className="px-6 py-10 max-w-screen-xl mx-auto space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 pb-6 border-b border-gray-100 dark:border-white/[0.06]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-[#E2E8F0]">
            Dashboard
          </h1>
          <p className="mt-0.5 text-sm text-gray-400 dark:text-[#525563]">
            {lastUpdated ? `Updated ${timeAgo(lastUpdated.toISOString())}` : 'Live manufacturing overview'}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Live</span>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-gray-600 dark:text-[#6B7280] hover:bg-gray-50 dark:hover:bg-white/[0.06] disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── No-section fallback ────────────────────────────────────────────── */}
      {!hasAnySections && (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-gray-50 dark:bg-white/[0.02] text-[#525563]">
          <LayoutDashboard size={24} strokeWidth={1.5} className="opacity-40" />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600 dark:text-[#6B7280]">No dashboard sections available for your role.</p>
            <p className="mt-0.5 text-xs">Use the sidebar to navigate to your module.</p>
          </div>
        </div>
      )}

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      {kpiCards.length > 0 && (
        <section className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {kpiCards}
        </section>
      )}

      {/* ── Recall risk banner ─────────────────────────────────────────────── */}
      {showProduction && hasRisk && (
        <div className="flex items-start gap-4 rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/[0.06] px-5 py-4">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500 dark:text-red-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">Recall Risk Detected</p>
            <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {recallRisk.failedQcCount > 0 && (
                <span className="text-red-600 dark:text-red-400 text-xs">
                  <span className="font-semibold">{recallRisk.failedQcCount}</span> batch{recallRisk.failedQcCount !== 1 ? 'es' : ''} with failed QC
                </span>
              )}
              {recallRisk.failedWithSales > 0 && (
                <span className="font-semibold text-red-700 dark:text-red-300 text-xs">
                  {recallRisk.failedWithSales} distributed to customers
                </span>
              )}
              {recallRisk.missingQcCount > 0 && (
                <span className="text-amber-700 dark:text-amber-400 text-xs">
                  <span className="font-semibold">{recallRisk.missingQcCount}</span> batch{recallRisk.missingQcCount !== 1 ? 'es' : ''} missing inspection
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Trend charts ───────────────────────────────────────────────────── */}
      {(showQuality || showTracing) && (
        <section className={`grid grid-cols-1 gap-5 ${showQuality && showTracing ? 'lg:grid-cols-2' : ''}`}>
          {showQuality && (
            <SectionCard title="QC Trend — Last 7 Days" subtitle="Daily pass / fail / hold counts">
              <QcTrendChart data={qcTrend} />
            </SectionCard>
          )}
          {showTracing && (
            <SectionCard title="QR Scan Activity — Last 7 Days" subtitle="Daily product trace volume">
              <ScanActivityChart data={scanTrend} />
            </SectionCard>
          )}
        </section>
      )}

      {/* ── Production pipeline + QC breakdown ────────────────────────────── */}
      {(showProduction || showQuality) && (
        <section className={`grid grid-cols-1 gap-5 ${showProduction && showQuality ? 'lg:grid-cols-2' : ''}`}>
          {showProduction && (
            <SectionCard title="Production Pipeline" subtitle="Orders by current status">
              <ProductionChart data={ordersByStatus} />
            </SectionCard>
          )}
          {showQuality && (
            <SectionCard title="QC Inspection Results" subtitle="Cumulative pass / fail / hold breakdown">
              <QcBar pass={qcCounts.pass} fail={qcCounts.fail} hold={qcCounts.hold} />
            </SectionCard>
          )}
        </section>
      )}

      {/* ── Recent QC + Most scanned ───────────────────────────────────────── */}
      {(showQuality || showTracing) && (
        <section className={`grid grid-cols-1 gap-5 ${showQuality && showTracing ? 'lg:grid-cols-2' : ''}`}>
          {showQuality && (
            <SectionCard title="Recent QC Inspections" subtitle="Latest across all batches">
              {recentQc.length === 0 ? (
                <EmptyState icon={FlaskConical} message="No inspections recorded yet." />
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {recentQc.map((q, i) => (
                    <li key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${
                        q.status === 'pass' ? 'bg-emerald-500' : q.status === 'fail' ? 'bg-red-500' : 'bg-amber-400'
                      }`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-gray-900 dark:text-[#E2E8F0] truncate">{q.product_name}</span>
                          <QcBadge status={q.status} />
                        </div>
                        <p className="mt-0.5 text-[11px] text-[#525563]">{q.inspector_name} · {fmt(q.inspected_at)}</p>
                        {q.notes && <p className="mt-0.5 text-[11px] text-gray-500 dark:text-[#4B5563] truncate">{q.notes}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          )}
          {showTracing && (
            <SectionCard title="Most Scanned Batches" subtitle="By QR scan event count">
              {mostScanned.length === 0 ? (
                <EmptyState icon={QrCode} message="No scan events recorded yet." />
              ) : (
                <ul className="space-y-4">
                  {mostScanned.map((b, i) => (
                    <li key={b.batch_id}>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-md bg-gray-100 dark:bg-white/[0.06] text-[10px] font-bold text-gray-400">{i + 1}</span>
                          <span className="text-[13px] font-medium text-gray-900 dark:text-[#E2E8F0] truncate">{b.product_name}</span>
                          {b.sku && <span className="shrink-0 font-mono text-[11px] text-[#525563]">{b.sku}</span>}
                        </div>
                        <span className="shrink-0 text-[13px] font-semibold text-[#4a8fb9]">{b.scan_count}</span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.05]">
                        <div
                          className="h-full rounded-full bg-[#4a8fb9]/60 transition-all duration-700"
                          style={{ width: `${(b.scan_count / maxScanCount) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          )}
        </section>
      )}

      {/* ── Failed QC + Recent scans ───────────────────────────────────────── */}
      {(showProduction || showTracing) && (
        <section className={`grid grid-cols-1 gap-5 ${showProduction && showTracing ? 'lg:grid-cols-2' : ''}`}>
          {showProduction && (
            <SectionCard title="Batches with Failed QC" subtitle="Latest QC status = fail">
              {failedBatches.length === 0 ? (
                <EmptyState icon={CheckCircle2} message="No failed batches — all clear." />
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {failedBatches.map(b => (
                    <li key={b.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-medium text-gray-900 dark:text-[#E2E8F0]">{b.product_name}</span>
                          <span className="font-mono text-[11px] text-[#525563]">{b.sku}</span>
                          {b.has_sales && (
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-500/20">
                              Distributed
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-[#525563]">
                          {b.latest_qc.inspector_name} · {fmt(b.latest_qc.inspected_at)}
                        </p>
                        {b.latest_qc.notes && (
                          <p className="mt-0.5 text-[11px] text-[#4B5563] truncate">{b.latest_qc.notes}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          )}
          {showTracing && (
            <SectionCard title="Recent Scan Events" subtitle="Latest QR code traces">
              {recentScans.length === 0 ? (
                <EmptyState icon={QrCode} message="No scan events recorded yet." />
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {recentScans.map((s, i) => (
                    <li key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-white/[0.05] text-gray-400 dark:text-[#525563]">
                        {s.device_type === 'mobile' ? <Smartphone size={13} /> : <Monitor size={13} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-gray-900 dark:text-[#E2E8F0] truncate">{s.product_name}</p>
                        <p className="text-[11px] text-[#525563]">{s.browser ?? 'Browser'} · {s.device_type ?? 'device'}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 text-[11px] text-[#525563]">
                        <Clock size={10} />
                        {timeAgo(s.scanned_at)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          )}
        </section>
      )}

      {/* ── Operations: recent production orders ───────────────────────────── */}
      {showProduction && showTracing && !showQuality && (
        <section>
          <SectionCard title="Recent Production Orders" subtitle="Last 10 orders across all statuses">
            {recentOrders.length === 0 ? (
              <EmptyState icon={ClipboardList} message="No production orders found." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-white/[0.05] text-[11px] font-semibold uppercase tracking-wider text-[#525563]">
                      <th className="pb-3 text-left">Product</th>
                      <th className="pb-3 text-left hidden sm:table-cell">SKU</th>
                      <th className="pb-3 text-right">Qty</th>
                      <th className="pb-3 text-center">Status</th>
                      <th className="pb-3 text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-white/[0.04]">
                    {recentOrders.map(b => (
                      <tr key={b.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                        <td className="py-2.5 pr-3 text-[13px] font-medium text-gray-900 dark:text-[#E2E8F0]">
                          <span className="truncate block max-w-[200px]">{b.products?.name ?? 'Unknown'}</span>
                        </td>
                        <td className="py-2.5 hidden sm:table-cell font-mono text-[11px] text-[#525563]">{b.products?.sku ?? '—'}</td>
                        <td className="py-2.5 text-right tabular-nums text-[13px] text-gray-700 dark:text-[#A8B3C0]">{b.quantity.toLocaleString()}</td>
                        <td className="py-2.5 text-center"><StatusPill status={b.status} /></td>
                        <td className="py-2.5 text-right text-[11px] text-[#525563]">{fmt(b.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </section>
      )}

      {/* ── Warehouse: inventory + production demand ───────────────────────── */}
      {showInventory && !showQuality && !showTracing && (
        <>
          {lowStockCount > 0 && (
            <div className="flex items-start gap-4 rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/[0.06] px-5 py-4">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                  {lowStockCount} material{lowStockCount !== 1 ? 's' : ''} at or below reorder level
                </p>
                <p className="mt-0.5 text-xs text-amber-700/70 dark:text-amber-400/60">
                  Review inventory below and raise purchase orders as needed.
                </p>
              </div>
            </div>
          )}

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <SectionCard title="Inventory Status" subtitle="Current stock vs. reorder points">
              {rawMaterials.length === 0 ? (
                <EmptyState icon={Boxes} message="No raw materials on record." />
              ) : (
                <ul className="space-y-4">
                  {rawMaterials.slice(0, 10).map(mat => {
                    const isLow = mat.quantity_in_stock <= mat.reorder_level
                    const maxLevel = mat.reorder_level * 3
                    const pct = maxLevel > 0 ? Math.min(100, Math.round((mat.quantity_in_stock / maxLevel) * 100)) : 100
                    return (
                      <li key={mat.id} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-gray-900 dark:text-[#E2E8F0] truncate">{mat.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[12px] font-semibold tabular-nums ${isLow ? 'text-red-500' : 'text-emerald-500'}`}>
                              {mat.quantity_in_stock.toLocaleString()} {mat.unit}
                            </span>
                            {isLow && (
                              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-500/20">
                                Low
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.05]">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${isLow ? 'bg-red-500' : 'bg-emerald-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-[#525563]">Reorder at {mat.reorder_level.toLocaleString()} {mat.unit}</p>
                      </li>
                    )
                  })}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Production Demand" subtitle="Active orders consuming materials">
              {inProgressOrders.length === 0 ? (
                <EmptyState icon={ClipboardList} message="No active production orders." />
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {inProgressOrders.map(b => (
                    <li key={b.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-gray-900 dark:text-[#E2E8F0] truncate">
                          {b.products?.name ?? 'Unknown product'}
                        </p>
                        <p className="text-[11px] text-[#525563]">
                          {b.products?.sku ?? '—'} · Qty: {b.quantity.toLocaleString()}
                        </p>
                      </div>
                      <StatusPill status="in_progress" />
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </section>
        </>
      )}

      {/* ── Sales: revenue + top products + recent orders ──────────────────── */}
      {showSales && !showQuality && !showTracing && (
        <>
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <SectionCard title="Revenue Trend" subtitle="Sales value — most recent orders">
              <SalesChart data={recentSales} />
            </SectionCard>

            <SectionCard title="Top Products by Revenue" subtitle="Completed sales only">
              {topProducts.length === 0 ? (
                <EmptyState icon={Package} message="No completed sales recorded yet." />
              ) : (
                <ul className="space-y-4">
                  {topProducts.map((p, i) => (
                    <li key={p.product_id}>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-md bg-gray-100 dark:bg-white/[0.06] text-[10px] font-bold text-gray-400">{i + 1}</span>
                          <span className="text-[13px] font-medium text-gray-900 dark:text-[#E2E8F0] truncate">{p.product_name}</span>
                        </div>
                        <span className="shrink-0 text-[13px] font-semibold text-violet-600 dark:text-violet-400">
                          {fmtRevenue(p.revenue)}
                        </span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.05]">
                        <div
                          className="h-full rounded-full bg-violet-500/60 transition-all duration-700"
                          style={{ width: `${(p.revenue / maxProductRevenue) * 100}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-[#525563]">{p.units_sold.toLocaleString()} units sold</p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </section>

          <section>
            <SectionCard title="Recent Sales" subtitle="Last 15 orders across all statuses">
              {recentSales.length === 0 ? (
                <EmptyState icon={ShoppingCart} message="No sales recorded yet." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-white/[0.05] text-[11px] font-semibold uppercase tracking-wider text-[#525563]">
                        <th className="pb-3 text-left">Product</th>
                        <th className="pb-3 text-right">Qty</th>
                        <th className="pb-3 text-right">Total</th>
                        <th className="pb-3 text-left hidden sm:table-cell">Customer</th>
                        <th className="pb-3 text-center">Status</th>
                        <th className="pb-3 text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-white/[0.04]">
                      {recentSales.map((s, i) => (
                        <tr key={i} className="transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                          <td className="py-2.5 pr-3">
                            <p className="text-[13px] font-medium text-gray-900 dark:text-[#E2E8F0] truncate max-w-[160px]">{s.product_name}</p>
                          </td>
                          <td className="py-2.5 text-right tabular-nums text-[13px] text-gray-600 dark:text-[#A8B3C0]">{Number(s.quantity).toLocaleString()}</td>
                          <td className="py-2.5 text-right tabular-nums text-[13px] font-medium text-gray-900 dark:text-[#E2E8F0]">
                            {Number(s.total_price).toLocaleString()} SAR
                          </td>
                          <td className="py-2.5 hidden sm:table-cell">
                            <p className="truncate max-w-[130px] text-[11px] text-[#525563]">{s.customer_name || '—'}</p>
                          </td>
                          <td className="py-2.5 text-center"><StatusPill status={s.status} /></td>
                          <td className="py-2.5 text-right text-[11px] text-[#525563]">{fmt(s.sold_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </section>
        </>
      )}

      {/* ── Activity feed ──────────────────────────────────────────────────── */}
      {(() => {
        const relevantTypes = new Set<string>([
          ...(showProduction ? ACTION_TYPES_BY_SECTION.production : []),
          ...(showQuality    ? ACTION_TYPES_BY_SECTION.quality    : []),
          ...(showInventory  ? ACTION_TYPES_BY_SECTION.inventory  : []),
          ...(showSales      ? ACTION_TYPES_BY_SECTION.sales      : []),
          ...(showProduction && showQuality ? ACTION_TYPES_BY_SECTION.admin : []),
        ])
        const feed = activityFeed.filter(e => relevantTypes.has(e.action_type))
        if (feed.length === 0) return null
        return (
          <section>
            <SectionCard title="Recent Activity" subtitle="Audit log of actions by your team">
              <ActivityTimeline entries={feed} />
            </SectionCard>
          </section>
        )
      })()}

    </div>
  )
}
