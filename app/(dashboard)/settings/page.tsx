'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField'
import { formatINR } from '@/lib/formatters'
import type { Category, Brand, Sku, Customer, Vehicle, Driver } from '@/types/database'

type Tab = 'categories' | 'brands' | 'skus' | 'customers' | 'vehicles' | 'drivers'

const TABS: { id: Tab; label: string }[] = [
  { id: 'categories', label: 'Categories' },
  { id: 'brands',     label: 'Brands' },
  { id: 'skus',       label: 'SKUs / Products' },
  { id: 'customers',  label: 'Customers' },
  { id: 'vehicles',   label: 'Vehicles' },
  { id: 'drivers',    label: 'Drivers' },
]

// ─── Shared table shell ──────────────────────────────────────────────────────

function TableShell({ cols, children, empty }: {
  cols: string[]
  children: React.ReactNode
  empty?: boolean
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {cols.map(c => (
              <th key={c} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {c}
              </th>
            ))}
            <th className="px-4 py-3 w-20" />
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td colSpan={cols.length + 1} className="text-center py-12 text-slate-400">
                No items yet. Click + Add to get started.
              </td>
            </tr>
          ) : children}
        </tbody>
      </table>
    </div>
  )
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <td className="px-4 py-3">
      <div className="flex items-center justify-end gap-1">
        <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
          <Pencil size={14} />
        </button>
        <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
    </td>
  )
}

function DeleteConfirm({ name, onConfirm, onCancel, loading }: {
  name: string; onConfirm: () => void; onCancel: () => void; loading: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
        <AlertTriangle size={22} className="text-red-600" />
      </div>
      <div>
        <p className="font-medium text-slate-800">Delete "{name}"?</p>
        <p className="text-sm text-slate-500 mt-1">This action cannot be undone.</p>
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>Delete</Button>
      </div>
    </div>
  )
}

// ─── Categories tab ──────────────────────────────────────────────────────────

function CategoriesTab() {
  const supabase = createClient()
  const [items, setItems] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ type: 'add' | 'edit' | 'delete'; item?: Category } | null>(null)
  const [form, setForm] = useState({ name: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('categories').select('*').order('name')
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openAdd = () => { setForm({ name: '' }); setError(''); setModal({ type: 'add' }) }
  const openEdit = (item: Category) => { setForm({ name: item.name }); setError(''); setModal({ type: 'edit', item }) }
  const openDelete = (item: Category) => setModal({ type: 'delete', item })
  const closeModal = () => setModal(null)

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    if (modal?.type === 'add') {
      await supabase.from('categories').insert({ name: form.name.trim() })
    } else if (modal?.item) {
      await supabase.from('categories').update({ name: form.name.trim() }).eq('id', modal.item.id)
    }
    await load(); setSaving(false); closeModal()
  }

  const del = async () => {
    if (!modal?.item) return
    setSaving(true)
    await supabase.from('categories').delete().eq('id', modal.item.id)
    await load(); setSaving(false); closeModal()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd} size="sm"><Plus size={14} />Add Category</Button>
      </div>
      <TableShell cols={['Name']} empty={!loading && items.length === 0}>
        {items.map(item => (
          <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
            <RowActions onEdit={() => openEdit(item)} onDelete={() => openDelete(item)} />
          </tr>
        ))}
      </TableShell>

      <Modal open={modal?.type === 'add' || modal?.type === 'edit'} title={modal?.type === 'add' ? 'Add Category' : 'Edit Category'} onClose={closeModal} size="sm">
        <div className="space-y-4">
          <FormField label="Category Name" required error={error}>
            <Input value={form.name} onChange={e => setForm({ name: e.target.value })} placeholder="e.g. Water Bottles" autoFocus error={!!error} />
          </FormField>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button onClick={save} loading={saving}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal?.type === 'delete'} title="Confirm Delete" onClose={closeModal} size="sm">
        <DeleteConfirm name={modal?.item?.name ?? ''} onConfirm={del} onCancel={closeModal} loading={saving} />
      </Modal>
    </div>
  )
}

// ─── Brands tab ──────────────────────────────────────────────────────────────

