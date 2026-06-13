'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField'
import DateInput from '@/components/ui/DateInput'
import { formatINR, formatDate, todayISO, minBackdateISO } from '@/lib/formatters'
import type { ExpenseCategory, Vehicle, Driver } from '@/types/database'

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  diesel: 'Diesel', driver_payment: 'Driver Payment', maintenance: 'Maintenance', misc: 'Miscellaneous',
}

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  diesel: 'bg-amber-100 text-amber-700',
  driver_payment: 'bg-blue-100 text-blue-700',
  maintenance: 'bg-purple-100 text-purple-700',
  misc: 'bg-slate-100 text-slate-700',
}

interface ExpenseRow {
  id: string; category: ExpenseCategory; date: string; amount: number
  vehicle_name: string | null; driver_name: string | null; notes: string | null
  is_auto_diesel: boolean
}

function AddExpenseModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [form, setForm] = useState({ category: 'misc' as ExpenseCategory, date: todayISO(), amount: '', vehicle_id: '', driver_id: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setForm({ category: 'misc', date: todayISO(), amount: '', vehicle_id: '', driver_id: '', notes: '' })
    setErrors({})
    Promise.all([
      supabase.from('vehicles').select('*').order('name'),
      supabase.from('drivers').select('*').order('name'),
    ]).then(([vRes, dRes]) => { setVehicles(vRes.data ?? []); setDrivers(dRes.data ?? []) })
  }, [open])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    const e: Record<string, string> = {}
    if (!form.amount || Number(form.amount) <= 0) e.amount = 'Enter a valid amount'
    if (!form.date) e.date = 'Required'
    else if (form.date < minBackdateISO()) e.date = 'Date cannot be more than 15 days in the past'
    else if (form.date > todayISO()) e.date = 'Date cannot be in the future'
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    await supabase.from('expenses').insert({
      category: form.category,
      date: form.date,
      amount: Number(form.amount),
      vehicle_id: form.vehicle_id || null,
      driver_id: form.driver_id || null,
      notes: form.notes.trim() || null,
    })
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} title="Add Expense" onClose={onClose} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Category" required hint="Diesel expenses are added automatically from Vehicle Logs">
            <Select value={form.category} onChange={set('category')}>
              {Object.entries(CATEGORY_LABELS).filter(([k]) => k !== 'diesel').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </FormField>
          <FormField label="Date" required error={errors.date} hint="Backdated entries allowed up to 15 days">
            <DateInput value={form.date} onChange={iso => setForm(f => ({ ...f, date: iso }))} min={minBackdateISO()} max={todayISO()} error={!!errors.date} />
          </FormField>
        </div>
        <FormField label="Amount (₹)" required error={errors.amount}>
          <Input type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" error={!!errors.amount} autoFocus />
        </FormField>
        {(form.category === 'diesel' || form.category === 'maintenance' || form.category === 'driver_payment') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Vehicle">
              <Select value={form.vehicle_id} onChange={set('vehicle_id')}>
                <option value="">None</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Driver">
              <Select value={form.driver_id} onChange={set('driver_id')}>
                <option value="">None</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </FormField>
          </div>
        )}
        <FormField label="Notes">
          <Textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Optional" />
        </FormField>
        <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Save Expense</Button>
        </div>
      </div>
    </Modal>
  )
}

export default function ExpensesPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<ExpenseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [filterCat, setFilterCat] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('expenses')
      .select('*, vehicles(name), drivers(name)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300)
    setRows((data ?? []).map((e: any) => ({
      id: e.id, category: e.category, date: e.date, amount: Number(e.amount),
      vehicle_name: e.vehicles?.name ?? null, driver_name: e.drivers?.name ?? null,
      notes: e.notes, is_auto_diesel: !!e.source_vehicle_log_id,
    })))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = filterCat === 'all' ? rows : rows.filter(r => r.category === filterCat)
  const total = filtered.reduce((s, r) => s + r.amount, 0)
  const byCategory = Object.fromEntries(
    Object.keys(CATEGORY_LABELS).map(k => [k, rows.filter(r => r.category === k).reduce((s, r) => s + r.amount, 0)])
  )

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="All operational expenses"
        actions={<Button onClick={() => setAddOpen(true)} size="sm"><Plus size={14} />Add Expense</Button>}
      />

      {/* Category breakdown */}
      {!loading && (
        <div className="flex flex-wrap gap-3 px-6 py-3 bg-white border-b border-slate-200">
          <button onClick={() => setFilterCat('all')} className={`text-sm px-3 py-1 rounded-full ${filterCat === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            All — {formatINR(rows.reduce((s, r) => s + r.amount, 0), 0)}
          </button>
          {Object.entries(CATEGORY_LABELS).map(([k, label]) => byCategory[k] > 0 && (
            <button key={k} onClick={() => setFilterCat(k)} className={`text-sm px-3 py-1 rounded-full ${filterCat === k ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {label} — {formatINR(byCategory[k], 0)}
            </button>
          ))}
        </div>
      )}

      {/* Mobile card list */}
      <div className="p-4 md:hidden space-y-2">
        {loading && <p className="text-center py-10 text-slate-400">Loading…</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-center py-12 text-slate-400">No expenses yet.</p>
        )}
        {filtered.map(r => (
          <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[r.category]}`}>
                  {CATEGORY_LABELS[r.category]}
                </span>
                {r.is_auto_diesel && <span className="ml-1 text-xs text-slate-400">(auto)</span>}
                <p className="text-xs text-slate-400 mt-1">{formatDate(r.date)}</p>
                {(r.vehicle_name || r.driver_name) && (
                  <p className="text-xs text-slate-500 mt-0.5">{[r.vehicle_name, r.driver_name].filter(Boolean).join(' · ')}</p>
                )}
              </div>
              <div className="text-base font-semibold text-slate-800 shrink-0">{formatINR(r.amount, 2)}</div>
            </div>
            {r.notes && <p className="text-xs text-slate-500 mt-2 border-t border-slate-100 pt-2">{r.notes}</p>}
          </div>
        ))}
        {filtered.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Total</span>
            <span className="text-base font-bold text-slate-800">{formatINR(total, 2)}</span>
          </div>
        )}
      </div>

      <div className="hidden md:block p-6">
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Date', 'Category', 'Amount', 'Vehicle', 'Driver', 'Notes'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="text-center py-10 text-slate-400">Loading…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400">No expenses yet.</td></tr>
              )}
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[r.category]}`}>
                      {CATEGORY_LABELS[r.category]}
                    </span>
                    {r.is_auto_diesel && <span className="ml-1 text-xs text-slate-400">(auto)</span>}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{formatINR(r.amount, 2)}</td>
                  <td className="px-4 py-3 text-slate-600">{r.vehicle_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{r.driver_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{r.notes ?? ''}</td>
                </tr>
              ))}
              {filtered.length > 0 && (
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-slate-700">Total</td>
                  <td className="px-4 py-3 font-bold text-slate-800">{formatINR(total, 2)}</td>
                  <td colSpan={3} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddExpenseModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={load} />
    </div>
  )
}
