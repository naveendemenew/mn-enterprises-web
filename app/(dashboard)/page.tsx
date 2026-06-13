'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, Package, AlertTriangle, Users, Building2, Receipt, Fuel } from 'lucide-react'
import Link from 'next/link'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { formatINR, formatNumber, formatDate, formatDateShort } from '@/lib/formatters'

// ─── Date range helpers ───────────────────────────────────────────────────────

function getRange(preset: string): { from: string; to: string } {
  const today = new Date()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const startOf = (unit: 'week' | 'month' | 'quarter' | 'year', d: Date) => {
    const r = new Date(d)
    if (unit === 'week') r.setDate(r.getDate() - r.getDay() + 1)
    if (unit === 'month') r.setDate(1)
    if (unit === 'quarter') r.setMonth(Math.floor(r.getMonth() / 3) * 3, 1)
    if (unit === 'year') r.setMonth(0, 1)
    return r
  }
  const sub = (d: Date, days: number) => { const r = new Date(d); r.setDate(r.getDate() - days); return r }

  switch (preset) {
    case 'today':     return { from: iso(today), to: iso(today) }
    case 'yesterday': return { from: iso(sub(today, 1)), to: iso(sub(today, 1)) }
    case 'week':      return { from: iso(startOf('week', today)), to: iso(today) }
    case 'last_week': { const s = startOf('week', sub(today, 7)); return { from: iso(s), to: iso(sub(s, -6)) } }
    case 'month':     return { from: iso(startOf('month', today)), to: iso(today) }
    case 'last_month':{ const s = new Date(today.getFullYear(), today.getMonth() - 1, 1); return { from: iso(s), to: iso(new Date(today.getFullYear(), today.getMonth(), 0)) } }
    case 'quarter':   return { from: iso(startOf('quarter', today)), to: iso(today) }
    case 'year':      return { from: iso(startOf('year', today)), to: iso(today) }
    default:          return { from: iso(startOf('month', today)), to: iso(today) }
  }
}

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'This Week' },
  { id: 'last_week', label: 'Last Week' },
  { id: 'month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'quarter', label: 'This Quarter' },
  { id: 'year', label: 'This Year' },
]

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ title, value, sub, icon: Icon, color, href }: {
  title: string; value: string; sub?: string
  icon: React.ElementType; color: string; href?: string
}) {
  const inner = (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 transition-colors ${href ? 'cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={15} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-800 leading-none mb-1">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

// ─── Custom chart tooltip ─────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.name.includes('Revenue') || p.name.includes('Profit') || p.name.includes('Cost') ? formatINR(p.value, 0) : formatNumber(p.value)}
        </p>
      ))}
    </div>
  )
}

