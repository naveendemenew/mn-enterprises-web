'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Users,
  Building2,
  Receipt,
  Car,
  TrendingUp,
  ClipboardList,
  Settings,
  ChevronLeft,
  ChevronRight,
  Droplets,
  LogOut,
} from 'lucide-react'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/',           label: 'Overview',         icon: LayoutDashboard },
  { href: '/stock',      label: 'Stock Register',   icon: Package },
  { href: '/sales',      label: 'Sales (Outward)',  icon: ShoppingCart },
  { href: '/purchases',  label: 'Purchases (Inward)',icon: Truck },
  { href: '/customers',  label: 'Customers / Dues', icon: Users },
  { href: '/suppliers',  label: 'Suppliers / Brands',icon: Building2 },
  { href: '/expenses',   label: 'Expenses',         icon: Receipt },
  { href: '/vehicles',   label: 'Vehicles / Diesel',icon: Car },
  { href: '/profit',     label: 'Profit Analysis',  icon: TrendingUp },
  { href: '/indents',    label: 'Indents',          icon: ClipboardList },
  { href: '/settings',   label: 'Settings',         icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className={`hidden md:flex flex-col bg-slate-900 text-slate-300 transition-all duration-200 shrink-0 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo / brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
        <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-lg shrink-0">
          <Droplets size={16} className="text-white" />
        </div>
        {!collapsed && (
          <span className="font-semibold text-white text-sm leading-tight">
            MN Enterprises
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-blue-700 text-white font-medium'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <button
        onClick={logout}
        title={collapsed ? 'Log out' : undefined}
        className="flex items-center gap-3 px-4 py-2.5 mx-2 mb-1 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
      >
        <LogOut size={18} className="shrink-0" />
        {!collapsed && <span className="truncate">Log out</span>}
      </button>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-center gap-2 px-4 py-3 border-t border-slate-800 text-slate-500 hover:text-slate-300 text-xs transition-colors"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={16} /> : (
          <>
            <ChevronLeft size={16} />
            <span>Collapse</span>
          </>
        )}
      </button>
    </aside>
  )
}
