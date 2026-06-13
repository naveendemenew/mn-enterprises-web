'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, AlertTriangle, History, PackagePlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField'
import { formatINR, formatDate, formatNumber, todayISO } from '@/lib/formatters'
import type { Sku, CurrentStockRow, StockMovement } from '@/types/database'

// ─── Opening Stock Modal ──────────────────────────────────────────────────────
// One-time initial stock setup per SKU — records the starting inventory and its
// cost basis as an inward movement with no supplier/brand attached.

function OpeningStockModal({ open, onClose, onSaved, skus }: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  skus: Sku[]
}) {
  const supabase = createClient()
  const [form, setForm] = useState({
    sku_id: '', date: todayISO(), cases: '', loose_units: '0', price_per_bottle: '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setForm({ sku_id: '', date: todayISO(), cases: '', loose_units: '0', price_per_bottle: '' })
      setErrors({})
    }
  }, [open])

  const selectedSku = skus.find(s => s.id === form.sku_id)
  const casesNum = Number(form.cases) || 0
  const looseNum = Number(form.loose_units) || 0
  const unitsPerCase = selectedSku?.units_per_case ?? 1
  const totalBottles = casesNum * unitsPerCase + looseNum

  useEffect(() => {
    if (!form.sku_id) return
    const sku = skus.find(s => s.id === form.sku_id)
    if (sku?.default_purchase_price_per_bottle != null) {
      setForm(f => ({ ...f, price_per_bottle: String(sku.default_purchase_price_per_bottle) }))
    }
  }, [form.sku_id])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    const e: Record<string, string> = {}
    if (!form.sku_id) e.sku_id = 'Required'
    if (!form.date) e.date = 'Required'
    if (!form.cases && !form.loose_units) e.cases = 'Enter opening quantity'
    if (!form.price_per_bottle) e.price_per_bottle = 'Required for stock valuation'
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)

    await supabase.from('stock_movements').insert({
      sku_id: form.sku_id,
      movement_type: 'inward',
      date: form.date,
      cases: casesNum,
      loose_units: looseNum,
      total_bottles: totalBottles,
      price_per_bottle: Number(form.price_per_bottle),
      is_free_stock: false,
      notes: 'Opening stock',
    })

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} title="Opening Stock Entry" onClose={onClose} size="md">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          One-time entry to record the stock on hand and its cost when you start using this system for an SKU.
        </p>

        <FormField label="SKU / Product" required error={errors.sku_id}>
          <Select value={form.sku_id} onChange={set('sku_id')} error={!!errors.sku_id}>
            <option value="">Select product</option>
            {skus.map(s => <option key={s.id} value={s.id}>{s.name} {(s as any).brands?.name ? `— ${(s as any).brands.name}` : ''}</option>)}
          </Select>
        </FormField>

        <FormField label="As of Date" required>
          <Input type="date" value={form.date} onChange={set('date')} max={todayISO()} />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Cases" error={errors.cases}>
            <Input type="number" min="0" value={form.cases} onChange={set('cases')} placeholder="0" error={!!errors.cases} />
          </FormField>
          <FormField label="Loose Units">
            <Input type="number" min="0" value={form.loose_units} onChange={set('loose_units')} placeholder="0" />
          </FormField>
        </div>

        {totalBottles > 0 && selectedSku && (
          <p className="text-sm text-slate-600">= <strong>{formatNumber(totalBottles)} bottles</strong></p>
        )}

        <FormField label="Cost per Bottle (₹)" required error={errors.price_per_bottle} hint="Used to value this opening stock">
          <Input type="number" min="0" step="0.01" value={form.price_per_bottle} onChange={set('price_per_bottle')} placeholder="0.00" error={!!errors.price_per_bottle} />
        </FormField>

        <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Save Opening Stock</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Adjustment Modal ─────────────────────────────────────────────────────────

