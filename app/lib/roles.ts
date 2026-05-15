export type Role = 'admin' | 'manager' | 'inspector'

// Paths an inspector may visit (exact match or prefix)
const INSPECTOR_ALLOWED = ['/production', '/quality-control']

/**
 * Returns true if the given role is allowed to visit the pathname.
 * /trace/* and auth pages are handled separately in AppShell.
 */
export function canVisit(role: Role | null, pathname: string): boolean {
  if (!role) return false
  if (role === 'admin' || role === 'manager') return true
  return INSPECTOR_ALLOWED.some(
    prefix => pathname === prefix || pathname.startsWith(prefix + '/')
  )
}

/** The default landing page for each role after sign-in. */
export function homeFor(role: Role): string {
  return role === 'inspector' ? '/production' : '/'
}

/** Human-readable label and color for each role. */
export const ROLE_META: Record<Role, { label: string; color: string }> = {
  admin:     { label: 'Admin',     color: 'bg-red-500/20 text-red-300' },
  manager:   { label: 'Manager',   color: 'bg-blue-500/20 text-blue-300' },
  inspector: { label: 'Inspector', color: 'bg-emerald-500/20 text-emerald-300' },
}
