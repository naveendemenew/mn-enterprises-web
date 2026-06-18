'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Users, ChevronDown, ChevronUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField'
import DateInput from '@/components/ui/DateInput'
import { formatINR, formatDate, todayISO, minBackdateISO } from '@/lib/formatters'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffMember {
  id: string
  name: string
  role: string | null
  phone: string | null
  monthly_salary: number
  is_active: boolean
}

interface Advance {
  id: string
  staff_id: string
  date: string
  amount: number
  reason: string | null
}

interface SalaryEntry {
  id: string
  staff_id: string
  month: string
  amount: number
  paid_date: string | null
  notes: string | null
}

interface CasualEntry {
  id: string
  date: string
  num_people: number
  amount_per_person: number
  total_amount: number
  purpose: string | null
  notes: string | null
}

interface OwnerEntry {
  id: string
  month: string
  amount: number
  notes: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

// ─── Add Staff Modal ──────────────────────────────────────────────────────────

function AddStaffModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [form, setForm] = useState({ name: '', role: '', phone: '', monthly_salary: '' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) { setForm({ name: '', role: '', phone: '', monthly_salary: '' }); setErrors({}) }
  }, [open])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Required'
    if (!form.monthly_salary || Number(form.monthly_salary) < 0) e.monthly_salary = 'Enter a valid salary'
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    await supabase.from('staff').insert({
      name: form.name.trim(),
      role: form.role.trim() || null,
      phone: form.phone.trim() || null,
      monthly_salary: Number(form.monthly_salary),
    })
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} title="Add Staff Member" onClose={onClose} size="md">
      <div className="space-y-4">
        <FormField label="Name" required error={errors.name}>
          <Input value={form.name} onChange={set('name')} placeholder="e.g. Raju" error={!!errors.name} autoFocus />
        </FormField>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Role">
            <Input value={form.role} onChange={set('role')} placeholder="e.g. Sales, Warehouse" />
          </FormField>
          <FormField label="Phone">
            <Input value={form.phone} onChange={set('phone')} placeholder="9876543210" />
          </FormField>
        </div>
        <FormField label="Monthly Salary (₹)" required error={errors.monthly_salary}>
          <Input type="number" min="0" step="100" value={form.monthly_salary} onChange={set('monthly_salary')} placeholder="0" error={!!errors.monthly_salary} />
        </FormField>
        <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Add Staff</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Add Advance Modal ────────────────────────────────────────────────────────

function AddAdvanceModal({ open, onClose, onSaved, staff }: {
  open: boolean; onClose: () => void; onSaved: () => void; staff: StaffMember[]
}) {
  const supabase = createClient()
  const [form, setForm] = useState({ staff_id: '', date: todayISO(), amount: '', reason: '' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) { setForm({ staff_id: '', date: todayISO(), amount: '', reason: '' }); setErrors({}) }
  }, [open])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    const e: Record<string, string> = {}
    if (!form.staff_id) e.staff_id = 'Select staff member'
    if (!form.amount || Number(form.amount) <= 0) e.amount = 'Enter valid amount'
    if (!form.date) e.date = 'Required'
    else if (form.date < minBackdateISO()) e.date = 'Date cannot be more than 15 days in the past'
    else if (form.date > todayISO()) e.date = 'Date cannot be in the future'
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    await supabase.from('staff_advances').insert({
      staff_id: form.staff_id,
      date: form.date,
      amount: Number(form.amount),
      reason: form.reason.trim() || null,
    })
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} title="Record Advance Payment" onClose={onClose} size="md">
      <div className="space-y-4">
        <FormField label="Staff Member" required error={errors.staff_id}>
          <Select value={form.staff_id} onChange={set('staff_id')} error={!!errors.staff_id}>
            <option value="">Select staff</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}{s.role ? ` (${s.role})` : ''}</option>)}
          </Select>
        </FormField>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Amount (₹)" required error={errors.amount}>
            <Input type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" error={!!errors.amount} autoFocus />
          </FormField>
          <FormField label="Date" required error={errors.date} hint="Up to 15 days back">
            <DateInput value={form.date} onChange={iso => setForm(f => ({ ...f, date: iso }))} min={minBackdateISO()} max={todayISO()} error={!!errors.date} />
          </FormField>
        </div>
        <FormField label="Reason">
          <Textarea value={form.reason} onChange={set('reason')} rows={2} placeholder="e.g. Medical expense, festival advance" />
        </FormField>
        <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Save Advance</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Record Salary Modal ──────────────────────────────────────────────────────