function BrandsTab() {
  const supabase = createClient()
  const [items, setItems] = useState<Brand[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ type: 'add' | 'edit' | 'delete'; item?: Brand } | null>(null)
  const [form, setForm] = useState({ category_id: '', name: '', contact_name: '', contact_phone: '', payment_terms: '' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const [brandsRes, catsRes] = await Promise.all([
      supabase.from('brands').select('*, categories(name)').order('name'),
      supabase.from('categories').select('*').order('name'),
    ])
    setItems(brandsRes.data ?? [])
    setCategories(catsRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const blank = { category_id: '', name: '', contact_name: '', contact_phone: '', payment_terms: '' }
  const openAdd = () => { setForm(blank); setErrors({}); setModal({ type: 'add' }) }
  const openEdit = (item: Brand) => {
    setForm({ category_id: item.category_id ?? '', name: item.name, contact_name: item.contact_name ?? '', contact_phone: item.contact_phone ?? '', payment_terms: item.payment_terms ?? '' })
    setErrors({}); setModal({ type: 'edit', item })
  }
  const openDelete = (item: Brand) => setModal({ type: 'delete', item })
  const closeModal = () => setModal(null)

  const save = async () => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.category_id) errs.category_id = 'Category is required'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    const payload = { category_id: form.category_id, name: form.name.trim(), contact_name: form.contact_name.trim() || null, contact_phone: form.contact_phone.trim() || null, payment_terms: form.payment_terms.trim() || null }
    if (modal?.type === 'add') await supabase.from('brands').insert(payload)
    else if (modal?.item) await supabase.from('brands').update(payload).eq('id', modal.item.id)
    await load(); setSaving(false); closeModal()
  }

  const del = async () => {
    if (!modal?.item) return
    setSaving(true)
    await supabase.from('brands').delete().eq('id', modal.item.id)
    await load(); setSaving(false); closeModal()
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd} size="sm"><Plus size={14} />Add Brand</Button>
      </div>
      <TableShell cols={['Name', 'Category', 'Contact', 'Payment Terms']} empty={!loading && items.length === 0}>
        {items.map(item => (
          <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
            <td className="px-4 py-3 text-slate-600">{(item as any).categories?.name ?? '—'}</td>
            <td className="px-4 py-3 text-slate-600">
              {item.contact_name && <div>{item.contact_name}</div>}
              {item.contact_phone && <div className="text-xs text-slate-400">{item.contact_phone}</div>}
              {!item.contact_name && !item.contact_phone && '—'}
            </td>
            <td className="px-4 py-3 text-slate-600">{item.payment_terms ?? '—'}</td>
            <RowActions onEdit={() => openEdit(item)} onDelete={() => openDelete(item)} />
          </tr>
        ))}
      </TableShell>

      <Modal open={modal?.type === 'add' || modal?.type === 'edit'} title={modal?.type === 'add' ? 'Add Brand' : 'Edit Brand'} onClose={closeModal}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Brand Name" required error={errors.name}>
              <Input value={form.name} onChange={f('name')} placeholder="e.g. Bisleri" error={!!errors.name} autoFocus />
            </FormField>
            <FormField label="Category" required error={errors.category_id}>
              <Select value={form.category_id} onChange={f('category_id')} error={!!errors.category_id}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Contact Name">
              <Input value={form.contact_name} onChange={f('contact_name')} placeholder="Contact person" />
            </FormField>
            <FormField label="Contact Phone">
              <Input value={form.contact_phone} onChange={f('contact_phone')} placeholder="Mobile number" />
            </FormField>
          </div>
          <FormField label="Payment Terms">
            <Input value={form.payment_terms} onChange={f('payment_terms')} placeholder="e.g. Net 30 days" />
          </FormField>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button onClick={save} loading={saving}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal?.type === 'delete'} title="Confirm Delete" onClose={closeModal} size="sm">
        <DeleteConfirm name={modal?.item?.name ?? ''} onConfirm={del} onCancel={closeModal} loading={saving} />
      </Modal>
    </div>
  )
}

// ─── SKUs tab ─────────────────────────────────────────────────────────────────

