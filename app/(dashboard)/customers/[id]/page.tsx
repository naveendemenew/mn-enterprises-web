'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Plus, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField'
import DateInput from '@/components/ui/DateInput'
import { formatINR, formatDate, todayISO, minBackdateISO, currentFinancialYear } from '@/lib/formatters'
import type { PaymentMode } from '@/types/database'

// ─── Record Payment Modal ─────────────────────────────────────────────────────

function RecordPaymentModal({ open, onClose, onSaved, customerId, invoices }: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  customerId: string
  invoices: any[]
}) {
  const supabase = createClient()
  const [form, setForm] = useState({ invoice_id: '', amount: '', date: todayISO(), mode: 'cash' as PaymentMode, notes: '' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const dueInvoices = invoices.filter(i => Number(i.total_amount) - Number(i.amount_paid) > 0)

  useEffect(() => {
    if (open) {
      setForm({ invoice_id: '', amount: '', date: todayISO(), mode: 'cash', notes: '' })
      setErrors({})
    }
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

    const amount = Number(form.amount)

    const { data: recNum } = await supabase.rpc('next_invoice_number', {
      p_type: 'REC', p_year: currentFinancialYear(),
    })
    await supabase.from('payments').insert({
      type: 'received_from_customer',
      customer_id: customerId,
      invoice_id: form.invoice_id || null,
      amount,
      date: form.date,
      mode: form.mode,
      notes: form.notes.trim() || null,
      mn_number: recNum ?? null,
    })

    if (form.invoice_id) {
      const inv = invoices.find(i => i.id === form.invoice_id)
      if (inv) {
        const newPaid = Number(inv.amount_paid) + amount
        const status = newPaid >= Number(inv.total_amount) ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid'
        await supabase.from('invoices').update({ amount_paid: newPaid, payment_status: status }).eq('id', inv.id)
      }
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} title="Record Payment" onClose={onClose} size="md">
      <div className="space-y-4">
        <FormField label="Against Invoice" hint="Optional — leave blank for a general / on-account payment">
          <Select value={form.invoice_id} onChange={set('invoice_id')}>
            <option value="">General / on account</option>
            {dueInvoices.map(i => (
              <option key={i.id} value={i.id}>
                {i.invoice_number ? `${i.invoice_number} — ` : ''}{formatDate(i.date)} (Due {formatINR(Number(i.total_amount) - Number(i.amount_paid), 2)})
              </option>
            ))}
          </Select>
        </FormField>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Amount (₹)" required error={errors.amount}>
            <Input type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" error={!!errors.amount} autoFocus />
          </FormField>
          <FormField label="Date" required error={errors.date} hint="Backdated entries allowed up to 15 days">
            <DateInput value={form.date} onChange={iso => setForm(f => ({ ...f, date: iso }))} min={minBackdateISO()} max={todayISO()} error={!!errors.date} />
          </FormField>
        </div>

        <FormField label="Mode">
          <Select value={form.mode} onChange={set('mode')}>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="bank">Bank Transfer</option>
            <option value="card">Card</option>
          </Select>
        </FormField>

        <FormField label="Notes">
          <Textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Optional" />
        </FormField>

        <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Save Payment</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Report Damage Modal ──────────────────────────────────────────────────────

function ReportDamageModal({ open, onClose, onSaved, customerId, invoices }: {
  open: boolean; onClose: () => void; onSaved: () => void; customerId: string; invoices: any[]
}) {
  const supabase = createClient()
  const [form, setForm] = useState({ invoice_id: '', sku_id: '', units: '', credit_amount: '', resolution: 'credit_note', notes: '' })
  const [skus, setSkus] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setForm({ invoice_id: '', sku_id: '', units: '', credit_amount: '', resolution: 'credit_note', notes: '' })
      setErrors({})
    }
  }, [open])

  // Load SKUs from the selected invoice's stock_movements
  useEffect(() => {
    if (!form.invoice_id) { setSkus([]); return }
    supabase
      .from('stock_movements')
      .select('sku_id, skus(id, name, units_per_case)')
      .eq('reference_invoice_id', form.invoice_id)
      .eq('movement_type', 'outward')
      .then(({ data }) => {
        const unique = Object.values(
          Object.fromEntries((data ?? []).map((m: any) => [m.sku_id, m.skus]))
        ).filter(Boolean)
        setSkus(unique as any[])
      })
  }, [form.invoice_id])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    const e: Record<string, string> = {}
    if (!form.invoice_id) e.invoice_id = 'Select an invoice'
    if (!form.units || Number(form.units) < 1) e.units = 'Enter number of damaged units'
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)

    const units = Number(form.units)
    const creditAmount = Number(form.credit_amount) || 0

    // Create damage stock movement
    const { data: dmgMv } = await supabase.from('stock_movements').insert({
      sku_id: form.sku_id || null,
      movement_type: 'damage' as const,
      date: new Date().toISOString().slice(0, 10),
      cases: 0,
      loose_units: units,
      total_bottles: units,
      price_per_bottle: null,
      is_free_stock: false,
      customer_id: customerId,
      reference_invoice_id: form.invoice_id,
      notes: `Customer damage complaint — ${units} units`,
    }).select('id').single()

    // Create damage_record
    await supabase.from('damage_records').insert({
      type: 'customer_complaint',
      date: new Date().toISOString().slice(0, 10),
      sku_id: form.sku_id || null,
      units,
      customer_id: customerId,
      linked_invoice_id: form.invoice_id,
      stock_movement_id: dmgMv?.id ?? null,
      credit_amount: creditAmount > 0 ? creditAmount : null,
      status: 'pending',
      resolution: form.resolution as any,
      notes: form.notes.trim() || null,
    })

    // If credit note: reduce invoice's amount_paid or reduce total_amount
    if (form.resolution === 'credit_note' && creditAmount > 0 && form.invoice_id) {
      const inv = invoices.find(i => i.id === form.invoice_id)
      if (inv) {
        const newTotal = Math.max(0, Number(inv.total_amount) - creditAmount)
        const newPaid = Math.min(Number(inv.amount_paid), newTotal)
        const status = newPaid >= newTotal ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid'
        await supabase.from('invoices').update({ total_amount: newTotal, amount_paid: newPaid, payment_status: status }).eq('id', form.invoice_id)
      }
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} title="Report Customer Damage" onClose={onClose} size="md">
      <div className="space-y-4">
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          Damaged units will be removed from sellable stock. If credit note is chosen, the invoice total will be reduced.
        </div>
        <FormField label="Invoice" required error={errors.invoice_id} hint="Select the sale invoice this damage is against">
          <Select value={form.invoice_id} onChange={set('invoice_id')} error={!!errors.invoice_id}>
            <option value="">Select invoice</option>
            {invoices.map(i => (
              <option key={i.id} value={i.id}>
                {i.invoice_number ? `${i.invoice_number} — ` : ''}{new Date(i.date).toLocaleDateString('en-IN')} ({formatINR(i.total_amount, 2)})
              </option>
            ))}
          </Select>
        </FormField>
        {skus.length > 0 && (
          <FormField label="SKU (optional)" hint="Which product was damaged">
            <Select value={form.sku_id} onChange={set('sku_id')}>
              <option value="">Not specified</option>
              {skus.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </FormField>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Damaged Units" required error={errors.units}>
            <Input type="number" min="1" value={form.units} onChange={set('units')} placeholder="0" error={!!errors.units} autoFocus />
          </FormField>
          <FormField label="Resolution">
            <Select value={form.resolution} onChange={set('resolution')}>
              <option value="credit_note">Credit note (reduce invoice)</option>
              <option value="replacement">Replacement stock</option>
              <option value="written_off">Written off</option>
            </Select>
          </FormField>
        </div>
        {form.resolution === 'credit_note' && (
          <FormField label="Credit Amount (₹)" hint="Amount to deduct from invoice total">
            <Input type="number" min="0" step="0.01" value={form.credit_amount} onChange={set('credit_amount')} placeholder="0.00" />
          </FormField>
        )}
        <FormField label="Notes">
          <Textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Describe the damage" />
        </FormField>
        <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Report Damage</Button>
        </div>
      </div>
    </Modal>
  )
}

export default function CustomerDetailPage() {
  const supabase = createClient()
  const params = useParams<{ id: string }>()
  const customerId = params.id
  const [customer, setCustomer] = useState<any>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [payOpen, setPayOpen] = useState(false)
  const [damageOpen, setDamageOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [custRes, invRes, payRes] = await Promise.all([
      supabase.from('customers').select('*').eq('id', customerId).single(),
      supabase.from('invoices').select('*, invoice_number').eq('customer_id', customerId).order('date', { ascending: false }),
      supabase.from('payments').select('*').eq('customer_id', customerId).order('date', { ascending: false }),
    ])
    setCustomer(custRes.data)
    setInvoices(invRes.data ?? [])
    setPayments(payRes.data ?? [])
    setLoading(false)
  }, [customerId])

  useEffect(() => { load() }, [load])

  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total_amount), 0)
  const totalPaid = invoices.reduce((s, i) => s + Number(i.amount_paid), 0)
  const totalDue = totalInvoiced - totalPaid

  // Combined chronological ledger with running balance (debit = invoiced, credit = paid)
  const ledger = [
    ...invoices.map(i => ({ date: i.date, created_at: i.created_at, type: 'Invoice', description: i.invoice_number ? `Invoice ${i.invoice_number}` : 'Sale invoice', debit: Number(i.total_amount), credit: 0 })),
    ...payments.map(p => ({ date: p.date, created_at: p.created_at, type: 'Payment', description: `${p.mn_number ? p.mn_number + ' — ' : ''}Payment received (${p.mode})${p.notes ? ' — ' + p.notes : ''}`, debit: 0, credit: Number(p.amount) })),
  ]
    .sort((a, b) => a.date === b.date ? a.created_at.localeCompare(b.created_at) : a.date.localeCompare(b.date))
    .reduce<{ date: string; type: string; description: string; debit: number; credit: number; balance: number }[]>((acc, entry) => {
      const prevBalance = acc.length > 0 ? acc[acc.length - 1].balance : 0
      acc.push({ ...entry, balance: prevBalance + entry.debit - entry.credit })
      return acc
    }, [])
    .reverse()

  const statusBadge = (status: string) => {
    const cls = { paid: 'bg-green-100 text-green-700', partial: 'bg-amber-100 text-amber-700', unpaid: 'bg-red-100 text-red-700' }
    return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${cls[status as keyof typeof cls]}`}>{status}</span>
  }

  if (loading) return <div className="p-8 text-slate-400">Loading…</div>
  if (!customer) return <div className="p-8 text-slate-400">Customer not found.</div>

  return (
    <div>
      <PageHeader
        title={customer.name}
        subtitle={`${customer.phone ?? ''} — ${customer.address ?? ''} — Credit: ${customer.credit_period_days} days`}
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={() => setPayOpen(true)} size="sm"><Plus size={14} />Record Payment</Button>
            <Button onClick={() => setDamageOpen(true)} size="sm" variant="secondary"><AlertTriangle size={14} />Report Damage</Button>
            <Link href="/customers" className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
              <ArrowLeft size={14} />All Customers
            </Link>
          </div>
        }
      />

      {/* Summary */}
      <div className="flex flex-wrap gap-6 px-6 py-4 bg-white border-b border-slate-200">
        <div className="text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Invoiced</p>
          <p className="text-lg font-semibold text-slate-800">{formatINR(totalInvoiced, 2)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Paid</p>
          <p className="text-lg font-semibold text-green-600">{formatINR(totalPaid, 2)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Outstanding</p>
          <p className={`text-lg font-semibold ${totalDue > 0 ? 'text-red-600' : 'text-slate-600'}`}>{formatINR(totalDue, 2)}</p>
        </div>
      </div>

      {/* Ledger */}
      <div className="p-6 pb-0">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Account Ledger</h2>

        {/* Mobile card list */}
        <div className="md:hidden space-y-2">
          {ledger.length === 0 && <p className="text-center py-6 text-slate-400">No transactions yet</p>}
          {ledger.map((l, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${l.type === 'Invoice' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {l.type}
                  </span>
                  <p className="text-xs text-slate-500 mt-1">{l.description}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatDate(l.date)}</p>
                </div>
                <div className="text-right shrink-0">
                  {l.debit > 0 && <p className="text-red-600 font-medium">{formatINR(l.debit, 2)}</p>}
                  {l.credit > 0 && <p className="text-green-600 font-medium">{formatINR(l.credit, 2)}</p>}
                  <p className="text-xs text-slate-500 mt-0.5">Bal: {formatINR(l.balance, 2)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Date', 'Type', 'Description', 'Invoiced (Dr)', 'Paid (Cr)', 'Balance Due'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-slate-400">No transactions yet</td></tr>}
              {ledger.map((l, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDate(l.date)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${l.type === 'Invoice' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {l.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{l.description}</td>
                  <td className="px-3 py-2 text-red-600">{l.debit > 0 ? formatINR(l.debit, 2) : '—'}</td>
                  <td className="px-3 py-2 text-green-600">{l.credit > 0 ? formatINR(l.credit, 2) : '—'}</td>
                  <td className="px-3 py-2 font-semibold text-slate-800">{formatINR(l.balance, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoices */}
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Invoices</h2>

          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {invoices.length === 0 && <p className="text-center py-6 text-slate-400">No invoices</p>}
            {invoices.map(inv => (
              <div key={inv.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {inv.invoice_number && <p className="text-xs font-mono text-blue-600 font-medium">{inv.invoice_number}</p>}
                    <p className="text-xs text-slate-400">{formatDate(inv.date)}</p>
                    <div className="mt-1">{statusBadge(inv.payment_status)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-slate-800">{formatINR(inv.total_amount, 2)}</p>
                    <p className="text-xs text-green-600">Paid {formatINR(inv.amount_paid, 2)}</p>
                    <p className="text-xs text-red-600 font-medium">Due {formatINR(inv.total_amount - inv.amount_paid, 2)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Invoice #', 'Date', 'Amount', 'Paid', 'Due', 'Status'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-slate-400">No invoices</td></tr>}
                {invoices.map(inv => (
                  <tr key={inv.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-xs font-mono text-blue-600">{inv.invoice_number ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(inv.date)}</td>
                    <td className="px-3 py-2 text-slate-800">{formatINR(inv.total_amount, 2)}</td>
                    <td className="px-3 py-2 text-green-600">{formatINR(inv.amount_paid, 2)}</td>
                    <td className="px-3 py-2 font-medium text-red-600">{formatINR(inv.total_amount - inv.amount_paid, 2)}</td>
                    <td className="px-3 py-2">{statusBadge(inv.payment_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payments received */}
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Payments Received</h2>

          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {payments.length === 0 && <p className="text-center py-6 text-slate-400">No payments recorded</p>}
            {payments.map(p => (
              <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-slate-600 capitalize">{p.mode}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(p.date)}</p>
                    {p.notes && <p className="text-xs text-slate-500 mt-1">{p.notes}</p>}
                  </div>
                  <p className="font-semibold text-green-600 shrink-0">{formatINR(p.amount, 2)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Date', 'Amount', 'Mode', 'Notes'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-slate-400">No payments recorded</td></tr>}
                {payments.map(p => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-600">{formatDate(p.date)}</td>
                    <td className="px-3 py-2 font-medium text-green-600">{formatINR(p.amount, 2)}</td>
                    <td className="px-3 py-2 text-slate-600 capitalize">{p.mode}</td>
                    <td className="px-3 py-2 text-slate-500">{p.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <RecordPaymentModal open={payOpen} onClose={() => setPayOpen(false)} onSaved={load} customerId={customerId} invoices={invoices} />
      <ReportDamageModal open={damageOpen} onClose={() => setDamageOpen(false)} onSaved={load} customerId={customerId} invoices={invoices} />
    </div>
  )
}
