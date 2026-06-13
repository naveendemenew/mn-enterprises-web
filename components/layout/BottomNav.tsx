'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Package, Users, Menu } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/',          label: 'Home',  icon: Home },
  { href: '/stock',     label: 'Stock', icon: Package },
  { href: '/customers', label: 'Dues',  icon: Users },
  { href: '/more',      label: 'More',  icon: Menu },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex shadow-[0_-1px_4px_rgba(0,0,0,0.04)]">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-14 text-xs transition-colors ${
              active ? 'text-blue-600' : 'text-slate-500'
            }`}
          >
            <Icon size={20} className={active ? 'text-blue-600' : 'text-slate-400'} />
            <span className={active ? 'font-medium' : ''}>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