function SkusTab() {
  const supabase = createClient()
  const [items, setItems] = useState<Sku[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ type: 'add' | 'edit' | 'delete'; item?: Sku } | null>(null)
  const [form, setForm] = useState({ brand_id: '', name: '', units_per_case: '1', default_purchase_price_per_bottle: '', default_selling_price_per_bottle: '', mrp_per_bottle: '', reorder_level_bottles: '0' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const [skuRes, brandRes] = await Promise.all([
      supabase.from('skus').select('*, brands(name, categories(name))').order('name'),
      supabase.from('brands').select('*, categories(name)').order('name'),
    ])
    setItems(skuRes.data ?? [])
    setBrands(brandRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const blank = { brand_id: '', name: '', units_per_case: '1', default_purchase_price_per_bottle: '', default_selling_price_per_bottle: '', mrp_per_bottle: '', reorder_level_bottles: '0' }
  const openAdd = () => { setForm(blank); setErrors({}); setModal({ type: 'add' }) }
  const openEdit = (item: Sku) => {
    setForm({
      brand_id: item.brand_id,
      name: item.name,
      units_per_case: String(item.units_per_case),
      default_purchase_price_per_bottle: item.default_purchase_price_per_bottle != null ? String(item.default_purchase_price_per_bottle) : '',
      default_selling_price_per_bottle: item.default_selling_price_per_bottle != null ? String(item.default_selling_price_per_bottle) : '',
      mrp_per_bottle: item.mrp_per_bottle != null ? String(item.mrp_per_bottle) : '',
      reorder_level_bottles: String(item.reorder_level_bottles),
    })
    setErrors({}); setModal({ type: 'edit', item })
  }
  const openDelete = (item: Sku) => setModal({ type: 'delete', item })
  const closeModal = () => setModal(null)

  const save = async () => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.brand_id) errs.brand_id = 'Brand is required'
    if (!form.units_per_case || Number(form.units_per_case) < 1) errs.units_per_case = 'Must be ≥ 1'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    const payload = {
      brand_id: form.brand_id,
      name: form.name.trim(),
      units_per_case: Number(form.units_per_case),
      default_purchase_price_per_bottle: form.default_purchase_price_per_bottle ? Number(form.default_purchase_price_per_bottle) : null,
      default_selling_price_per_bottle: form.default_selling_price_per_bottle ? Number(form.default_selling_price_per_bottle) : null,
      mrp_per_bottle: form.mrp_per_bottle ? Number(form.mrp_per_bottle) : null,
      reorder_level_bottles: Number(form.reorder_level_bottles) || 0,
    }
    if (modal?.type === 'add') await supabase.from('skus').insert(payload)
    else if (modal?.item) await supabase.from('skus').update(payload).eq('id', modal.item.id)
    await load(); setSaving(false); closeModal()
  }

  const del = async () => {
    if (!modal?.item) return
    setSaving(true)
    await supabase.from('skus').delete().eq('id', modal.item.id)
    await load(); setSaving(false); closeModal()
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd} size="sm"><Plus size={14} />Add SKU</Button>
      </div>
      <TableShell cols={['Name', 'Brand', 'Units/Case', 'Buy Price', 'Sell Price', 'Reorder']} empty={!loading && items.length === 0}>
        {items.map(item => (
          <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
            <td className="px-4 py-3 text-slate-600">{(item as any).brands?.name ?? '—'}</td>
            <td className="px-4 py-3 text-slate-600">{item.units_per_case}</td>
            <td className="px-4 py-3 text-slate-600">{item.default_purchase_price_per_bottle != null ? `₹${item.default_purchase_price_per_bottle}` : '—'}</td>
            <td className="px-4 py-3 text-slate-600">{item.default_selling_price_per_bottle != null ? `₹${item.default_selling_price_per_bottle}` : '—'}</td>
            <td className="px-4 py-3 text-slate-600">{item.reorder_level_bottles} btl</td>
            <RowActions onEdit={() => openEdit(item)} onDelete={() => openDelete(item)} />
          </tr>
        ))}
      </TableShell>

      <Modal open={modal?.type === 'add' || modal?.type === 'edit'} title={modal?.type === 'add' ? 'Add SKU' : 'Edit SKU'} onClose={closeModal} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="SKU / Product Name" required error={errors.name}>
              <Input value={form.name} onChange={f('name')} placeholder="e.g. 500ml Bottle" error={!!errors.name} autoFocus />
            </FormField>
            <FormField label="Brand" required error={errors.brand_id}>
              <Select value={form.brand_id} onChange={f('brand_id')} error={!!errors.brand_id}>
                <option value="">Select brand</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </FormField>
          </div>
          <FormField label="Units per Case" required error={errors.units_per_case} hint="Bottles per case (1 for jars)">
            <Input type="number" min="1" value={form.units_per_case} onChange={f('units_per_case')} error={!!errors.units_per_case} />
          </FormField>

          {/* Pricing: bottle price + live case price for Buy / Sell / MRP */}
          {(() => {
            const unitsPerCase = Number(form.units_per_case) || 1
            const buy = Number(form.default_purchase_price_per_bottle) || 0
            const sell = Number(form.default_selling_price_per_bottle) || 0
            const mrp = Number(form.mrp_per_bottle) || 0
            const marginPerBottle = sell - buy
            const marginPerCase = marginPerBottle * unitsPerCase
            const marginPct = buy > 0 ? (marginPerBottle / buy) * 100 : null

            const rows: { key: keyof typeof form; label: string; value: number }[] = [
              { key: 'default_purchase_price_per_bottle', label: 'Buy Price', value: buy },
              { key: 'default_selling_price_per_bottle', label: 'Sell Price', value: sell },
              { key: 'mrp_per_bottle', label: 'MRP', value: mrp },
            ]

            return (
              <div className="space-y-3">
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Price</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">₹ / Bottle</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">₹ / Case ({unitsPerCase})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => (
                        <tr key={r.key} className="border-b border-slate-50 last:border-b-0">
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.label}</td>
                          <td className="px-3 py-2">
                            <Input type="number" min="0" step="0.01" value={form[r.key]} onChange={f(r.key)} placeholder="0.00" />
                          </td>
                          <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                            {r.value > 0 ? formatINR(r.value * unitsPerCase, 2) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {(buy > 0 || sell > 0) && (
                  <div className="bg-slate-50 rounded-lg p-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    <span className="text-slate-500">
                      Margin/bottle:{' '}
                      <span className={`font-semibold ${marginPerBottle >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatINR(marginPerBottle, 2)}
                      </span>
                    </span>
                    <span className="text-slate-500">
                      Margin/case:{' '}
                      <span className={`font-semibold ${marginPerCase >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatINR(marginPerCase, 2)}
                      </span>
                    </span>
                    {marginPct !== null && (
                      <span className="text-slate-500">
                        Margin %:{' '}
                        <span className={`font-semibold ${marginPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {marginPct.toFixed(1)}%
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          <FormField label="Reorder Level (bottles)" hint="Show low-stock alert when stock drops below this">
            <Input type="number" min="0" value={form.reorder_level_bottles} onChange={f('reorder_level_bottles')} />
          </FormField>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button onClick={save} loading={saving}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal?.type === 'delete'} title="Confirm Delete" onClose={closeModal} size="sm">
        <DeleteConfirm name={modal?.item?.name ?? ''} onConfirm={del} onCancel={closeModal} loading={saving} />
      </Modal>
    </div>
  )
}

// ─── Customers tab ────────────────────────────────────────────────────────────

function CustomersTab() {
  const supabase = createClient()
  const [items, setItems] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ type: 'add' | 'edit' | 'delete'; item?: Customer } | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', address: '', credit_period_days: '7' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('customers').select('*').order('name')
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const blank = { name: '', phone: '', address: '', credit_period_days: '7' }
  const openAdd = () => { setForm(blank); setErrors({}); setModal({ type: 'add' }) }
  const openEdit = (item: Customer) => {
    setForm({ name: item.name, phone: item.phone ?? '', address: item.address ?? '', credit_period_days: String(item.credit_period_days) })
    setErrors({}); setModal({ type: 'edit', item })
  }
  const openDelete = (item: Customer) => setModal({ type: 'delete', item })
  const closeModal = () => setModal(null)

  const save = async () => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    const payload = { name: form.name.trim(), phone: form.phone.trim() || null, address: form.address.trim() || null, credit_period_days: Number(form.credit_period_days) || 7 }
    if (modal?.type === 'add') await supabase.from('customers').insert(payload)
    else if (modal?.item) await supabase.from('customers').update(payload).eq('id', modal.item.id)
    await load(); setSaving(false); closeModal()
  }

  const del = async () => {
    if (!modal?.item) return
    setSaving(true)
    await supabase.from('customers').delete().eq('id', modal.item.id)
    await load(); setSaving(false); closeModal()
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd} size="sm"><Plus size={14} />Add Customer</Button>
      </div>
      <TableShell cols={['Name', 'Phone', 'Address', 'Credit Period']} empty={!loading && items.length === 0}>
        {items.map(item => (
          <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
            <td className="px-4 py-3 text-slate-600">{item.phone ?? '—'}</td>
            <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{item.address ?? '—'}</td>
            <td className="px-4 py-3 text-slate-600">{item.credit_period_days} days</td>
            <RowActions onEdit={() => openEdit(item)} onDelete={() => openDelete(item)} />
          </tr>
        ))}
      </TableShell>

      <Modal open={modal?.type === 'add' || modal?.type === 'edit'} title={modal?.type === 'add' ? 'Add Customer' : 'Edit Customer'} onClose={closeModal}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Customer Name" required error={errors.name}>
              <Input value={form.name} onChange={f('name')} placeholder="e.g. Hotel Grand Palace" error={!!errors.name} autoFocus />
            </FormField>
            <FormField label="Phone">
              <Input value={form.phone} onChange={f('phone')} placeholder="Mobile number" />
            </FormField>
          </div>
          <FormField label="Address">
            <Textarea value={form.address} onChange={f('address')} placeholder="Full address" rows={2} />
          </FormField>
          <FormField label="Credit Period (days)" hint="Number of days before payment is due">
            <Input type="number" min="0" value={form.credit_period_days} onChange={f('credit_period_days')} />
          </FormField>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button onClick={save} loading={saving}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal?.type === 'delete'} title="Confirm Delete" onClose={closeModal} size="sm">
        <DeleteConfirm name={modal?.item?.name ?? ''} onConfirm={del} onCancel={closeModal} loading={saving} />
      </Modal>
    </div>
  )
}

// ─── Vehicles tab ─────────────────────────────────────────────────────────────

function VehiclesTab() {
  const supabase = createClient()
  const [items, setItems] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ type: 'add' | 'edit' | 'delete'; item?: Vehicle } | null>(null)
  const [form, setForm] = useState({ name: '', registration_number: '' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('vehicles').select('*').order('name')
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openAdd = () => { setForm({ name: '', registration_number: '' }); setErrors({}); setModal({ type: 'add' }) }
  const openEdit = (item: Vehicle) => { setForm({ name: item.name, registration_number: item.registration_number ?? '' }); setErrors({}); setModal({ type: 'edit', item }) }
  const openDelete = (item: Vehicle) => setModal({ type: 'delete', item })
  const closeModal = () => setModal(null)

  const save = async () => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    const payload = { name: form.name.trim(), registration_number: form.registration_number.trim() || null }
    if (modal?.type === 'add') await supabase.from('vehicles').insert(payload)
    else if (modal?.item) await supabase.from('vehicles').update(payload).eq('id', modal.item.id)
    await load(); setSaving(false); closeModal()
  }

  const del = async () => {
    if (!modal?.item) return
    setSaving(true)
    await supabase.from('vehicles').delete().eq('id', modal.item.id)
    await load(); setSaving(false); closeModal()
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd} size="sm"><Plus size={14} />Add Vehicle</Button>
      </div>
      <TableShell cols={['Name', 'Registration Number']} empty={!loading && items.length === 0}>
        {items.map(item => (
          <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
            <td className="px-4 py-3 text-slate-600">{item.registration_number ?? '—'}</td>
            <RowActions onEdit={() => openEdit(item)} onDelete={() => openDelete(item)} />
          </tr>
        ))}
      </TableShell>

      <Modal open={modal?.type === 'add' || modal?.type === 'edit'} title={modal?.type === 'add' ? 'Add Vehicle' : 'Edit Vehicle'} onClose={closeModal} size="sm">
        <div className="space-y-4">
          <FormField label="Vehicle Name" required error={errors.name}>
            <Input value={form.name} onChange={f('name')} placeholder="e.g. Van 1" error={!!errors.name} autoFocus />
          </FormField>
          <FormField label="Registration Number">
            <Input value={form.registration_number} onChange={f('registration_number')} placeholder="e.g. KA-01-AB-1234" />
          </FormField>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button onClick={save} loading={saving}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal?.type === 'delete'} title="Confirm Delete" onClose={closeModal} size="sm">
        <DeleteConfirm name={modal?.item?.name ?? ''} onConfirm={del} onCancel={closeModal} loading={saving} />
      </Modal>
    </div>
  )
}

// ─── Drivers tab ──────────────────────────────────────────────────────────────

function DriversTab() {
  const supabase = createClient()
  const [items, setItems] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ type: 'add' | 'edit' | 'delete'; item?: Driver } | null>(null)
  const [form, setForm] = useState({ name: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('drivers').select('*').order('name')
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openAdd = () => { setForm({ name: '', phone: '' }); setErrors({}); setModal({ type: 'add' }) }
  const openEdit = (item: Driver) => { setForm({ name: item.name, phone: item.phone ?? '' }); setErrors({}); setModal({ type: 'edit', item }) }
  const openDelete = (item: Driver) => setModal({ type: 'delete', item })
  const closeModal = () => setModal(null)

  const save = async () => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    const payload = { name: form.name.trim(), phone: form.phone.trim() || null }
    if (modal?.type === 'add') await supabase.from('drivers').insert(payload)
    else if (modal?.item) await supabase.from('drivers').update(payload).eq('id', modal.item.id)
    await load(); setSaving(false); closeModal()
  }

  const del = async () => {
    if (!modal?.item) return
    setSaving(true)
    await supabase.from('drivers').delete().eq('id', modal.item.id)
    await load(); setSaving(false); closeModal()
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd} size="sm"><Plus size={14} />Add Driver</Button>
      </div>
      <TableShell cols={['Name', 'Phone']} empty={!loading && items.length === 0}>
        {items.map(item => (
          <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
            <td className="px-4 py-3 text-slate-600">{item.phone ?? '—'}</td>
            <RowActions onEdit={() => openEdit(item)} onDelete={() => openDelete(item)} />
          </tr>
        ))}
      </TableShell>

      <Modal open={modal?.type === 'add' || modal?.type === 'edit'} title={modal?.type === 'add' ? 'Add Driver' : 'Edit Driver'} onClose={closeModal} size="sm">
        <div className="space-y-4">
          <FormField label="Driver Name" required error={errors.name}>
            <Input value={form.name} onChange={f('name')} placeholder="e.g. Suresh Kumar" error={!!errors.name} autoFocus />
          </FormField>
          <FormField label="Phone">
            <Input value={form.phone} onChange={f('phone')} placeholder="Mobile number" />
          </FormField>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button onClick={save} loading={saving}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal?.type === 'delete'} title="Confirm Delete" onClose={closeModal} size="sm">
        <DeleteConfirm name={modal?.item?.name ?? ''} onConfirm={del} onCancel={closeModal} loading={saving} />
      </Modal>
    </div>
  )
}

// ─── Main Settings page ───────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('categories')

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage master data: categories, brands, SKUs, customers, vehicles, and drivers" />

      {/* Tab navigation */}
      <div className="flex gap-1 px-6 pt-4 border-b border-slate-200 bg-white overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {tab === 'categories' && <CategoriesTab />}
        {tab === 'brands'     && <BrandsTab />}
        {tab === 'skus'       && <SkusTab />}
        {tab === 'customers'  && <CustomersTab />}
        {tab === 'vehicles'   && <VehiclesTab />}
        {tab === 'drivers'    && <DriversTab />}
      </div>
    </div>
  )
}