function AdjustmentModal({ open, onClose, onSaved, skus }: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  skus: Sku[]
}) {
  const supabase = createClient()
  const [form, setForm] = useState({
    sku_id: '', date: todayISO(), type: 'adjustment' as 'damage' | 'adjustment',
    direction: 'add' as 'add' | 'subtract',
    cases: '', loose_units: '0', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setForm({ sku_id: '', date: todayISO(), type: 'adjustment', direction: 'add', cases: '', loose_units: '0', notes: '' })
      setErrors({})
    }
  }, [open])

  const selectedSku = skus.find(s => s.id === form.sku_id)
  const casesNum = Number(form.cases) || 0
  const looseNum = Number(form.loose_units) || 0
  const unitsPerCase = selectedSku?.units_per_case ?? 1
  const totalBottles = casesNum * unitsPerCase + looseNum

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    const e: Record<string, string> = {}
    if (!form.sku_id) e.sku_id = 'Required'
    if (!form.cases && !form.loose_units) e.cases = 'Enter quantity'
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)

    const signedTotal = form.type === 'damage'
      ? -Math.abs(totalBottles)
      : form.direction === 'subtract' ? -Math.abs(totalBottles) : totalBottles

    await supabase.from('stock_movements').insert({
      sku_id: form.sku_id,
      movement_type: form.type,
      date: form.date,
      cases: casesNum,
      loose_units: looseNum,
      total_bottles: signedTotal,
      is_free_stock: false,
      notes: form.notes.trim() || (form.type === 'damage' ? 'Damage / loss' : 'Manual adjustment'),
    })

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} title="Add Adjustment / Damage" onClose={onClose} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="SKU / Product" required error={errors.sku_id}>
            <Select value={form.sku_id} onChange={set('sku_id')} error={!!errors.sku_id}>
              <option value="">Select product</option>
              {skus.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Date" required>
            <Input type="date" value={form.date} onChange={set('date')} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Entry Type">
            <Select value={form.type} onChange={set('type')}>
              <option value="adjustment">Adjustment (stock correction)</option>
              <option value="damage">Damage / Loss</option>
            </Select>
          </FormField>
          {form.type === 'adjustment' && (
            <FormField label="Direction">
              <Select value={form.direction} onChange={set('direction')}>
                <option value="add">Add to stock (+)</option>
                <option value="subtract">Remove from stock (−)</option>
              </Select>
            </FormField>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Cases" error={errors.cases}>
            <Input type="number" min="0" value={form.cases} onChange={set('cases')} placeholder="0" error={!!errors.cases} />
          </FormField>
          <FormField label="Loose Units">
            <Input type="number" min="0" value={form.loose_units} onChange={set('loose_units')} placeholder="0" />
          </FormField>
        </div>

        {totalBottles > 0 && selectedSku && (
          <p className="text-sm text-slate-600">
            = <strong>{formatNumber(totalBottles)} bottles</strong>
            {form.type === 'damage' || form.direction === 'subtract'
              ? ' will be removed from stock'
              : ' will be added to stock'}
          </p>
        )}

        <FormField label="Notes">
          <Textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Reason for adjustment" />
        </FormField>

        <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Save</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Movement History Modal ───────────────────────────────────────────────────

function MovementHistoryModal({ open, onClose, skuId, skuName }: {
  open: boolean; onClose: () => void; skuId: string | null; skuName: string
}) {
  const supabase = createClient()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !skuId) return
    setLoading(true)
    supabase.from('stock_movements')
      .select('*, customers(name), brands(name)')
      .eq('sku_id', skuId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => { setRows(data ?? []); setLoading(false) })
  }, [open, skuId])

  const typeLabel: Record<string, string> = { inward: 'Inward', outward: 'Outward', damage: 'Damage', adjustment: 'Adjustment' }
  const typeCls: Record<string, string> = {
    inward: 'bg-green-100 text-green-700',
    outward: 'bg-blue-100 text-blue-700',
    damage: 'bg-red-100 text-red-700',
    adjustment: 'bg-amber-100 text-amber-700',
  }

  return (
    <Modal open={open} title={`Movement History — ${skuName}`} onClose={onClose} size="lg">
      {loading && <p className="text-center py-8 text-slate-400">Loading…</p>}
      {!loading && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Date', 'Type', 'Cases', 'Loose', 'Bottles', 'Price/btl', 'Party', 'Notes'].map(h => (
                  <th key={h} className="text-left pb-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-slate-400">No movements found.</td></tr>
              )}
              {rows.map(r => (
                <tr key={r.id} className="border-b border-slate-50">
                  <td className="py-2 pr-4 text-slate-600 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="py-2 pr-4">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${typeCls[r.movement_type]}`}>
                      {r.is_free_stock ? '⭐ ' : ''}{typeLabel[r.movement_type]}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-slate-600 text-right">{r.cases}</td>
                  <td className="py-2 pr-4 text-slate-600 text-right">{r.loose_units}</td>
                  <td className="py-2 pr-4 font-medium text-slate-800 text-right">{formatNumber(Math.abs(r.total_bottles))}</td>
                  <td className="py-2 pr-4 text-slate-600">{r.price_per_bottle != null ? `₹${Number(r.price_per_bottle).toFixed(2)}` : '—'}</td>
                  <td className="py-2 pr-4 text-slate-600 max-w-[140px] truncate">
                    {r.customers?.name ?? r.brands?.name ?? '—'}
                  </td>
                  <td className="py-2 text-slate-500 max-w-[120px] truncate">{r.notes ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

// ─── Stock Register Page ──────────────────────────────────────────────────────

export default function StockPage() {
  const supabase = createClient()
  const [stock, setStock] = useState<CurrentStockRow[]>([])
  const [skus, setSkus] = useState<Sku[]>([])
  const [loading, setLoading] = useState(true)
  const [adjOpen, setAdjOpen] = useState(false)
  const [openingOpen, setOpeningOpen] = useState(false)
  const [histSku, setHistSku] = useState<{ id: string; name: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [stockRes, skuRes] = await Promise.all([
      supabase.from('current_stock_per_sku').select('*').order('brand_name').order('sku_name'),
      supabase.from('skus').select('*, brands(name)').order('name'),
    ])
    setStock(stockRes.data ?? [])
    setSkus(skuRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const totalValue = stock.reduce((s, r) => s + (r.stock_value ?? 0), 0)
  const lowStockCount = stock.filter(r => r.total_bottles > 0 && r.total_bottles <= r.reorder_level_bottles).length
  const outOfStockCount = stock.filter(r => r.total_bottles <= 0).length

  return (
    <div>
      <PageHeader
        title="Stock Register"
        subtitle="Current inventory levels and movement history"
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setOpeningOpen(true)} size="sm" variant="secondary">
              <PackagePlus size={14} />Opening Stock
            </Button>
            <Button onClick={() => setAdjOpen(true)} size="sm" variant="secondary">
              <Plus size={14} />Adjustment / Damage
            </Button>
          </div>
        }
      />

      {/* Summary strip */}
      {!loading && (
        <div className="flex flex-wrap gap-6 px-6 py-3 bg-white border-b border-slate-200 text-sm">
          <span className="text-slate-700 font-medium">Stock value: {formatINR(totalValue, 0)}</span>
          <span className="text-slate-500">{stock.length} SKUs</span>
          {lowStockCount > 0 && (
            <span className="flex items-center gap-1 text-amber-600 font-medium">
              <AlertTriangle size={14} />{lowStockCount} low stock
            </span>
          )}
          {outOfStockCount > 0 && (
            <span className="flex items-center gap-1 text-red-600 font-medium">
              <AlertTriangle size={14} />{outOfStockCount} out of stock
            </span>
          )}
        </div>
      )}

      <div className="p-6">
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Brand', 'SKU / Product', 'Cases', 'Loose', 'Total Bottles', 'Avg Cost/Btl', 'Stock Value', 'Reorder At', ''].map(h => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide ${h === '' ? '' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="text-center py-10 text-slate-400">Loading…</td></tr>}
              {!loading && stock.length === 0 && (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400">No stock data yet. Add purchases first.</td></tr>
              )}
              {stock.map(r => {
                const isLow = r.total_bottles > 0 && r.reorder_level_bottles > 0 && r.total_bottles <= r.reorder_level_bottles
                const isOut = r.total_bottles <= 0
                return (
                  <tr key={r.sku_id} className={`border-b border-slate-100 hover:bg-slate-50 ${isOut ? 'bg-red-50' : isLow ? 'bg-amber-50' : ''}`}>
                    <td className="px-4 py-3 text-slate-600">{r.brand_name}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{r.sku_name}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatNumber(r.cases)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{r.loose_units}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {isOut
                        ? <span className="text-red-600">Out of stock</span>
                        : <span className={isLow ? 'text-amber-700' : 'text-slate-800'}>{formatNumber(r.total_bottles)}</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {r.weighted_avg_cost_per_bottle > 0 ? `₹${Number(r.weighted_avg_cost_per_bottle).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                      {r.stock_value > 0 ? formatINR(r.stock_value, 0) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {r.reorder_level_bottles > 0 ? (
                        <span className={`flex items-center justify-end gap-1 ${isLow ? 'text-amber-600 font-medium' : ''}`}>
                          {isLow && <AlertTriangle size={12} />}
                          {formatNumber(r.reorder_level_bottles)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setHistSku({ id: r.sku_id, name: r.sku_name })}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline whitespace-nowrap"
                        title="View movement history"
                      >
                        <History size={12} />History
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <OpeningStockModal open={openingOpen} onClose={() => setOpeningOpen(false)} onSaved={load} skus={skus} />
      <AdjustmentModal open={adjOpen} onClose={() => setAdjOpen(false)} onSaved={load} skus={skus} />
      <MovementHistoryModal
        open={!!histSku}
        onClose={() => setHistSku(null)}
        skuId={histSku?.id ?? null}
        skuName={histSku?.name ?? ''}
      />
    </div>
  )
}
