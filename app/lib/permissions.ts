/**
 * TraceFlow — Centralized RBAC permission map.
 *
 * Permission strings follow the pattern "<action>:<module>".
 *
 * Three layers of control:
 *  1. Sidebar visibility     — view:<module>
 *  2. Dashboard sections     — view:dashboard.<section>
 *  3. In-page write actions  — edit:<module>, manage:<resource>
 *
 * Enforcement contract:
 *  • UI layer  → use the helpers below (hasPermission, canView, canEdit, canManage)
 *  • DB layer  → RLS policies in supabase_rbac.sql / supabase_cleanup.sql
 *    Both must agree; the DB is always the final authority.
 */
import type { Role } from './roles'

// ── Permission registry ───────────────────────────────────────────────────────

export type Permission =
  // Sidebar / page access
  | 'view:dashboard'
  | 'view:products'
  | 'view:raw-materials'
  | 'view:production'
  | 'view:quality-control'
  | 'view:sales'
  | 'view:recall'
  | 'view:team'

  // Dashboard widget groups
  // Each section is a logical slice of the dashboard surface:
  //   .production → production pipeline, batch KPIs, failed QC list, recall risk banner
  //   .quality    → QC trend chart, pass rate KPI, QC breakdown, recent inspections
  //   .tracing    → QR scan activity chart, most-scanned batches, recent scan events
  | 'view:dashboard.production'
  | 'view:dashboard.quality'
  | 'view:dashboard.tracing'

  // In-page write capabilities
  | 'edit:products'
  | 'edit:raw-materials'
  | 'edit:production'
  | 'edit:quality-control'
  | 'edit:sales'

  // Administrative
  | 'manage:team'   // invite, remove, change roles (except promoting to admin)
  | 'invite:admin'  // elevated: only an existing admin may invite another admin
  | 'override:qc'   // admin emergency toggle — enables QC editing after explicit opt-in

// ── Role → permission mapping ─────────────────────────────────────────────────
//
// Reading guide
//   admin       full access including emergency QC override; read-only on QC by default
//   manager     full operational access; cannot invite admins or override QC
//   operations  production-focused; dashboard limited to production + recall risk
//   qc_inspector quality-focused; dashboard limited to QC metrics; sees production (read)
//   inspector   legacy alias for qc_inspector; identical permissions
//   sales       revenue-focused; dashboard shows sales prompt + recall risk
//   warehouse   inventory-focused; dashboard limited to production pipeline (batch context)

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {

  admin: [
    // Full sidebar access
    'view:dashboard', 'view:products', 'view:raw-materials', 'view:production',
    'view:quality-control', 'view:sales', 'view:recall', 'view:team',
    // Full dashboard surface
    'view:dashboard.production', 'view:dashboard.quality', 'view:dashboard.tracing',
    // Full write access (QC excluded by default — override:qc unlocks it via UI toggle)
    'edit:products', 'edit:raw-materials', 'edit:production', 'edit:sales',
    // Admin-only capabilities
    'manage:team', 'invite:admin', 'override:qc',
  ],

  manager: [
    // Full sidebar access (no team-admin route, but still sees Team page for management)
    'view:dashboard', 'view:products', 'view:raw-materials', 'view:production',
    'view:quality-control', 'view:sales', 'view:recall', 'view:team',
    // Full dashboard surface
    'view:dashboard.production', 'view:dashboard.quality', 'view:dashboard.tracing',
    // Full write access (cannot edit QC or override it)
    'edit:products', 'edit:raw-materials', 'edit:production', 'edit:sales',
    // Can manage team but cannot elevate to admin
    'manage:team',
  ],

  operations: [
    // Sidebar: dashboard + production only
    'view:dashboard', 'view:production',
    // Dashboard: production pipeline, batch KPIs, recall risk, failed QC
    'view:dashboard.production',
    // Write: production orders
    'edit:production',
  ],

  qc_inspector: [
    // Sidebar: dashboard + QC + production (read-only to see batch context)
    'view:dashboard', 'view:quality-control', 'view:production',
    // Dashboard: QC metrics, trend charts, inspection results
    'view:dashboard.quality',
    // Write: quality inspections and defects
    'edit:quality-control',
  ],

  // Legacy alias — identical to qc_inspector; kept for backward compat with DB rows
  inspector: [
    'view:dashboard', 'view:quality-control', 'view:production',
    'view:dashboard.quality',
    'edit:quality-control',
  ],

  sales: [
    // Sidebar: dashboard + sales; products visible for catalog reference
    'view:dashboard', 'view:sales', 'view:products',
    // Dashboard: no dedicated section — page shows a focused prompt to go to Sales.
    // Sales get recall risk awareness via the production section (read-only).
    'view:dashboard.production',
    // Write: sales records
    'edit:sales',
  ],

  warehouse: [
    // Sidebar: dashboard + raw materials
    'view:dashboard', 'view:raw-materials',
    // Dashboard: production pipeline gives inventory context (what batches need materials)
    'view:dashboard.production',
    // Write: raw material records
    'edit:raw-materials',
  ],
}

// ── Core helpers ──────────────────────────────────────────────────────────────

/** Returns all permissions held by a role. Null role → empty array. */
export function getPermissions(role: Role | null): Permission[] {
  if (!role) return []
  return ROLE_PERMISSIONS[role] ?? []
}

/** Returns true if role holds the given permission. Null role → always false. */
export function hasPermission(role: Role | null, permission: Permission): boolean {
  if (!role) return false
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission)
}

/** True if role can see the given module in the sidebar or access the page. */
export function canView(role: Role | null, module: string): boolean {
  return hasPermission(role, `view:${module}` as Permission)
}

/** True if role can create / edit / delete records in the given module. */
export function canEdit(role: Role | null, module: string): boolean {
  return hasPermission(role, `edit:${module}` as Permission)
}

/** True if role can perform administrative actions on the given resource. */
export function canManage(role: Role | null, resource: string): boolean {
  return hasPermission(role, `manage:${resource}` as Permission)
}
