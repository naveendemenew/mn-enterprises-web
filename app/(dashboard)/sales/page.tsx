'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField'
import { formatINR, formatDate, formatNumber, todayISO, minBackdateISO } from '@/lib/formatters'
import type { Customer, Brand, Sku } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SaleRow {
  id: string
  date: string
  customer_name: string
  sku_name: string
  brand_name: string
  cases: number
  loose_units: number
  total_bottles: number
  price_per_bottle: number | null
  is_free_stock: boolean
  total_amount: number
  notes: string | null
}

interface FormState {
  customer_id: string
  brand_id: string
  sku_id: string
  date: string
  cases: string
  loose_units: string
  price_per_bottle: string
  is_free_gift: boolean
  notes: string
}

const BLANK: FormState = {
  customer_id: '',
  brand_id: '',
  sku_id: '',
  date: todayISO(),
  cases: '',
  loose_units: '0',
  price_per_bottle: '',
  is_free_gift: false,
  notes: '',
}

// ─── Add Sale Modal ───────────────────────────────────────────────────────────

function AddSaleModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [skus, setSkus] = useState<Sku[]>([])
  const [form, setForm] = useState<FormState>(BLANK)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setForm(BLANK)
    setErrors({})
    Promise.all([
      supabase.from('customers').select('*').order('name'),
      supabase.from('brands').select('*').order('name'),
    ]).then(([custRes, brandRes]) => {
      setCustomers(custRes.data ?? [])
      setBrands(brandRes.data ?? [])
    })
  }, [open])

  useEffect(() => {
    if (!form.brand_id) { setSkus([]); return }
    supabase.from('skus').select('*').eq('brand_id', form.brand_id).order('name')
      .then(({ data }) => {
        setSkus(data ?? [])
        setForm(f => ({ ...f, sku_id: '' }))
      })
  }, [form.brand_id])

  // Auto-fill default selling price when SKU selected
  useEffect(() => {
    if (!form.sku_id || form.is_free_gift) return
    const sku = skus.find(s => s.id === form.sku_id)
    if (sku?.default_selling_price_per_bottle != null) {
      setForm(f => ({ ...f, price_per_bottle: String(sku.default_selling_price_per_bottle) }))
    }
  }, [form.sku_id])

  const selectedSku = skus.find(s => s.id === form.sku_id)
  const casesNum = Number(form.cases) || 0
  const looseNum = Number(form.loose_units) || 0
  const unitsPerCase = selectedSku?.units_per_case ?? 1
  const totalBottles = casesNum * unitsPerCase + looseNum
  const priceNum = form.is_free_gift ? 0 : (Number(form.price_per_bottle) || 0)
  const totalAmount = totalBottles * priceNum
  const pricePerCase = priceNum * unitsPerCase

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.customer_id) e.customer_id = 'Required'
    if (!form.sku_id) e.sku_id = 'Required'
    if (!form.date) e.date = 'Required'
    else if (form.date < minBackdateISO()) e.date = 'Date cannot be more than 15 days in the past'
    else if (form.date > todayISO()) e.date = 'Date cannot be in the future'
    if (!form.cases && !form.loose_units) e.cases = 'Enter cases or loose units'
    if (!form.is_free_gift && !form.price_per_bottle) e.price_per_bottle = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const save = async () => {
    if (!validate()) return
    setSaving(true)

    // Create invoice first
    let invoiceId: string | null = null
    if (!form.is_free_gift && totalAmount > 0) {
      const { data: inv } = await supabase.from('invoices').insert({
        customer_id: form.customer_id,
        date: form.date,
        total_amount: totalAmount,
        amount_paid: 0,
        payment_status: 'unpaid',
      }).select('id').single()
      invoiceId = inv?.id ?? null
    }

    await supabase.from('stock_movements').insert({
      sku_id: form.sku_id,
      movement_type: 'outward' as const,
      date: form.date,
      cases: casesNum,
      loose_units: looseNum,
      total_bottles: totalBottles,
      price_per_bottle: form.is_free_gift ? 0 : priceNum,
      is_free_stock: form.is_free_gift,
      brand_id: form.brand_id || null,
      customer_id: form.customer_id,
      reference_invoice_id: invoiceId,
      notes: form.notes.trim() || null,
    })

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} title="Record Sale (Outward Stock)" onClose={onClose} size="lg">
      <div className="space-y-4">
        {/* Customer */}
        <FormField label="Customer" required error={errors.customer_id}>
          <Select value={form.customer_id} onChange={set('customer_id')} error={!!errors.customer_id}>
            <option value="">Select customer</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </FormField>

        {/* Brand + SKU */}
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Brand">
            <Select value={form.brand_id} onChange={set('brand_id')}>
              <option value="">Select brand</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Product (SKU)" required error={errors.sku_id}>
            <Select value={form.sku_id} onChange={set('sku_id')} disabled={!form.brand_id} error={!!errors.sku_id}>
              <option value="">Select SKU</option>
              {skus.map(s => <option key={s.id} value={s.id}>{s.name} ({s.units_per_case} btl/case)</option>)}
            </Select>
          </FormField>
        </div>

        {/* Date */}
        <FormField label="Date" required error={errors.date} hint="Backdated entries allowed up to 15 days">
          <Input type="date" value={form.date} onChange={set('date')} min={minBackdateISO()} max={todayISO()} error={!!errors.date} />
        </FormField>

        {/* Quantity */}
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Cases" error={errors.cases}>
            <Input type="number" min="0" value={form.cases} onChange={set('cases')} placeholder="0" error={!!errors.cases} />
          </FormField>
          <FormField label="Loose Units" hint="Extra bottles outside full cases">
            <Input type="number" min="0" value={form.loose_units} onChange={set('loose_units')} placeholder="0" />
          </FormField>
          {selectedSku && (
            <div className="flex flex-col justify-end pb-1">
              <span className="text-xs text-slate-500">Total</span>
              <span className="text-lg font-semibold text-slate-800">{formatNumber(totalBottles)} bottles</span>
              {casesNum > 0 && <span className="text-xs text-slate-400">{casesNum}×{unitsPerCase} + {looseNum}</span>}
            </div>
          )}
        </div>

        {/* Free gift toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_free_gift}
            onChange={e => setForm(f => ({ ...f, is_free_gift: e.target.checked, price_per_bottle: '0' }))}
            className="w-4 h-4 rounded accent-blue-600"
          />
          <span className="text-sm text-slate-700">Complimentary / free gift to customer (₹0 revenue)</span>
        </label>

        {/* Price */}
        {!form.is_free_gift && (
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Price per Bottle (₹)" required error={errors.price_per_bottle}>
              <Input type="number" min="0" step="0.01" value={form.price_per_bottle} onChange={set('price_per_bottle')} placeholder="0.00" error={!!errors.price_per_bottle} />
            </FormField>
            <div className="flex flex-col justify-end pb-1 gap-1">
              {selectedSku && priceNum > 0 && (
                <span className="text-xs text-slate-500">= ₹{pricePerCase.toFixed(2)}/case</span>
              )}
              {totalBottles > 0 && priceNum > 0 && (
                <span className="text-base font-semibold text-slate-800">Total: {formatINR(totalAmount, 2)}</span>
              )}
            </div>
          </div>
        )}

        <FormField label="Notes">
          <Textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Optional notes" />
        </FormField>

        <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Save Sale</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Sales Page ───────────────────────────────────────────────────────────────

