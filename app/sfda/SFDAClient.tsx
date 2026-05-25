'use client'

import { useState } from 'react'
import { useT, fmtDate } from '../lib/i18n'
import { useAuth, useRole } from '../lib/auth-context'
import {
  ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, XCircle, Clock,
  FileText, Download, Archive, BarChart3, Activity, ClipboardList,
  Filter, Plus, RefreshCw, Package, Users, Calendar, ChevronRight,
  FileWarning, CheckSquare, Printer, Database, Lock, TrendingUp, Zap, Eye,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'requirements' | 'inspection' | 'audit' | 'capa' | 'recall' | 'reports'
type ComplianceStatus = 'compliant' | 'non_compliant' | 'partial' | 'pending'
type CAPAStatus = 'open' | 'in_progress' | 'closed' | 'overdue'
type Severity = 'critical' | 'major' | 'minor'

// ── Mock data ─────────────────────────────────────────────────────────────────

const COMPLIANCE_SCORE = 82
const READINESS_PCT = 87

const REQUIREMENTS = [
  { id: 'gmp',   key: 'req_gmp',   evidence: 'SOP-GMP-2024-01',   records: 48,  status: 'compliant'     as ComplianceStatus, updated: '2026-05-20' },
  { id: 'batch', key: 'req_batch', evidence: 'PROD-TRACE-LOGS',   records: 231, status: 'compliant'     as ComplianceStatus, updated: '2026-05-24' },
  { id: 'ncr',   key: 'req_ncr',   evidence: 'NCR-LOG-2024',      records: 12,  status: 'partial'       as ComplianceStatus, updated: '2026-05-18' },
  { id: 'capa',  key: 'req_capa',  evidence: 'CAPA-REG-2024',     records: 9,   status: 'pending'       as ComplianceStatus, updated: '2026-05-15' },
  { id: 'qc',    key: 'req_qc',    evidence: 'QC-INSP-2024',      records: 104, status: 'compliant'     as ComplianceStatus, updated: '2026-05-23' },
  { id: 'equip', key: 'req_equip', evidence: 'CALIB-SCHED-2024',  records: 17,  status: 'non_compliant' as ComplianceStatus, updated: '2026-04-30' },
  { id: 'audit', key: 'req_audit', evidence: 'SYS-AUDIT-LOG',     records: 892, status: 'compliant'     as ComplianceStatus, updated: '2026-05-24' },
  { id: 'sop',   key: 'req_sop',   evidence: 'SOP-MASTER-2024',   records: 33,  status: 'partial'       as ComplianceStatus, updated: '2026-05-10' },
]

const CAPAS = [
  { id: 'CAPA-2024-001', title: 'Equipment calibration certificate expired — Line 3', arTitle: 'انتهاء صلاحية شهادة معايرة المعدات — خط الإنتاج 3', severity: 'critical' as Severity, due: '2026-05-30', assigned: 'م. خالد العتيبي', root: 'Periodic calibration schedule not enforced', status: 'open' as CAPAStatus },
  { id: 'CAPA-2024-002', title: 'Batch B-2024-089 — temperature excursion during storage', arTitle: 'دفعة B-2024-089 — انحراف درجة الحرارة أثناء التخزين', severity: 'critical' as Severity, due: '2026-05-28', assigned: 'م. سارة الزهراني', root: 'Cold chain monitoring gap', status: 'overdue' as CAPAStatus },
  { id: 'CAPA-2024-003', title: 'Incomplete QC documentation for 4 production runs', arTitle: 'توثيق جودة غير مكتمل لـ 4 دورات إنتاج', severity: 'major' as Severity, due: '2026-06-10', assigned: 'م. نورة الحربي', root: 'SOP checklist not followed by QC team', status: 'in_progress' as CAPAStatus },
  { id: 'CAPA-2024-004', title: 'Supplier audit gap — Al-Rawdah Chemicals', arTitle: 'فجوة في تدقيق المورد — شركة الروضة للكيماويات', severity: 'major' as Severity, due: '2026-06-20', assigned: 'م. عبدالله القحطاني', root: 'Supplier qualification not renewed', status: 'in_progress' as CAPAStatus },
  { id: 'CAPA-2024-005', title: 'Missing lot traceability for 2 raw material batches', arTitle: 'غياب تتبع الدفعة لمادتين خامتين', severity: 'minor' as Severity, due: '2026-06-05', assigned: 'م. فهد الدوسري', root: 'Receiving process skipped barcode scan', status: 'closed' as CAPAStatus },
]

const MOCK_AUDIT = [
  { id: 1, actor: 'م. نورة الحربي',      action: 'product.created',      entity: 'منتج: مكمل فيتامين د',      time: '2026-05-24 14:32', type: 'edit'   },
  { id: 2, actor: 'م. خالد العتيبي',     action: 'qc.result.updated',    entity: 'دفعة: B-2024-091',          time: '2026-05-24 12:18', type: 'qc'     },
  { id: 3, actor: 'م. سارة الزهراني',    action: 'production.completed', entity: 'أمر إنتاج: PO-2024-0044',   time: '2026-05-23 16:45', type: 'edit'   },
  { id: 4, actor: 'م. عبدالله القحطاني', action: 'recall.initiated',     entity: 'دفعة: B-2024-079',          time: '2026-05-22 09:12', type: 'recall' },
  { id: 5, actor: 'م. فهد الدوسري',      action: 'material.deleted',     entity: 'مادة: كبريتات الزنك',       time: '2026-05-21 11:05', type: 'delete' },
  { id: 6, actor: 'م. نورة الحربي',      action: 'qc.override.applied',  entity: 'دفعة: B-2024-088',          time: '2026-05-20 15:30', type: 'qc'     },
  { id: 7, actor: 'م. خالد العتيبي',     action: 'product.updated',      entity: 'منتج: حبوب المغنيسيوم',     time: '2026-05-19 10:22', type: 'edit'   },
  { id: 8, actor: 'م. سارة الزهراني',    action: 'capa.created',         entity: 'CAPA-2024-003',             time: '2026-05-18 14:00', type: 'edit'   },
]

const REPORTS = [
  { key: 'rpt_qc',     icon: ShieldCheck,   lastGen: '2026-05-20', color: 'emerald' },
  { key: 'rpt_batch',  icon: Package,       lastGen: '2026-05-18', color: 'blue'    },
  { key: 'rpt_ncr',    icon: FileWarning,   lastGen: '2026-05-15', color: 'amber'   },
  { key: 'rpt_recall', icon: AlertTriangle, lastGen: '2026-05-22', color: 'red'     },
  { key: 'rpt_capa',   icon: CheckSquare,   lastGen: '2026-05-10', color: 'violet'  },
  { key: 'rpt_gmp',    icon: ClipboardList, lastGen: '2026-05-01', color: 'slate'   },
]

// ── Helper components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ComplianceStatus }) {
  const map: Record<ComplianceStatus, { icon: React.ElementType; cls: string; key: string }> = {
    compliant:     { icon: CheckCircle2, cls: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400', key: 'sfda.status_compliant' },
    non_compliant: { icon: XCircle,      cls: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',                key: 'sfda.status_non_compliant' },
    partial:       { icon: AlertTriangle,cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',        key: 'sfda.status_partial' },
    pending:       { icon: Clock,        cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',              key: 'sfda.status_pending' },
  }
  const { icon: Icon, cls, key } = map[status]
  const { t } = useT()
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      <Icon size={11} />
      {t(key)}
    </span>
  )
}

function CAPAStatusBadge({ status }: { status: CAPAStatus }) {
  const map: Record<CAPAStatus, { cls: string; key: string }> = {
    open:        { cls: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',     key: 'sfda.capa_open' },
    overdue:     { cls: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',         key: 'sfda.capa_overdue' },
    in_progress: { cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400', key: 'sfda.capa_inprogress' },
    closed:      { cls: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400', key: 'sfda.capa_closed' },
  }
  const { cls, key } = map[status]
  const { t } = useT()
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {t(key)}
    </span>
  )
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const map: Record<Severity, { cls: string; key: string }> = {
    critical: { cls: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',         key: 'sfda.severity_critical' },
    major:    { cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400', key: 'sfda.severity_major' },
    minor:    { cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',       key: 'sfda.severity_minor' },
  }
  const { cls, key } = map[severity]
  const { t } = useT()
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {t(key)}
    </span>
  )
}

function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const radius = 45
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="8"
        className="text-gray-200 dark:text-gray-700" />
      <circle
        cx="50" cy="50" r={radius} fill="none"
        stroke={color} strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 50 50)"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
        fontSize="20" fontWeight="700" fill={color}>
        {score}
      </text>
      <text x="50" y="64" textAnchor="middle" fontSize="8" fill="currentColor"
        className="text-gray-500">
        %
      </text>
    </svg>
  )
}

// ── Report color map ──────────────────────────────────────────────────────────

const REPORT_ICON_CLS: Record<string, string> = {
  emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  blue:    'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  amber:   'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  red:     'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  violet:  'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  slate:   'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SFDAClient() {
  const { t, lang, dir } = useT()
  const role = useRole()
  const { companyId } = useAuth()

  const [activeTab,       setActiveTab]       = useState<TabId>('overview')
  const [auditFilter,     setAuditFilter]     = useState<string>('all')
  const [generating,      setGenerating]      = useState(false)
  const [simulating,      setSimulating]      = useState(false)
  const [simDone,         setSimDone]         = useState(false)
  const [reportGenerating,setReportGenerating]= useState<string | null>(null)

  const canEditSFDA = role === 'admin' || role === 'manager'

  const TABS: { id: TabId; labelKey: string }[] = [
    { id: 'overview',     labelKey: 'sfda.tab_overview' },
    { id: 'requirements', labelKey: 'sfda.tab_requirements' },
    { id: 'inspection',   labelKey: 'sfda.tab_inspection' },
    { id: 'audit',        labelKey: 'sfda.tab_audit' },
    { id: 'capa',         labelKey: 'sfda.tab_capa' },
    { id: 'recall',       labelKey: 'sfda.tab_recall' },
    { id: 'reports',      labelKey: 'sfda.tab_reports' },
  ]

  // Suppress unused-import lint for companyId (used in real data fetches)
  void companyId

  // ── Tab: Overview ───────────────────────────────────────────────────────────

  function TabOverview() {
    const attentionItems = REQUIREMENTS.filter(r => r.status !== 'compliant')
    return (
      <div className="space-y-6">
        {/* Score + Readiness row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Score card */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 flex flex-col items-center justify-center gap-2">
            <ScoreRing score={COMPLIANCE_SCORE} size={140} />
            <p className="text-sm font-medium text-[var(--muted)] mt-1">{t('sfda.score_label')}</p>
          </div>

          {/* Readiness + Risk */}
          <div className="md:col-span-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[var(--text)]">{t('sfda.readiness_label')}</span>
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{READINESS_PCT}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-emerald-500 h-3 rounded-full transition-all duration-700"
                  style={{ width: `${READINESS_PCT}%` }}
                />
              </div>
              <p className="text-xs text-[var(--muted)] mt-1">{READINESS_PCT} / 100 — {t('sfda.readiness_label')}</p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--muted)]">{t('sfda.risk_label')}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                <AlertTriangle size={14} />
                {t('sfda.risk_medium')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border)]">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span className="text-[var(--muted)]">5 {t('sfda.status_compliant')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <XCircle size={14} className="text-red-500 shrink-0" />
                <span className="text-[var(--muted)]">1 {t('sfda.status_non_compliant')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                <span className="text-[var(--muted)]">2 {t('sfda.status_partial')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock size={14} className="text-gray-400 shrink-0" />
                <span className="text-[var(--muted)]">1 {t('sfda.status_pending')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: ShieldAlert,    label: 'sfda.open_capas',       value: '3',  cls: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
            { icon: AlertTriangle,  label: 'sfda.critical_findings',value: '2',  cls: 'text-red-600 dark:text-red-400',     bg: 'bg-red-50 dark:bg-red-900/20' },
            { icon: XCircle,        label: 'sfda.failed_qc',        value: '4',  cls: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
            { icon: Calendar,       label: 'sfda.last_inspection',  value: '2026-04-15', cls: 'text-[var(--muted)]', bg: 'bg-[var(--bg)]' },
          ].map(({ icon: Icon, label, value, cls, bg }) => (
            <div key={label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 flex flex-col gap-3">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon size={16} className={cls} />
              </div>
              <div>
                <p className={`text-xl font-bold ${cls}`}>{label === 'sfda.last_inspection' ? fmtDate(value, lang) : value}</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">{t(label)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Attention items */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-[var(--text)]">Areas Requiring Attention</h3>
            <span className="ms-auto text-xs text-[var(--muted)]">{attentionItems.length} items</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {attentionItems.map(req => (
              <div key={req.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ChevronRight size={14} className="text-[var(--subtle)] shrink-0" />
                  <span className="text-sm text-[var(--text)]">{t(`sfda.${req.key}`)}</span>
                </div>
                <StatusBadge status={req.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Tab: Requirements ───────────────────────────────────────────────────────

  function TabRequirements() {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                <th className="text-start px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{t('sfda.req_col_req')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{t('sfda.req_col_evidence')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{t('sfda.req_col_records')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{t('sfda.req_col_status')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{t('sfda.req_col_updated')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {REQUIREMENTS.map((req, i) => (
                <tr key={req.id} className={i % 2 === 0 ? 'bg-[var(--surface)]' : 'bg-[var(--bg)]'}>
                  <td className="px-4 py-3 font-medium text-[var(--text)]">{t(`sfda.${req.key}`)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">{req.evidence}</td>
                  <td className="px-4 py-3 text-[var(--text)]">{req.records.toLocaleString()}</td>
                  <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                  <td className="px-4 py-3 text-[var(--muted)]">{fmtDate(req.updated, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── Tab: Inspection Package ─────────────────────────────────────────────────

  function TabInspection() {
    const packageContents = [
      { label: 'Batch history', detail: '156 records' },
      { label: 'QC inspection reports', detail: '104 reports' },
      { label: 'Traceability chain', detail: 'Complete' },
      { label: 'Recall records', detail: '3 events' },
      { label: 'CAPA logs', detail: '5 actions' },
      { label: 'System audit trail', detail: '892 entries' },
      { label: 'Inspection history', detail: 'All inspections' },
      { label: 'Operator action log', detail: 'Full timeline' },
    ]

    const handleGenerate = () => {
      setGenerating(true)
      setTimeout(() => setGenerating(false), 2000)
    }

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — main content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Archive size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[var(--text)]">{t('sfda.pkg_title')}</h2>
                <p className="text-sm text-[var(--muted)] mt-0.5">{t('sfda.pkg_desc')}</p>
              </div>
            </div>

            <div className="border-t border-[var(--border)] pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--subtle)] mb-3">{t('sfda.pkg_includes')}</p>
              <div className="space-y-2">
                {packageContents.map(item => (
                  <div key={item.label} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                      <span className="text-sm text-[var(--text)]">{item.label}</span>
                    </div>
                    <span className="text-xs text-[var(--muted)]">{item.detail}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-[var(--border)] pt-4 mt-4 flex items-center gap-3">
              {canEditSFDA && (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-2 rounded-lg bg-[#3a6f8f] hover:bg-[#2e5a75] text-white px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {generating
                    ? <><RefreshCw size={14} className="animate-spin" />{t('sfda.pkg_generating')}</>
                    : <><Zap size={14} />{t('sfda.pkg_generate')}</>
                  }
                </button>
              )}
              {!generating && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 size={11} />
                  {t('sfda.pkg_ready')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right — export options */}
        <div className="space-y-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--subtle)] mb-4">Export Options</p>
            <div className="space-y-2">
              {[
                { icon: FileText,    key: 'sfda.pkg_export_pdf' },
                { icon: Archive,     key: 'sfda.pkg_export_zip' },
                { icon: ClipboardList, key: 'sfda.pkg_export_audit' },
              ].map(({ icon: Icon, key }) => (
                <button
                  key={key}
                  className="w-full flex items-center gap-3 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--text)] hover:bg-[var(--bg)] transition-colors"
                >
                  <Icon size={15} className="text-[var(--muted)] shrink-0" />
                  {t(key)}
                  <Download size={13} className="ms-auto text-[var(--muted)]" />
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--subtle)] mb-3">{t('sfda.pkg_last')}</p>
            <div className="flex items-center gap-2 text-sm text-[var(--text)]">
              <Calendar size={14} className="text-[var(--muted)] shrink-0" />
              2026-05-20 — 14.2 MB
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Tab: Audit Trail ────────────────────────────────────────────────────────

  function TabAudit() {
    const FILTERS = [
      { id: 'all',    labelKey: 'sfda.audit_filter_all' },
      { id: 'edit',   labelKey: 'sfda.audit_filter_edits' },
      { id: 'delete', labelKey: 'sfda.audit_filter_deletes' },
      { id: 'qc',     labelKey: 'sfda.audit_filter_qc' },
      { id: 'recall', labelKey: 'sfda.audit_filter_recalls' },
    ]

    const filtered = auditFilter === 'all'
      ? MOCK_AUDIT
      : MOCK_AUDIT.filter(e => e.type === auditFilter)

    const actionCls: Record<string, string> = {
      edit:   'text-blue-600 dark:text-blue-400',
      qc:     'text-emerald-600 dark:text-emerald-400',
      delete: 'text-red-600 dark:text-red-400',
      recall: 'text-amber-600 dark:text-amber-400',
    }

    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            <Filter size={14} className="text-[var(--muted)] shrink-0" />
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setAuditFilter(f.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  auditFilter === f.id
                    ? 'bg-[#3a6f8f] text-white'
                    : 'bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {t(f.labelKey)}
              </button>
            ))}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 shrink-0">
            <Lock size={10} />
            IMMUTABLE RECORD
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                <th className="text-start px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{t('sfda.audit_who')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{t('sfda.audit_action')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{t('sfda.audit_entity')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{t('sfda.audit_time')}</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map((entry, i) => (
                <tr key={entry.id} className={i % 2 === 0 ? 'bg-[var(--surface)]' : 'bg-[var(--bg)]'}>
                  <td className="px-4 py-3 text-[var(--text)] font-medium">{entry.actor}</td>
                  <td className={`px-4 py-3 font-mono text-xs ${actionCls[entry.type] ?? 'text-[var(--muted)]'}`}>{entry.action}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{entry.entity}</td>
                  <td className="px-4 py-3 text-[var(--muted)] whitespace-nowrap">{entry.time}</td>
                  <td className="px-4 py-3">
                    <Lock size={12} className="text-[var(--subtle)]" />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--muted)]">No events match this filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── Tab: CAPA ───────────────────────────────────────────────────────────────

  function TabCAPA() {
    const counts = {
      open: CAPAS.filter(c => c.status === 'open').length,
      in_progress: CAPAS.filter(c => c.status === 'in_progress').length,
      closed: CAPAS.filter(c => c.status === 'closed').length,
      overdue: CAPAS.filter(c => c.status === 'overdue').length,
    }

    return (
      <div className="space-y-4">
        {/* Summary chips + New CAPA */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { status: 'open'       as CAPAStatus, count: counts.open,        cls: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' },
              { status: 'in_progress'as CAPAStatus, count: counts.in_progress, cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' },
              { status: 'closed'     as CAPAStatus, count: counts.closed,      cls: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' },
              { status: 'overdue'    as CAPAStatus, count: counts.overdue,     cls: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' },
            ].map(({ status, count, cls }) => (
              <span key={status} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
                <span className="font-bold">{count}</span>
                <CAPAStatusBadge status={status} />
              </span>
            ))}
          </div>
          {canEditSFDA && (
            <button className="flex items-center gap-2 rounded-lg bg-[#3a6f8f] hover:bg-[#2e5a75] text-white px-4 py-2 text-sm font-medium transition-colors">
              <Plus size={14} />
              {t('sfda.capa_add')}
            </button>
          )}
        </div>

        {/* CAPA table */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                  <th className="text-start px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{t('sfda.capa_col_id')}</th>
                  <th className="text-start px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{t('sfda.capa_col_title')}</th>
                  <th className="text-start px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{t('sfda.capa_col_severity')}</th>
                  <th className="text-start px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{t('sfda.capa_col_due')}</th>
                  <th className="text-start px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{t('sfda.capa_col_assigned')}</th>
                  <th className="text-start px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{t('sfda.capa_col_status')}</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {CAPAS.map((capa, i) => {
                  const isOverdue = capa.status === 'overdue'
                  return (
                    <tr key={capa.id} className={i % 2 === 0 ? 'bg-[var(--surface)]' : 'bg-[var(--bg)]'}>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--muted)] whitespace-nowrap">{capa.id}</td>
                      <td className="px-4 py-3 text-[var(--text)] max-w-xs">
                        <p className="font-medium leading-snug">{lang === 'ar' ? capa.arTitle : capa.title}</p>
                        <p className="text-xs text-[var(--muted)] mt-0.5 truncate">{capa.root}</p>
                      </td>
                      <td className="px-4 py-3"><SeverityBadge severity={capa.severity} /></td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm ${isOverdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-[var(--text)]'}`}>
                        {fmtDate(capa.due, lang)}
                      </td>
                      <td className="px-4 py-3 text-[var(--text)]">{capa.assigned}</td>
                      <td className="px-4 py-3"><CAPAStatusBadge status={capa.status} /></td>
                      <td className="px-4 py-3">
                        {capa.status === 'closed' && (
                          <button className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline">
                            <CheckCircle2 size={12} />
                            {t('sfda.capa_verify')}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ── Tab: Recall Readiness ───────────────────────────────────────────────────

  function TabRecall() {
    const RECALL_SCORE = 91

    const handleSimulate = () => {
      setSimulating(true)
      setSimDone(false)
      setTimeout(() => {
        setSimulating(false)
        setSimDone(true)
      }, 3000)
    }

    return (
      <div className="space-y-6">
        {/* Score + KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 flex flex-col items-center justify-center gap-2">
            <ScoreRing score={RECALL_SCORE} size={120} />
            <p className="text-xs font-medium text-[var(--muted)]">{t('sfda.recall_score')}</p>
          </div>

          {[
            { icon: Package, label: 'sfda.recall_affected',    value: '3',  cls: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-900/20' },
            { icon: TrendingUp, label: 'sfda.recall_downstream', value: '12', cls: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-900/20' },
            { icon: Users,   label: 'sfda.recall_customers',   value: '8',  cls: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20' },
          ].map(({ icon: Icon, label, value, cls, bg }) => (
            <div key={label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 flex flex-col gap-3">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon size={16} className={cls} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${cls}`}>{value}</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">{t(label)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Simulation section */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text)]">{t('sfda.recall_simulate')}</h3>
              <p className="text-xs text-[var(--muted)] mt-1">
                {t('sfda.recall_last')}: 2026-05-10 — Completed in 4.2s
              </p>
            </div>
            <button
              onClick={handleSimulate}
              disabled={simulating}
              className="flex items-center gap-2 rounded-lg bg-[#3a6f8f] hover:bg-[#2e5a75] text-white px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 shrink-0"
            >
              {simulating
                ? <><RefreshCw size={14} className="animate-spin" />Running…</>
                : <><Activity size={14} />{t('sfda.recall_simulate')}</>
              }
            </button>
          </div>

          {simDone && (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5 border-t border-[var(--border)]">
              <div className="flex flex-col gap-1">
                <p className="text-xs text-[var(--muted)]">{t('sfda.recall_time_to_notify')}</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">&lt; 2 hours</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs text-[var(--muted)]">Coverage</p>
                <p className="text-lg font-bold text-[var(--text)]">100%</p>
                <p className="text-xs text-[var(--muted)]">of affected batches identified</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs text-[var(--muted)]">{t('sfda.recall_risk')}</p>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold w-fit bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  <AlertTriangle size={11} />
                  {t('sfda.risk_medium')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Risk factors */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Recall Risk Factors</h3>
          <div className="space-y-3">
            {[
              { label: 'Cold chain monitoring gaps',    level: 'high',   cls: 'bg-red-500' },
              { label: 'Supplier qualification lapses', level: 'medium', cls: 'bg-amber-400' },
              { label: 'Barcode scan misses on intake', level: 'low',    cls: 'bg-emerald-500' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.cls}`} />
                <span className="text-sm text-[var(--text)]">{item.label}</span>
                <span className="ms-auto text-xs text-[var(--muted)] capitalize">{item.level}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Tab: Reports ────────────────────────────────────────────────────────────

  function TabReports() {
    const handleGenerate = (key: string) => {
      setReportGenerating(key)
      setTimeout(() => setReportGenerating(null), 2500)
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map(rpt => {
          const Icon = rpt.icon
          const iconCls = REPORT_ICON_CLS[rpt.color] ?? REPORT_ICON_CLS.slate
          const isGenerating = reportGenerating === rpt.key
          return (
            <div key={rpt.key} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconCls}`}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text)] leading-snug">{t(`sfda.${rpt.key}`)}</p>
                  <p className="text-xs text-[var(--muted)] mt-0.5 leading-relaxed">{t(`sfda.${rpt.key}_desc`)}</p>
                </div>
              </div>

              <div className="text-xs text-[var(--muted)] flex items-center gap-1.5 mt-auto">
                <Calendar size={11} />
                {t('sfda.reports_last')}: {fmtDate(rpt.lastGen, lang)}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleGenerate(rpt.key)}
                  disabled={isGenerating}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#3a6f8f] hover:bg-[#2e5a75] text-white px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60"
                >
                  {isGenerating
                    ? <><RefreshCw size={11} className="animate-spin" />Generating…</>
                    : <><BarChart3 size={11} />{t('sfda.reports_generate')}</>
                  }
                </button>
                <button className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--bg)] transition-colors">
                  <Download size={11} />
                  {t('sfda.reports_download')}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5" dir={dir}>
      {/* Tab bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-[var(--border)]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-[var(--s3)] text-[var(--text)]'
                : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--border)]'
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      {activeTab === 'overview'      && <TabOverview />}
      {activeTab === 'requirements'  && <TabRequirements />}
      {activeTab === 'inspection'    && <TabInspection />}
      {activeTab === 'audit'         && <TabAudit />}
      {activeTab === 'capa'          && <TabCAPA />}
      {activeTab === 'recall'        && <TabRecall />}
      {activeTab === 'reports'       && <TabReports />}
    </div>
  )
}