function RecordSalaryModal({ open, onClose, onSaved, staff }: {
  open: boolean; onClose: () => void; onSaved: () => void; staff: StaffMember[]
}) {
  const supabase = createClient()
  const [form, setForm] = useState({ staff_id: '', month: currentMonth(), amount: '', paid_date: todayISO(), notes: '' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) { setForm({ staff_id: '', month: currentMonth(), amount: '', paid_date: todayISO(), notes: '' }); setErrors({}) }
  }, [open])

  useEffect(() => {
    if (!form.staff_id) return
    const member = staff.find(s => s.id === form.staff_id)
    if (member) setForm(f => ({ ...f, amount: String(member.monthly_salary) }))
  }, [form.staff_id])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    const e: Record<string, string> = {}
    if (!form.staff_id) e.staff_id = 'Select staff member'
    if (!form.amount || Number(form.amount) <= 0) e.amount = 'Enter valid amount'
    if (!form.month) e.month = 'Required'
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    await supabase.from('salary_entries').upsert({
      staff_id: form.staff_id,
      month: form.month,
      amount: Number(form.amount),
      paid_date: form.paid_date || null,
      notes: form.notes.trim() || null,
    }, { onConflict: 'staff_id,month' })
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} title="Record Salary Payment" onClose={onClose} size="md">
      <div className="space-y-4">
        <FormField label="Staff Member" required error={errors.staff_id}>
          <Select value={form.staff_id} onChange={set('staff_id')} error={!!errors.staff_id}>
            <option value="">Select staff</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name} — {formatINR(s.monthly_salary, 0)}/mo</option>)}
          </Select>
        </FormField>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Month (YYYY-MM)" required error={errors.month}>
            <Input type="month" value={form.month} onChange={set('month')} error={!!errors.month} />
          </FormField>
          <FormField label="Amount (₹)" required error={errors.amount}>
            <Input type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" error={!!errors.amount} />
          </FormField>
        </div>
        <FormField label="Date Paid">
          <DateInput value={form.paid_date} onChange={iso => setForm(f => ({ ...f, paid_date: iso }))} max={todayISO()} />
        </FormField>
        <FormField label="Notes">
          <Textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Optional" />
        </FormField>
        <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Save Salary</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Add Casual Labour Modal ──────────────────────────────────────────────────

function AddCasualModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [form, setForm] = useState({ date: todayISO(), num_people: '1', amount_per_person: '', purpose: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) { setForm({ date: todayISO(), num_people: '1', amount_per_person: '', purpose: '', notes: '' }); setErrors({}) }
  }, [open])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    const e: Record<string, string> = {}
    if (!form.num_people || Number(form.num_people) < 1) e.num_people = 'Required'
    if (!form.amount_per_person || Number(form.amount_per_person) <= 0) e.amount_per_person = 'Required'
    if (!form.date) e.date = 'Required'
    else if (form.date < minBackdateISO()) e.date = 'Date cannot be more than 15 days in the past'
    else if (form.date > todayISO()) e.date = 'Date cannot be in the future'
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    await supabase.from('casual_labour_entries').insert({
      date: form.date,
      num_people: Number(form.num_people),
      amount_per_person: Number(form.amount_per_person),
      purpose: form.purpose.trim() || null,
      notes: form.notes.trim() || null,
    })
    setSaving(false)
    onSaved()
    onClose()
  }

  const total = (Number(form.num_people) || 0) * (Number(form.amount_per_person) || 0)

  return (
    <Modal open={open} title="Record Casual Labour" onClose={onClose} size="md">
      <div className="space-y-4">
        <FormField label="Date" required error={errors.date} hint="Up to 15 days back">
          <DateInput value={form.date} onChange={iso => setForm(f => ({ ...f, date: iso }))} min={minBackdateISO()} max={todayISO()} error={!!errors.date} />
        </FormField>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Number of People" required error={errors.num_people}>
            <Input type="number" min="1" value={form.num_people} onChange={set('num_people')} error={!!errors.num_people} autoFocus />
          </FormField>
          <FormField label="Amount per Person (₹)" required error={errors.amount_per_person}>
            <Input type="number" min="0" step="0.01" value={form.amount_per_person} onChange={set('amount_per_person')} placeholder="0.00" error={!!errors.amount_per_person} />
          </FormField>
        </div>
        {total > 0 && <p className="text-sm font-medium text-slate-700">Total: {formatINR(total, 2)}</p>}
        <FormField label="Purpose">
          <Input value={form.purpose} onChange={set('purpose')} placeholder="e.g. Loading, Unloading, Cleaning" />
        </FormField>
        <FormField label="Notes">
          <Textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Optional" />
        </FormField>
        <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Save Entry</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Owner Salary Modal ───────────────────────────────────────────────────────

function OwnerSalaryModal({ open, onClose, onSaved, existing }: {
  open: boolean; onClose: () => void; onSaved: () => void; existing: OwnerEntry | null
}) {
  const supabase = createClient()
  const [form, setForm] = useState({ month: currentMonth(), amount: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setForm({
        month: existing?.month ?? currentMonth(),
        amount: existing ? String(existing.amount) : '',
        notes: existing?.notes ?? '',
      })
      setErrors({})
    }
  }, [open, existing])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    const e: Record<string, string> = {}
    if (!form.amount || Number(form.amount) <= 0) e.amount = 'Required'
    if (!form.month) e.month = 'Required'
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    await supabase.from('owner_salary_entries').upsert({
      month: form.month,
      amount: Number(form.amount),
      notes: form.notes.trim() || null,
    }, { onConflict: 'month' })
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} title="Owner Salary" onClose={onClose} size="sm">
      <div className="space-y-4">
        <FormField label="Month (YYYY-MM)" required error={errors.month}>
          <Input type="month" value={form.month} onChange={set('month')} error={!!errors.month} />
        </FormField>
        <FormField label="Amount (₹)" required error={errors.amount}>
          <Input type="number" min="0" step="100" value={form.amount} onChange={set('amount')} placeholder="0" error={!!errors.amount} autoFocus />
        </FormField>
        <FormField label="Notes">
          <Textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Optional" />
        </FormField>
        <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Save</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Staff Detail Card ────────────────────────────────────────────────────────

