'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { FormField, Input, Select } from '@/components/ui/FormField'
import DateInput from '@/components/ui/DateInput'
import { formatDate, todayISO } from '@/lib/formatters'
import type { Brand, Sku, IndentStatus } from '@/types/database'

interface IndentRow {
  id: string; date: string; brand_name: string; status: IndentStatus
  items: { sku_name: string; cases_requested: number }[]
}

function CreateIndentModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [brands, setBrands] = useState<Brand[]>([])
  const [skus, setSkus] = useState<Sku[]>([])
  const [brand_id, setBrandId] = useState('')
  const [date, setDate] = useState(todayISO())
  const [items, setItems] = useState<{ sku_id: string; cases: string }[]>([{ sku_id: '', cases: '' }])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setBrandId(''); setDate(todayISO()); setItems([{ sku_id: '', cases: '' }]); setErrors({})
    supabase.from('brands').select('*').order('name').then(({ data }) => setBrands(data ?? []))
  }, [open])

  useEffect(() => {
    if (!brand_id) { setSkus([]); return }
    supabase.from('skus').select('*').eq('brand_id', brand_id).order('name')
      .then(({ data }) => { setSkus(data ?? []); setItems([{ sku_id: '', cases: '' }]) })
  }, [brand_id])

  const addItem = () => setItems(i => [...i, { sku_id: '', cases: '' }])
  const removeItem = (idx: number) => setItems(i => i.filter((_, j) => j !== idx))
  const setItem = (idx: number, k: 'sku_id' | 'cases', v: string) =>
    setItems(i => i.map((item, j) => j === idx ? { ...item, [k]: v } : item))

  const save = async () => {
    const e: Record<string, string> = {}
    if (!brand_id) e.brand = 'Required'
    if (items.some(i => !i.sku_id || !i.cases)) e.items = 'Fill in all SKU rows'
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)

    const { data: indent } = await supabase.from('indents').insert({
      brand_id, date, status: 'pending',
    }).select('id').single()

    if (indent?.id) {
      await supabase.from('indent_items').insert(
        items.filter(i => i.sku_id && i.cases).map(i => ({
          indent_id: indent.id, sku_id: i.sku_id, cases_requested: Number(i.cases),
        }))
      )
    }
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} title="Create Indent (Purchase Order)" onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Brand / Supplier" required error={errors.brand}>
            <Select value={brand_id} onChange={e => setBrandId(e.target.value)} error={!!errors.brand}>
              <option value="">Select brand</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Date" required>
            <DateInput value={date} onChange={setDate} max={todayISO()} />
          </FormField>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Items</p>
          {errors.items && <p className="text-xs text-red-600">{errors.items}</p>}
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <Select value={item.sku_id} onChange={e => setItem(idx, 'sku_id', e.target.value)} disabled={!brand_id}>
                  <option value="">Select SKU</option>
                  {skus.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>
              <div className="w-20 md:w-28 shrink-0">
                <Input type="number" min="1" value={item.cases} onChange={e => setItem(idx, 'cases', e.target.value)} placeholder="Cases" />
              </div>
              {items.length > 1 && (
                <button onClick={() => removeItem(idx)} className="text-slate-400 hover:text-red-500 text-lg leading-none shrink-0">×</button>
              )}
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={addItem} disabled={!brand_id}>
            <Plus size={12} />Add SKU
          </Button>
        </div>

        <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Create Indent</Button>
        </div>
      </div>
    </Modal>
  )
}

export default function IndentsPage() {
  const supabase = createClient()
  const [indents, setIndents] = useState<IndentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('new') === '1') setAddOpen(true)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('indents')
      .select('*, brands(name), indent_items(cases_requested, skus(name))')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    setIndents((data ?? []).map((ind: any) => ({
      id: ind.id, date: ind.date, brand_name: ind.brands?.name ?? '—', status: ind.status,
      items: (ind.indent_items ?? []).map((it: any) => ({ sku_name: it.skus?.name ?? '—', cases_requested: it.cases_requested })),
    })))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const markReceived = async (id: string) => {
    await supabase.from('indents').update({ status: 'received' }).eq('id', id)
    load()
  }

  return (
    <div>
      <PageHeader
        title="Indents"
        subtitle="Purchase orders raised to brand suppliers"
        actions={<Button onClick={() => setAddOpen(true)} size="sm"><Plus size={14} />Create Indent</Button>}
      />

      <div className="p-6 space-y-4">
        {loading && <p className="text-center py-10 text-slate-400">Loading…</p>}
        {!loading && indents.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
            No indents yet. Create one to raise a purchase order to a brand.
          </div>
        )}
        {indents.map(ind => (
          <div key={ind.id} className={`rounded-lg border bg-white p-4 ${ind.status === 'received' ? 'border-green-200' : 'border-slate-200'}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-semibold text-slate-800">{ind.brand_name}</span>
                  <span className="text-sm text-slate-500">{formatDate(ind.date)}</span>
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    ind.status === 'received' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {ind.status === 'received' ? 'Received' : 'Pending'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {ind.items.map((item, i) => (
                    <span key={i} className="text-sm bg-slate-50 border border-slate-200 rounded px-2 py-1">
                      {item.sku_name} — <strong>{item.cases_requested} cases</strong>
                    </span>
                  ))}
                </div>
              </div>
              {ind.status === 'pending' && (
                <Button size="sm" variant="secondary" onClick={() => markReceived(ind.id)}>
                  <CheckCircle size={14} />Mark Received
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <CreateIndentModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={load} />
    </div>
  )
}