export default function SalesPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<SaleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('stock_movements')
      .select('*, skus(name, units_per_case, brands(name)), customers(name)')
      .eq('movement_type', 'outward')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)

    setRows((data ?? []).map((m: any) => ({
      id: m.id,
      date: m.date,
      customer_name: m.customers?.name ?? '—',
      sku_name: m.skus?.name ?? '—',
      brand_name: m.skus?.brands?.name ?? '—',
      cases: m.cases,
      loose_units: m.loose_units,
      total_bottles: m.total_bottles,
      price_per_bottle: m.price_per_bottle,
      is_free_stock: m.is_free_stock,
      total_amount: m.total_bottles * (m.price_per_bottle ?? 0),
      notes: m.notes,
    })))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const totalBottles = rows.filter(r => !r.is_free_stock).reduce((s, r) => s + r.total_bottles, 0)
  const totalRevenue = rows.filter(r => !r.is_free_stock).reduce((s, r) => s + r.total_amount, 0)
  const freeRows = rows.filter(r => r.is_free_stock).length

  return (
    <div>
      <PageHeader
        title="Sales (Outward)"
        subtitle="Stock delivered to customers"
        actions={<Button onClick={() => setAddOpen(true)} size="sm"><Plus size={14} />Add Sale</Button>}
      />

      {!loading && rows.length > 0 && (
        <div className="flex gap-6 px-6 py-3 bg-white border-b border-slate-200 text-sm">
          <span className="text-slate-500">{rows.length} entries</span>
          <span className="text-slate-500">{formatNumber(totalBottles)} bottles sold</span>
          <span className="text-slate-700 font-medium">{formatINR(totalRevenue, 2)} revenue</span>
          {freeRows > 0 && <span className="text-amber-600">{freeRows} complimentary entries</span>}
        </div>
      )}

      <div className="p-6">
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Date', 'Customer', 'Brand', 'SKU / Product', 'Cases', 'Loose', 'Total Btl', 'Price/Btl', 'Amount', 'Notes'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={10} className="text-center py-10 text-slate-400">Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={10} className="text-center py-12 text-slate-400">No sales recorded yet. Click + Add Sale to get started.</td></tr>
              )}
              {rows.map(r => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.customer_name}</td>
                  <td className="px-4 py-3 text-slate-600">{r.brand_name}</td>
                  <td className="px-4 py-3 text-slate-700">{r.sku_name}</td>
                  <td className="px-4 py-3 text-slate-600 text-right">{r.cases}</td>
                  <td className="px-4 py-3 text-slate-600 text-right">{r.loose_units}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">{formatNumber(r.total_bottles)}</td>
                  <td className="px-4 py-3">
                    {r.is_free_stock
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">FREE</span>
                      : r.price_per_bottle != null ? `₹${Number(r.price_per_bottle).toFixed(2)}` : '—'
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.is_free_stock
                      ? <span className="text-slate-400">—</span>
                      : <span className="font-medium text-slate-800">{formatINR(r.total_amount, 2)}</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{r.notes ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AddSaleModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={load} />
    </div>
  )
}