// ─── Overview Page ────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const supabase = createClient()
  const [preset, setPreset] = useState('month')
  const [range, setRange] = useState(getRange('month'))

  // Data state
  const [sales, setSales] = useState({ revenue: 0, bottles: 0 })
  const [profit, setProfit] = useState(0)
  const [expenses, setExpenses] = useState(0)
  const [pendingDues, setPendingDues] = useState(0)
  const [payableToBrands, setPayableToBrands] = useState(0)
  const [stockValue, setStockValue] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [dailyChart, setDailyChart] = useState<any[]>([])
  const [stockByCategory, setStockByCategory] = useState<any[]>([])
  const [stockTable, setStockTable] = useState<any[]>([])
  const [duesTable, setDuesTable] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { from, to } = range

    const [
      movementsRes, expensesRes, duesRes, payableRes, stockRes,
    ] = await Promise.all([
      supabase.from('stock_movements')
        .select('movement_type, total_bottles, price_per_bottle, is_free_stock, date, sku_id')
        .gte('date', from).lte('date', to),
      supabase.from('expenses').select('amount, category').gte('date', from).lte('date', to),
      supabase.from('customer_outstanding_dues').select('*').gt('total_due', 0),
      supabase.from('brand_payables').select('total_payable'),
      supabase.from('current_stock_per_sku').select('*'),
    ])

    // Sales & revenue
    const outward = (movementsRes.data ?? []).filter(m => m.movement_type === 'outward' && !m.is_free_stock)
    const totalRevenue = outward.reduce((s, m) => s + (m.total_bottles * (m.price_per_bottle ?? 0)), 0)
    const totalBottlesSold = outward.reduce((s, m) => s + m.total_bottles, 0)
    setSales({ revenue: totalRevenue, bottles: totalBottlesSold })

    // Stock cost for COGS approximation — use current weighted avg × bottles sold
    const stockMap = Object.fromEntries((stockRes.data ?? []).map(r => [r.sku_id, r.weighted_avg_cost_per_bottle]))
    const cogs = outward.reduce((s, m) => s + (m.total_bottles * (stockMap[m.sku_id] ?? 0)), 0)
    setProfit(totalRevenue - cogs)

    // Expenses
    const totalExp = (expensesRes.data ?? []).reduce((s, e) => s + Number(e.amount), 0)
    setExpenses(totalExp)

    // Dues & payables
    const totalDue = (duesRes.data ?? []).reduce((s, r) => s + Number(r.total_due), 0)
    setPendingDues(totalDue)
    const totalPayable = (payableRes.data ?? []).reduce((s, r) => s + Number(r.total_payable), 0)
    setPayableToBrands(totalPayable)

    // Stock
    const stockData = stockRes.data ?? []
    const sv = stockData.reduce((s, r) => s + Number(r.stock_value ?? 0), 0)
    setStockValue(sv)
    setLowStockCount(stockData.filter(r => r.total_bottles > 0 && r.reorder_level_bottles > 0 && r.total_bottles <= r.reorder_level_bottles).length)

    // Stock by category (for donut)
    const catMap: Record<string, number> = {}
    stockData.forEach(r => { catMap[r.category_name] = (catMap[r.category_name] ?? 0) + Number(r.stock_value ?? 0) })
    setStockByCategory(Object.entries(catMap).map(([name, value]) => ({ name, value })))
    setStockTable(stockData.sort((a, b) => a.total_bottles - b.total_bottles))

    // Daily chart
    const dayMap: Record<string, { revenue: number; profit: number }> = {}
    outward.forEach(m => {
      const d = m.date as string
      if (!dayMap[d]) dayMap[d] = { revenue: 0, profit: 0 }
      const rev = m.total_bottles * (m.price_per_bottle ?? 0)
      const cost = m.total_bottles * (stockMap[m.sku_id] ?? 0)
      dayMap[d].revenue += rev
      dayMap[d].profit += rev - cost
    })
    const days = Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({
      date: formatDateShort(date), Revenue: Math.round(v.revenue), Profit: Math.round(v.profit),
    }))
    setDailyChart(days)

    // Top dues
    setDuesTable((duesRes.data ?? []).sort((a, b) => Number(b.total_due) - Number(a.total_due)).slice(0, 8))

    setLoading(false)
  }, [range])

  useEffect(() => { load() }, [load])

  const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

  return (
    <div>
      {/* Header + date filter */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold text-slate-800">Overview</h1>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => { setPreset(p.id); setRange(getRange(p.id)) }}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                  preset === p.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <MetricCard title="Stock Value" value={formatINR(stockValue, 0)} sub={lowStockCount > 0 ? `${lowStockCount} low stock` : undefined} icon={Package} color="bg-blue-100 text-blue-700" href="/stock" />
          <MetricCard title="Sales" value={formatINR(sales.revenue, 0)} sub={`${formatNumber(sales.bottles)} bottles`} icon={TrendingUp} color="bg-green-100 text-green-700" href="/sales" />
          <MetricCard title="Net Profit" value={formatINR(profit, 0)} sub="Revenue − cost" icon={profit >= 0 ? TrendingUp : TrendingDown} color={profit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'} />
          <MetricCard title="Expenses" value={formatINR(expenses, 0)} icon={Receipt} color="bg-amber-100 text-amber-700" href="/expenses" />
          <MetricCard title="Pending Dues" value={formatINR(pendingDues, 0)} sub="From customers" icon={Users} color="bg-red-100 text-red-700" href="/customers" />
          <MetricCard title="Payable" value={formatINR(payableToBrands, 0)} sub="To brands" icon={Building2} color="bg-orange-100 text-orange-700" href="/suppliers" />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daily sales + profit chart */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Sales vs Profit — {PRESETS.find(p => p.id === preset)?.label}</h2>
            {dailyChart.length === 0
              ? <p className="text-slate-400 text-sm text-center py-8">No sales data for this period.</p>
              : (
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={dailyChart} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Revenue" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Line dataKey="Profit" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
          </div>

          {/* Stock by category donut */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Stock Value by Category</h2>
            {stockByCategory.length === 0
              ? <p className="text-slate-400 text-sm text-center py-8">No stock data.</p>
              : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={stockByCategory} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                        {stockByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => formatINR(Number(v), 0)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-3">
                    {stockByCategory.map((c, i) => (
                      <div key={c.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-slate-600">{c.name}</span>
                        </div>
                        <span className="font-medium text-slate-700">{formatINR(c.value, 0)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
          </div>
        </div>

        {/* Stock table + Dues table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current stock */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Current Stock</h2>
              <Link href="/stock" className="text-xs text-blue-600 hover:underline">View all →</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    {['SKU', 'Brand', 'Cases', 'Bottles', 'Value'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-slate-500 font-semibold uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stockTable.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-slate-400">No stock data</td></tr>}
                  {stockTable.slice(0, 10).map(r => {
                    const isLow = r.total_bottles > 0 && r.reorder_level_bottles > 0 && r.total_bottles <= r.reorder_level_bottles
                    const isOut = r.total_bottles <= 0
                    return (
                      <tr key={r.sku_id} className={`border-b border-slate-50 ${isOut ? 'bg-red-50' : isLow ? 'bg-amber-50' : ''}`}>
                        <td className="px-4 py-2.5 font-medium text-slate-800">{r.sku_name}</td>
                        <td className="px-4 py-2.5 text-slate-500">{r.brand_name}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700">{formatNumber(r.cases)}</td>
                        <td className="px-4 py-2.5 text-right">
                          {isOut
                            ? <span className="text-red-600 font-medium">0 ⚠</span>
                            : <span className={isLow ? 'text-amber-700 font-medium' : 'text-slate-700'}>{formatNumber(r.total_bottles)}</span>
                          }
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-700">{formatINR(r.stock_value, 0)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending dues */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Pending Dues</h2>
              <Link href="/customers" className="text-xs text-blue-600 hover:underline">View all →</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    {['Customer', 'Days Out', 'Due'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-slate-500 font-semibold uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {duesTable.length === 0 && <tr><td colSpan={3} className="text-center py-6 text-slate-400">No pending dues</td></tr>}
                  {duesTable.map(r => {
                    const daysOut = r.days_outstanding != null ? Number(r.days_outstanding) : null
                    const isOverdue = daysOut != null && r.credit_period_days != null && daysOut > Number(r.credit_period_days)
                    return (
                      <tr key={r.customer_id} className="border-b border-slate-50">
                        <td className="px-4 py-2.5">
                          <Link href={`/customers/${r.customer_id}`} className="font-medium text-blue-600 hover:underline">{r.customer_name}</Link>
                        </td>
                        <td className="px-4 py-2.5">
                          {daysOut != null ? (
                            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                              {isOverdue && <AlertTriangle size={10} />}{daysOut}d
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-red-600">{formatINR(Number(r.total_due), 0)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
