'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, Minus, Gift, Award, AlertCircle } from 'lucide-react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend,
  BarChart, Cell,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { formatINR, formatNumber, formatDateShort } from '@/lib/formatters'

// ─── Date range helpers ───────────────────────────────────────────────────────

function isoToday() { return new Date().toISOString().slice(0, 10) }
function addDays(iso: string, n: number) {
  const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10)
}
function diffDays(from: string, to: string) {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000)
}

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
  const sub = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() - n); return r }
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

function getComparisonRange(primary: { from: string; to: string }, mode: string): { from: string; to: string } {
  const span = diffDays(primary.from, primary.to) + 1
  if (mode === 'prev') {
    const to = addDays(primary.from, -1)
    const from = addDays(to, -(span - 1))
    return { from, to }
  }
  if (mode === 'year') {
    const shiftYear = (iso: string) => { const d = new Date(iso); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10) }
    return { from: shiftYear(primary.from), to: shiftYear(primary.to) }
  }
  return { from: primary.from, to: primary.to }
}

const PRESETS = [
  { id: 'today', label: 'Today' }, { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'This Week' }, { id: 'last_week', label: 'Last Week' },
  { id: 'month', label: 'This Month' }, { id: 'last_month', label: 'Last Month' },
  { id: 'quarter', label: 'Quarter' }, { id: 'year', label: 'This Year' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrandProfit { brand_id: string; brand_name: string; revenue: number; cogs: number; profit: number; margin: number; bottles: number }
interface SkuProfit { sku_id: string; sku_name: string; brand_name: string; revenue: number; cogs: number; profit: number; margin: number; bottles: number }
interface CustomerProfit { customer_id: string; customer_name: string; revenue: number; profit: number; margin: number; bottles: number }
interface DayProfit { date: string; Revenue: number; Profit: number }
interface Totals { revenue: number; cogs: number; profit: number; margin: number; expenses: number; netProfit: number; compStock: number; compStockGiven: number }

interface ProfitDataset { byBrand: BrandProfit[]; bySku: SkuProfit[]; byCustomer: CustomerProfit[]; daily: DayProfit[]; totals: Totals; freeInward: { sku_name: string; brand_name: string; bottles: number; potentialValue: number }[] }

const EMPTY_TOTALS: Totals = { revenue: 0, cogs: 0, profit: 0, margin: 0, expenses: 0, netProfit: 0, compStock: 0, compStockGiven: 0 }
const EMPTY_DATASET: ProfitDataset = { byBrand: [], bySku: [], byCustomer: [], daily: [], totals: EMPTY_TOTALS, freeInward: [] }

// ─── Data fetcher ─────────────────────────────────────────────────────────────

async function fetchProfitData(supabase: ReturnType<typeof createClient>, from: string, to: string): Promise<ProfitDataset> {
  const [movRes, expRes, stockRes] = await Promise.all([
    supabase.from('stock_movements')
      .select('movement_type, total_bottles, price_per_bottle, cost_per_bottle, is_free_stock, date, sku_id, customer_id, brand_id, skus(name, brands(id, name)), customers(name)')
      .gte('date', from).lte('date', to),
    supabase.from('expenses').select('amount').gte('date', from).lte('date', to),
    supabase.from('current_stock_per_sku').select('sku_id, weighted_avg_cost_per_bottle, default_selling_price_per_bottle'),
  ])

  const movements = movRes.data ?? []
  const costMap: Record<string, number> = {}
  const sellMap: Record<string, number> = {}
  ;(stockRes.data ?? []).forEach(r => {
    costMap[r.sku_id] = Number(r.weighted_avg_cost_per_bottle ?? 0)
    sellMap[r.sku_id] = Number(r.default_selling_price_per_bottle ?? 0)
  })

  const totalExpenses = (expRes.data ?? []).reduce((s, e) => s + Number(e.amount), 0)

  // Partition movements
  const outward = movements.filter(m => m.movement_type === 'outward')
  const freeInwardMov = movements.filter(m => m.movement_type === 'inward' && m.is_free_stock)

  // Cost per bottle for an outward movement: prefer the snapshot taken at
  // sale time (cost_per_bottle), falling back to the current weighted-avg
  // cost for older rows that predate the snapshot column.
  const unitCost = (m: typeof outward[number]) => m.cost_per_bottle ?? costMap[m.sku_id] ?? 0

  // --- Totals ---
  let totalRevenue = 0, totalCogs = 0, compStockGiven = 0
  outward.forEach(m => {
    const rev = m.total_bottles * (m.price_per_bottle ?? 0)
    const cost = m.total_bottles * unitCost(m)
    if (!m.is_free_stock) {
      totalRevenue += rev
      totalCogs += cost
    } else {
      compStockGiven += cost // cost of complimentary stock given to customers
    }
  })
  const totalProfit = totalRevenue - totalCogs
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
  const netProfit = totalProfit - totalExpenses - compStockGiven

  // Complimentary stock received — potential profit (bottles × current sell price)
  const freeSkuMap: Record<string, { sku_name: string; brand_name: string; bottles: number; potentialValue: number }> = {}
  freeInwardMov.forEach(m => {
    const key = m.sku_id
    if (!freeSkuMap[key]) {
      freeSkuMap[key] = {
        sku_name: (m.skus as any)?.name ?? '—',
        brand_name: (m.skus as any)?.brands?.name ?? '—',
        bottles: 0, potentialValue: 0,
      }
    }
    freeSkuMap[key].bottles += m.total_bottles
    freeSkuMap[key].potentialValue += m.total_bottles * (sellMap[m.sku_id] ?? 0)
  })
  const freeInward = Object.values(freeSkuMap).sort((a, b) => b.potentialValue - a.potentialValue)

  // --- By Brand ---
  const brandMap: Record<string, BrandProfit> = {}
  outward.filter(m => !m.is_free_stock).forEach(m => {
    const brandId = (m.skus as any)?.brands?.id ?? m.brand_id ?? 'unknown'
    const brandName = (m.skus as any)?.brands?.name ?? '—'
    if (!brandMap[brandId]) brandMap[brandId] = { brand_id: brandId, brand_name: brandName, revenue: 0, cogs: 0, profit: 0, margin: 0, bottles: 0 }
    const rev = m.total_bottles * (m.price_per_bottle ?? 0)
    const cost = m.total_bottles * unitCost(m)
    brandMap[brandId].revenue += rev
    brandMap[brandId].cogs += cost
    brandMap[brandId].profit += rev - cost
    brandMap[brandId].bottles += m.total_bottles
  })
  const byBrand = Object.values(brandMap).map(b => ({ ...b, margin: b.revenue > 0 ? (b.profit / b.revenue) * 100 : 0 }))
    .sort((a, b) => b.profit - a.profit)

  // --- By SKU ---
  const skuMap: Record<string, SkuProfit> = {}
  outward.filter(m => !m.is_free_stock).forEach(m => {
    const skuName = (m.skus as any)?.name ?? '—'
    const brandName = (m.skus as any)?.brands?.name ?? '—'
    if (!skuMap[m.sku_id]) skuMap[m.sku_id] = { sku_id: m.sku_id, sku_name: skuName, brand_name: brandName, revenue: 0, cogs: 0, profit: 0, margin: 0, bottles: 0 }
    const rev = m.total_bottles * (m.price_per_bottle ?? 0)
    const cost = m.total_bottles * unitCost(m)
    skuMap[m.sku_id].revenue += rev
    skuMap[m.sku_id].cogs += cost
    skuMap[m.sku_id].profit += rev - cost
    skuMap[m.sku_id].bottles += m.total_bottles
  })
  const bySku = Object.values(skuMap).map(s => ({ ...s, margin: s.revenue > 0 ? (s.profit / s.revenue) * 100 : 0 }))
    .sort((a, b) => b.profit - a.profit)

  // --- By Customer ---
  const custMap: Record<string, CustomerProfit> = {}
  outward.filter(m => !m.is_free_stock && m.customer_id).forEach(m => {
    const custId = m.customer_id!
    const custName = (m.customers as any)?.name ?? '—'
    if (!custMap[custId]) custMap[custId] = { customer_id: custId, customer_name: custName, revenue: 0, profit: 0, margin: 0, bottles: 0 }
    const rev = m.total_bottles * (m.price_per_bottle ?? 0)
    const cost = m.total_bottles * unitCost(m)
    custMap[custId].revenue += rev
    custMap[custId].profit += rev - cost
    custMap[custId].bottles += m.total_bottles
  })
  const byCustomer = Object.values(custMap).map(c => ({ ...c, margin: c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0 }))
    .sort((a, b) => b.profit - a.profit)

  // --- Daily ---
  const dayMap: Record<string, { rev: number; profit: number }> = {}
  outward.filter(m => !m.is_free_stock).forEach(m => {
    if (!dayMap[m.date]) dayMap[m.date] = { rev: 0, profit: 0 }
    const rev = m.total_bottles * (m.price_per_bottle ?? 0)
    const cost = m.total_bottles * unitCost(m)
    dayMap[m.date].rev += rev
    dayMap[m.date].profit += rev - cost
  })
  const daily = Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({
    date: formatDateShort(date), Revenue: Math.round(v.rev), Profit: Math.round(v.profit),
  }))

  return {
    byBrand, bySku, byCustomer, daily, freeInward,
    totals: {
      revenue: totalRevenue, cogs: totalCogs, profit: totalProfit, margin,
      expenses: totalExpenses, netProfit,
      compStock: freeInward.reduce((s, f) => s + f.potentialValue, 0),
      compStockGiven,
    },
  }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function pct(a: number, b: number) { if (b === 0) return null; return ((a - b) / Math.abs(b)) * 100 }

function DeltaBadge({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null || previous === 0) return null
  const delta = pct(current, previous)!
  const up = delta >= 0
  const Icon = Math.abs(delta) < 0.5 ? Minus : up ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded ${up ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      <Icon size={11} />{Math.abs(delta).toFixed(1)}%
    </span>
  )
}

function SummaryCard({ label, value, sub, delta, prevValue, accent }: {
  label: string; value: string; sub?: string
  delta?: { current: number; previous: number | null }
  prevValue?: string; accent?: string
}) {
  return (
    <div className={`bg-white rounded-xl border p-5 ${accent ?? 'border-slate-200'}`}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</p>
      <p className="text-2xl font-bold text-slate-800 leading-none">{value}</p>
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        {delta && <DeltaBadge current={delta.current} previous={delta.previous} />}
        {prevValue && <span className="text-xs text-slate-400">vs {prevValue} prev</span>}
        {sub && <span className="text-xs text-slate-500">{sub}</span>}
      </div>
    </div>
  )
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color ?? p.fill }}>
          {p.name}: {formatINR(p.value, 0)}
        </p>
      ))}
    </div>
  )
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProfitPage() {
  const supabase = createClient()
  const [preset, setPreset] = useState('month')
  const [range, setRange] = useState(getRange('month'))
  const [compareMode, setCompareMode] = useState('prev')
  const [data, setData] = useState<ProfitDataset>(EMPTY_DATASET)
  const [prevData, setPrevData] = useState<ProfitDataset>(EMPTY_DATASET)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'brand' | 'sku' | 'customer'>('brand')

  const load = useCallback(async () => {
    setLoading(true)
    const compRange = getComparisonRange(range, compareMode)
    const [curr, prev] = await Promise.all([
      fetchProfitData(supabase, range.from, range.to),
      fetchProfitData(supabase, compRange.from, compRange.to),
    ])
    setData(curr)
    setPrevData(prev)
    setLoading(false)
  }, [range, compareMode])

  useEffect(() => { load() }, [load])

  const presetLabel = PRESETS.find(p => p.id === preset)?.label ?? 'Period'

  // Build comparison maps for tables
  const prevBrandMap = Object.fromEntries(prevData.byBrand.map(b => [b.brand_id, b]))
  const prevSkuMap = Object.fromEntries(prevData.bySku.map(s => [s.sku_id, s]))
  const prevCustMap = Object.fromEntries(prevData.byCustomer.map(c => [c.customer_id, c]))

  return (
    <div>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-800 shrink-0">Profit Analysis</h1>
          <div className="flex flex-wrap gap-1 flex-1">
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
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500 whitespace-nowrap">Compare with:</span>
            <select
              value={compareMode}
              onChange={e => setCompareMode(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="prev">Previous period</option>
              <option value="year">Same period last year</option>
            </select>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <SummaryCard label="Revenue" value={formatINR(data.totals.revenue, 0)}
            delta={{ current: data.totals.revenue, previous: prevData.totals.revenue }}
            prevValue={formatINR(prevData.totals.revenue, 0)} />
          <SummaryCard label="Cost of Goods" value={formatINR(data.totals.cogs, 0)}
            sub="Weighted avg cost" />
          <SummaryCard label="Gross Profit" value={formatINR(data.totals.profit, 0)}
            delta={{ current: data.totals.profit, previous: prevData.totals.profit }}
            prevValue={formatINR(prevData.totals.profit, 0)}
            accent={data.totals.profit >= 0 ? 'border-green-300' : 'border-red-300'} />
          <SummaryCard label="Gross Margin" value={`${data.totals.margin.toFixed(1)}%`}
            delta={{ current: data.totals.margin, previous: prevData.totals.margin }}
            prevValue={`${prevData.totals.margin.toFixed(1)}%`} />
          <SummaryCard label="Expenses" value={formatINR(data.totals.expenses, 0)}
            sub="Diesel, driver, etc." />
          <SummaryCard label="Net Profit" value={formatINR(data.totals.netProfit, 0)}
            delta={{ current: data.totals.netProfit, previous: prevData.totals.netProfit }}
            prevValue={formatINR(prevData.totals.netProfit, 0)}
            sub="Gross profit − expenses − free stock given"
            accent={data.totals.netProfit >= 0 ? 'border-emerald-300' : 'border-red-300'} />
        </div>

        {/* Callout cards: best performer / most improved / declining */}
        {!loading && data.byBrand.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Best brand by profit */}
            {data.byBrand[0] && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                <Award size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-0.5">Best Brand (Profit)</p>
                  <p className="font-bold text-slate-800">{data.byBrand[0].brand_name}</p>
                  <p className="text-sm text-emerald-700 font-medium">{formatINR(data.byBrand[0].profit, 0)}</p>
                  <p className="text-xs text-slate-500">{data.byBrand[0].margin.toFixed(1)}% margin</p>
                </div>
              </div>
            )}
            {/* Best SKU */}
            {data.bySku[0] && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <TrendingUp size={20} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-0.5">Best SKU (Profit)</p>
                  <p className="font-bold text-slate-800">{data.bySku[0].sku_name}</p>
                  <p className="text-sm text-blue-700 font-medium">{formatINR(data.bySku[0].profit, 0)}</p>
                  <p className="text-xs text-slate-500">{data.bySku[0].brand_name} · {data.bySku[0].margin.toFixed(1)}% margin</p>
                </div>
              </div>
            )}
            {/* Complimentary stock value */}
            {data.freeInward.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <Gift size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Free Scheme Stock</p>
                  <p className="font-bold text-slate-800">{formatNumber(data.freeInward.reduce((s, f) => s + f.bottles, 0))} bottles received</p>
                  <p className="text-sm text-amber-700 font-medium">≈ {formatINR(data.totals.compStock, 0)} potential value</p>
                  <p className="text-xs text-slate-500">Cost = ₹0 (pure profit when sold)</p>
                </div>
              </div>
            )}
            {/* Cost of complimentary stock given to customers */}
            {data.totals.compStockGiven > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
                <Gift size={20} className="text-orange-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-0.5">Free Stock Given (Cost)</p>
                  <p className="text-sm text-orange-700 font-medium">{formatINR(data.totals.compStockGiven, 0)}</p>
                  <p className="text-xs text-slate-500">Complimentary gifts to customers · deducted from Net Profit</p>
                </div>
              </div>
            )}
            {/* Declining brand (if comparison available) */}
            {data.byBrand.length > 1 && prevData.totals.revenue > 0 && (() => {
              const declining = [...data.byBrand]
                .filter(b => prevBrandMap[b.brand_id])
                .map(b => ({ ...b, delta: pct(b.profit, prevBrandMap[b.brand_id]?.profit ?? 0) }))
                .filter(b => b.delta !== null && b.delta < -5)
                .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))
              const worst = declining[0]
              if (!worst) return null
              return (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-0.5">Declining</p>
                    <p className="font-bold text-slate-800">{worst.brand_name}</p>
                    <p className="text-sm text-red-600 font-medium">{formatINR(worst.profit, 0)}</p>
                    <p className="text-xs text-slate-500">{(worst.delta ?? 0).toFixed(1)}% vs prev period</p>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Profit trend chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Daily Revenue vs Gross Profit — {presetLabel}</h2>
          {loading
            ? <p className="text-slate-400 text-sm text-center py-8">Loading…</p>
            : data.daily.length === 0
              ? <p className="text-slate-400 text-sm text-center py-8">No sales data for this period.</p>
              : (
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={data.daily} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Revenue" fill="#93c5fd" radius={[3, 3, 0, 0]} />
                    <Line dataKey="Profit" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3, fill: '#16a34a' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
        </div>

        {/* Ranking tabs: Brand / SKU / Customer */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-1 px-5 pt-4 border-b border-slate-100">
            {(['brand', 'sku', 'customer'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 capitalize transition-colors ${activeTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                By {t === 'sku' ? 'SKU' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
            <span className="ml-auto text-xs text-slate-400 pb-2">Sorted by gross profit ↓</span>
          </div>

          {loading
            ? <p className="text-center py-10 text-slate-400">Loading…</p>
            : (
              <div className="overflow-x-auto">
                {activeTab === 'brand' && <BrandTable rows={data.byBrand} prevMap={prevBrandMap} />}
                {activeTab === 'sku' && <SkuTable rows={data.bySku} prevMap={prevSkuMap} />}
                {activeTab === 'customer' && <CustomerTable rows={data.byCustomer} prevMap={prevCustMap} />}
              </div>
            )}
        </div>

        {/* Brand profit bar chart */}
        {!loading && data.byBrand.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Profit by Brand</h2>
              <ResponsiveContainer width="100%" height={Math.max(180, data.byBrand.length * 52)}>
                <BarChart data={data.byBrand} layout="vertical" margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="brand_name" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="profit" name="Profit" radius={[0, 4, 4, 0]}>
                    {data.byBrand.map((b, i) => <Cell key={b.brand_id} fill={b.profit >= 0 ? CHART_COLORS[i % CHART_COLORS.length] : '#ef4444'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Profit by SKU</h2>
              <ResponsiveContainer width="100%" height={Math.max(180, data.bySku.length * 40)}>
                <BarChart data={data.bySku} layout="vertical" margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="sku_name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="profit" name="Profit" radius={[0, 4, 4, 0]}>
                    {data.bySku.map((s, i) => <Cell key={s.sku_id} fill={s.profit >= 0 ? CHART_COLORS[i % CHART_COLORS.length] : '#ef4444'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Complimentary stock section */}
        {!loading && data.freeInward.length > 0 && (
          <div className="bg-white rounded-xl border border-amber-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Gift size={18} className="text-amber-600" />
              <h2 className="text-sm font-semibold text-slate-700">Complimentary / Scheme Stock Received</h2>
              <span className="ml-auto text-xs text-slate-400">Inward is_free_stock = true · cost = ₹0 · profit when sold = full sale price</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['SKU', 'Brand', 'Bottles Received', 'Potential Value (at sell price)'].map(h => (
                      <th key={h} className="text-left pb-2 pr-6 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.freeInward.map((f, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      <td className="py-2.5 pr-6 font-medium text-slate-800">{f.sku_name}</td>
                      <td className="py-2.5 pr-6 text-slate-600">{f.brand_name}</td>
                      <td className="py-2.5 pr-6 text-slate-700">{formatNumber(f.bottles)}</td>
                      <td className="py-2.5 font-semibold text-amber-700">{formatINR(f.potentialValue, 0)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-200 bg-amber-50">
                    <td colSpan={2} className="py-2.5 pr-6 font-semibold text-slate-700">Total</td>
                    <td className="py-2.5 pr-6 font-semibold text-slate-700">{formatNumber(data.freeInward.reduce((s, f) => s + f.bottles, 0))}</td>
                    <td className="py-2.5 font-bold text-amber-800">{formatINR(data.totals.compStock, 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Ranking tables ───────────────────────────────────────────────────────────

function MarginBar({ margin }: { margin: number }) {
  const w = Math.min(Math.max(margin, 0), 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-1.5 min-w-[60px]">
        <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${w}%` }} />
      </div>
      <span className="text-xs text-slate-600 w-10 text-right">{margin.toFixed(1)}%</span>
    </div>
  )
}

function BrandTable({ rows, prevMap }: { rows: BrandProfit[]; prevMap: Record<string, BrandProfit> }) {
  if (rows.length === 0) return <p className="text-center py-10 text-slate-400">No data for this period.</p>
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-100">
          {['#', 'Brand', 'Bottles', 'Revenue', 'COGS', 'Gross Profit', 'Margin', 'vs Prev'].map(h => (
            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const prev = prevMap[r.brand_id]
          return (
            <tr key={r.brand_id} className="border-b border-slate-50 hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
              <td className="px-4 py-3 font-medium text-slate-800">{r.brand_name}</td>
              <td className="px-4 py-3 text-slate-600">{formatNumber(r.bottles)}</td>
              <td className="px-4 py-3 text-slate-700">{formatINR(r.revenue, 0)}</td>
              <td className="px-4 py-3 text-slate-600">{formatINR(r.cogs, 0)}</td>
              <td className="px-4 py-3 font-semibold text-emerald-700">{formatINR(r.profit, 0)}</td>
              <td className="px-4 py-3 min-w-[120px]"><MarginBar margin={r.margin} /></td>
              <td className="px-4 py-3">
                {prev ? <DeltaBadge current={r.profit} previous={prev.profit} /> : <span className="text-xs text-slate-300">—</span>}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function SkuTable({ rows, prevMap }: { rows: SkuProfit[]; prevMap: Record<string, SkuProfit> }) {
  if (rows.length === 0) return <p className="text-center py-10 text-slate-400">No data for this period.</p>
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-100">
          {['#', 'SKU', 'Brand', 'Bottles', 'Revenue', 'Gross Profit', 'Margin', 'vs Prev'].map(h => (
            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const prev = prevMap[r.sku_id]
          return (
            <tr key={r.sku_id} className="border-b border-slate-50 hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
              <td className="px-4 py-3 font-medium text-slate-800">{r.sku_name}</td>
              <td className="px-4 py-3 text-slate-500">{r.brand_name}</td>
              <td className="px-4 py-3 text-slate-600">{formatNumber(r.bottles)}</td>
              <td className="px-4 py-3 text-slate-700">{formatINR(r.revenue, 0)}</td>
              <td className="px-4 py-3 font-semibold text-emerald-700">{formatINR(r.profit, 0)}</td>
              <td className="px-4 py-3 min-w-[120px]"><MarginBar margin={r.margin} /></td>
              <td className="px-4 py-3">
                {prev ? <DeltaBadge current={r.profit} previous={prev.profit} /> : <span className="text-xs text-slate-300">—</span>}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function CustomerTable({ rows, prevMap }: { rows: CustomerProfit[]; prevMap: Record<string, CustomerProfit> }) {
  if (rows.length === 0) return <p className="text-center py-10 text-slate-400">No data for this period.</p>
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-100">
          {['#', 'Customer', 'Bottles', 'Revenue', 'Gross Profit', 'Margin', 'vs Prev'].map(h => (
            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const prev = prevMap[r.customer_id]
          return (
            <tr key={r.customer_id} className="border-b border-slate-50 hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
              <td className="px-4 py-3 font-medium text-slate-800">{r.customer_name}</td>
              <td className="px-4 py-3 text-slate-600">{formatNumber(r.bottles)}</td>
              <td className="px-4 py-3 text-slate-700">{formatINR(r.revenue, 0)}</td>
              <td className="px-4 py-3 font-semibold text-emerald-700">{formatINR(r.profit, 0)}</td>
              <td className="px-4 py-3 min-w-[120px]"><MarginBar margin={r.margin} /></td>
              <td className="px-4 py-3">
                {prev ? <DeltaBadge current={r.profit} previous={prev.profit} /> : <span className="text-xs text-slate-300">—</span>}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