function StaffDetailCard({ member, advances, salaries }: {
  member: StaffMember
  advances: Advance[]
  salaries: SalaryEntry[]
}) {
  const [expanded, setExpanded] = useState(false)
  const mon = currentMonth()
  const monthAdvances = advances.filter(a => a.date.slice(0, 7) === mon)
  const totalAdvancesThisMonth = monthAdvances.reduce((s, a) => s + Number(a.amount), 0)
  const salaryThisMonth = salaries.find(s => s.month === mon)
  const netPayable = member.monthly_salary - totalAdvancesThisMonth

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <Users size={16} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-800">{member.name}</p>
          <p className="text-xs text-slate-500">{member.role ?? 'Staff'} · {formatINR(member.monthly_salary, 0)}/mo</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-slate-800">Net: {formatINR(netPayable, 0)}</p>
          {totalAdvancesThisMonth > 0 && (
            <p className="text-xs text-amber-600">Advances: {formatINR(totalAdvancesThisMonth, 0)}</p>
          )}
          {salaryThisMonth && <p className="text-xs text-green-600">Paid {monthLabel(mon)}</p>}
        </div>
        {expanded ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
      </div>

      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-3 bg-slate-50">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white rounded-lg border border-slate-200 p-2">
              <p className="text-xs text-slate-500">Monthly Salary</p>
              <p className="font-semibold text-slate-800">{formatINR(member.monthly_salary, 0)}</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-2">
              <p className="text-xs text-slate-500">Advances ({mon.slice(5)})</p>
              <p className="font-semibold text-amber-600">{formatINR(totalAdvancesThisMonth, 0)}</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-2">
              <p className="text-xs text-slate-500">Net Payable</p>
              <p className={`font-semibold ${netPayable >= 0 ? 'text-slate-800' : 'text-red-600'}`}>{formatINR(netPayable, 0)}</p>
            </div>
          </div>

          {advances.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1">All Advances</p>
              <div className="space-y-1">
                {advances.slice(0, 10).map(a => (
                  <div key={a.id} className="flex items-center justify-between text-xs bg-white rounded border border-slate-100 px-3 py-1.5">
                    <span className="text-slate-500">{formatDate(a.date)}{a.reason ? ` — ${a.reason}` : ''}</span>
                    <span className="text-amber-600 font-medium">{formatINR(a.amount, 2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {salaries.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1">Salary History</p>
              <div className="space-y-1">
                {salaries.slice(0, 6).map(s => (
                  <div key={s.id} className="flex items-center justify-between text-xs bg-white rounded border border-slate-100 px-3 py-1.5">
                    <span className="text-slate-500">{monthLabel(s.month)}{s.paid_date ? ` · paid ${formatDate(s.paid_date)}` : ''}</span>
                    <span className="text-green-600 font-medium">{formatINR(s.amount, 2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Staff Page ───────────────────────────────────────────────────────────────

export default function StaffPage() {
  const supabase = createClient()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [advances, setAdvances] = useState<Advance[]>([])
  const [salaries, setSalaries] = useState<SalaryEntry[]>([])
  const [casualEntries, setCasualEntries] = useState<CasualEntry[]>([])
  const [ownerEntries, setOwnerEntries] = useState<OwnerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [addStaffOpen, setAddStaffOpen] = useState(false)
  const [addAdvanceOpen, setAddAdvanceOpen] = useState(false)
  const [addSalaryOpen, setAddSalaryOpen] = useState(false)
  const [addCasualOpen, setAddCasualOpen] = useState(false)
  const [ownerSalaryOpen, setOwnerSalaryOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'staff' | 'casual' | 'owner'>('staff')

  const load = useCallback(async () => {
    setLoading(true)
    const [staffRes, advRes, salRes, casualRes, ownerRes] = await Promise.all([
      supabase.from('staff').select('*').eq('is_active', true).order('name'),
      supabase.from('staff_advances').select('*').order('date', { ascending: false }),
      supabase.from('salary_entries').select('*').order('month', { ascending: false }),
      supabase.from('casual_labour_entries').select('*').order('date', { ascending: false }).limit(50),
      supabase.from('owner_salary_entries').select('*').order('month', { ascending: false }).limit(24),
    ])
    setStaff(staffRes.data ?? [])
    setAdvances(advRes.data ?? [])
    setSalaries(salRes.data ?? [])
    setCasualEntries(casualRes.data ?? [])
    setOwnerEntries(ownerRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const mon = currentMonth()
  const totalAdvancesThisMonth = advances.filter(a => a.date.slice(0, 7) === mon).reduce((s, a) => s + Number(a.amount), 0)
  const totalSalaryThisMonth = salaries.filter(s => s.month === mon).reduce((s, e) => s + Number(e.amount), 0)
  const totalCasualThisMonth = casualEntries.filter(c => c.date.slice(0, 7) === mon).reduce((s, e) => s + Number(e.total_amount), 0)
  const ownerThisMonth = ownerEntries.find(o => o.month === mon)

  const TABS = [
    { id: 'staff' as const, label: 'Staff Ledger' },
    { id: 'casual' as const, label: 'Casual Labour' },
    { id: 'owner' as const, label: 'Owner Salary' },
  ]

  return (
    <div>
      <PageHeader
        title="Staff & Salary"
        subtitle="Staff salaries, advances, and casual labour"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => setAddCasualOpen(true)}>+ Casual Labour</Button>
            <Button size="sm" variant="secondary" onClick={() => setAddAdvanceOpen(true)}><Plus size={14} />Advance</Button>
            <Button size="sm" variant="secondary" onClick={() => setAddSalaryOpen(true)}><Plus size={14} />Salary</Button>
            <Button size="sm" onClick={() => setAddStaffOpen(true)}><Plus size={14} />Add Staff</Button>
          </div>
        }
      />

      {/* Summary strip */}
      <div className="flex flex-wrap gap-6 px-6 py-3 bg-white border-b border-slate-200 text-sm">
        <span className="text-slate-600">{staff.length} active staff</span>
        <span className="text-amber-600">Advances this month: {formatINR(totalAdvancesThisMonth, 0)}</span>
        <span className="text-green-600">Salary paid this month: {formatINR(totalSalaryThisMonth, 0)}</span>
        <span className="text-blue-600">Casual labour this month: {formatINR(totalCasualThisMonth, 0)}</span>
        {ownerThisMonth && <span className="text-purple-600">Owner salary this month: {formatINR(ownerThisMonth.amount, 0)}</span>}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 px-6 pt-4">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
              activeTab === t.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-4">
        {/* Staff Ledger Tab */}
        {activeTab === 'staff' && (
          <>
            {loading && <p className="text-center py-10 text-slate-400">Loading…</p>}
            {!loading && staff.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <p>No staff members yet.</p>
                <button onClick={() => setAddStaffOpen(true)} className="mt-2 text-blue-600 hover:underline text-sm">Add first staff member →</button>
              </div>
            )}
            {staff.map(member => (
              <StaffDetailCard
                key={member.id}
                member={member}
                advances={advances.filter(a => a.staff_id === member.id)}
                salaries={salaries.filter(s => s.staff_id === member.id)}
              />
            ))}
          </>
        )}

        {/* Casual Labour Tab */}
        {activeTab === 'casual' && (
          <>
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-600">{casualEntries.length} entries (last 50)</p>
              <Button size="sm" onClick={() => setAddCasualOpen(true)}><Plus size={14} />Add Entry</Button>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {casualEntries.length === 0 && <p className="text-center py-8 text-slate-400">No casual labour entries</p>}
              {casualEntries.map(c => (
                <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-800">{c.purpose ?? 'Labour'}</p>
                      <p className="text-xs text-slate-500">{formatDate(c.date)} · {c.num_people} people × {formatINR(c.amount_per_person, 0)}</p>
                      {c.notes && <p className="text-xs text-slate-400 mt-0.5">{c.notes}</p>}
                    </div>
                    <p className="font-semibold text-slate-800 shrink-0">{formatINR(c.total_amount, 2)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block rounded-lg border border-slate-200 overflow-hidden bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Date', 'Purpose', 'People', '₹/Person', 'Total', 'Notes'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {casualEntries.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">No entries yet</td></tr>}
                  {casualEntries.map(c => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(c.date)}</td>
                      <td className="px-4 py-3 text-slate-800">{c.purpose ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600 text-right">{c.num_people}</td>
                      <td className="px-4 py-3 text-slate-600 text-right">{formatINR(c.amount_per_person, 2)}</td>
                      <td className="px-4 py-3 font-medium text-slate-800 text-right">{formatINR(c.total_amount, 2)}</td>
                      <td className="px-4 py-3 text-slate-500">{c.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Owner Salary Tab */}
        {activeTab === 'owner' && (
          <>
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-600">Owner salary is deducted from gross profit in Profit Analysis.</p>
              <Button size="sm" onClick={() => setOwnerSalaryOpen(true)}><Plus size={14} />Set This Month</Button>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {ownerEntries.length === 0 && <p className="text-center py-8 text-slate-400">No owner salary entries</p>}
              {ownerEntries.map(o => (
                <div key={o.id} className="rounded-lg border border-slate-200 bg-white p-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-slate-800">{monthLabel(o.month)}</p>
                    {o.notes && <p className="text-xs text-slate-500">{o.notes}</p>}
                  </div>
                  <p className="font-semibold text-purple-700">{formatINR(o.amount, 2)}</p>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block rounded-lg border border-slate-200 overflow-hidden bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Month', 'Amount', 'Notes'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ownerEntries.length === 0 && <tr><td colSpan={3} className="text-center py-8 text-slate-400">No entries yet</td></tr>}
                  {ownerEntries.map(o => (
                    <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-800 font-medium">{monthLabel(o.month)}</td>
                      <td className="px-4 py-3 font-semibold text-purple-700">{formatINR(o.amount, 2)}</td>
                      <td className="px-4 py-3 text-slate-500">{o.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <AddStaffModal open={addStaffOpen} onClose={() => setAddStaffOpen(false)} onSaved={load} />
      <AddAdvanceModal open={addAdvanceOpen} onClose={() => setAddAdvanceOpen(false)} onSaved={load} staff={staff} />
      <RecordSalaryModal open={addSalaryOpen} onClose={() => setAddSalaryOpen(false)} onSaved={load} staff={staff} />
      <AddCasualModal open={addCasualOpen} onClose={() => setAddCasualOpen(false)} onSaved={load} />
      <OwnerSalaryModal open={ownerSalaryOpen} onClose={() => setOwnerSalaryOpen(false)} onSaved={load} existing={ownerEntries.find(o => o.month === mon) ?? null} />
    </div>
  )
}
