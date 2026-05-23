'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Package,
  ClipboardList, ShieldCheck, ShoppingCart,
  Menu, X, Boxes, Sun, Moon, LogOut, AlertTriangle, Users,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../lib/auth-context'
import { ROLE_META } from '../lib/roles'
import { hasPermission, type Permission } from '../lib/permissions'
import { LogoIcon } from './Logo'

type NavItem = {
  label: string
  href: string
  icon: React.ElementType
  permission: Permission
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard, permission: 'view:dashboard' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { label: 'Products',          href: '/products',        icon: Package,       permission: 'view:products'        },
      { label: 'Raw Materials',     href: '/raw-materials',   icon: Boxes,         permission: 'view:raw-materials'   },
      { label: 'Production Orders', href: '/production',      icon: ClipboardList, permission: 'view:production'      },
      { label: 'Quality Control',   href: '/quality-control', icon: ShieldCheck,   permission: 'view:quality-control' },
      { label: 'Sales',             href: '/sales',           icon: ShoppingCart,  permission: 'view:sales'           },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Recall', href: '/recall', icon: AlertTriangle, permission: 'view:recall' },
      { label: 'Team',   href: '/team',   icon: Users,         permission: 'view:team'   },
    ],
  },
]

function NavLink({
  item,
  pathname,
  onClick,
}: {
  item: NavItem
  pathname: string
  onClick?: () => void
}) {
  const active = pathname === item.href
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`
        group relative flex items-center gap-2.5 rounded-lg px-3 py-2
        text-[13px] font-medium transition-all duration-100
        ${active
          ? 'text-[#E2E8F0] bg-white/[0.08]'
          : 'text-[#6B7280] hover:text-[#A8B3C0] hover:bg-white/[0.04]'}
      `}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-[18px] w-[3px] rounded-r-full bg-[#4a8fb9]" />
      )}
      <item.icon
        size={15}
        strokeWidth={active ? 2 : 1.75}
        className={`shrink-0 transition-colors ${active ? 'text-[#4a8fb9]' : ''}`}
      />
      {item.label}
    </Link>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, role, companyName, signOut } = useAuth()

  const [open, setOpen] = useState(false)
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  )

  function toggleDark() {
    const isDark = document.documentElement.classList.toggle('dark')
    setDark(isDark)
    try { localStorage.setItem('tf-theme', isDark ? 'dark' : 'light') } catch {}
  }

  async function handleLogout() {
    await signOut()
    router.replace('/login')
  }

  const roleMeta = role ? (ROLE_META[role] ?? ROLE_META['manager']) : null

  const visibleGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item =>
      role ? hasPermission(role, item.permission) : false
    ),
  })).filter(group => group.items.length > 0)

  const initials = user?.email?.[0]?.toUpperCase() ?? '?'

  const sidebarContent = (
    <aside
      className={`
        fixed top-0 left-0 z-30 h-full w-[240px] flex flex-col
        bg-[#070D13] border-r border-white/[0.06]
        transition-transform duration-200 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}
    >
      {/* Logo header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] px-4">
        <LogoIcon size="sm" />
        <div>
          <p className="text-[13px] font-semibold leading-none tracking-tight text-[#D3D1CE]">
            <span className="font-normal text-[#6a9fc0]">Trace</span>Flow
          </p>
          {companyName && (
            <p className="mt-0.5 text-[10px] text-[#4B5563] truncate max-w-[150px]">{companyName}</p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {visibleGroups.map(group => (
          <div key={group.label}>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-[#374151]">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onClick={() => setOpen(false)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-white/[0.06] px-3 py-3 space-y-1">
        {/* User row */}
        {user && (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1C2E40] text-[11px] font-bold text-[#4a8fb9] border border-[#4a8fb9]/20">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium text-[#8B9BAA]">{user.email}</p>
              {roleMeta && (
                <span className={`inline-flex rounded-sm px-1 text-[9px] font-bold uppercase tracking-wide ${roleMeta.color}`}>
                  {roleMeta.label}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Utility buttons */}
        <div className="flex gap-0.5">
          <button
            onClick={toggleDark}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-medium text-[#525563] hover:bg-white/[0.05] hover:text-[#8B9BAA] transition-colors"
          >
            {dark ? <Sun size={13} /> : <Moon size={13} />}
            {dark ? 'Light' : 'Dark'}
          </button>
          <button
            onClick={handleLogout}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-medium text-[#525563] hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#070D13] px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2.5">
          <LogoIcon size="sm" />
          <span className="text-[13px] font-semibold text-[#D3D1CE] tracking-tight">TraceFlow</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleDark}
            className="rounded-lg p-2 text-[#525563] hover:bg-white/[0.06] hover:text-[#8B9BAA] transition-colors"
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            onClick={() => setOpen(!open)}
            className="rounded-lg p-2 text-[#525563] hover:bg-white/[0.06] hover:text-[#8B9BAA] transition-colors"
          >
            {open ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {sidebarContent}
    </>
  )
}
