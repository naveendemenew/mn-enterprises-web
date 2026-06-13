'use client'

import Link from 'next/link'
import {
  LayoutDashboard, TrendingUp, Building2, ClipboardList, Receipt, Car,
  Settings, Package, ShoppingCart, Truck, ChevronRight,
} from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'

const MENU_ITEMS = [
  { href: '/',          label: 'Overview (Dashboard)', icon: LayoutDashboard },
  { href: '/profit',    label: 'Profit Analysis',      icon: TrendingUp },
  { href: '/suppliers', label: 'Suppliers / Brands',   icon: Building2 },
  { href: '/indents',   label: 'Indents',              icon: ClipboardList },
  { href: '/expenses',  label: 'Expenses',             icon: Receipt },
  { href: '/vehicles',  label: 'Vehicles / Diesel',    icon: Car },
  { href: '/settings',  label: 'Settings',             icon: Settings },
  { href: '/stock',     label: 'Stock Register (full)',icon: Package },
  { href: '/sales',     label: 'Sales History',        icon: ShoppingCart },
  { href: '/purchases', label: 'Purchases History',    icon: Truck },
]

export default function MorePage() {
  return (
    <div>
      <PageHeader title="More" subtitle="All sections of the app" />
      <div className="p-4">
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
          {MENU_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-4 py-4 min-h-14 hover:bg-slate-50 active:bg-slate-100 transition-colors"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                <Icon size={18} />
              </div>
              <span className="flex-1 text-sm font-medium text-slate-800">{label}</span>
              <ChevronRight size={16} className="text-slate-400" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
