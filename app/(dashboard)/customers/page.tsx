'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronRight, AlertTriangle, DollarSign } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField'
import DateInput from '@/components/ui/DateInput'
import { formatINR, formatDate, formatNumber, todayISO, minBackdateISO, currentFinancialYear } from '@/lib/formatters'
import type { CustomerDueRow } from '@/types/database'

// ─── Record Payment Modal ─────────────────────────────────────────────────────

function RecordPaymentModal({ open, onClose, onSaved, customerId, customerName }: {
  open: boolean; onClose: () => void; onSaved: () => void
  customerId: string; customerName: string
}) {
  const supabase = createClient()
  const [invoices, setInvoices] = useState<any[]>([])
  const [form, setForm] = useState({ amount: '', date: todayISO(), mode: 'cash', invoice_id: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setForm({ amount: '', date: todayISO(), mode: 'cash', invoice_id: '', notes: '' })
    setErrors({})
    supabase.from('invoices')
      .select('*')
      .eq('customer_id', customerId)
      .in('payment_status', ['unpaid', 'partial'])
      .order('date')
      .then(({ data }) => setInvoices(data ?? []))
  }, [open, customerId])

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

    const { data: recNum } = await supabase.rpc('next_invoice_number', {
      p_type: 'REC', p_year: currentFinancialYear(),
    })
    await supabase.from('payments').insert({
      type: 'received_from_customer',
      customer_id: customerId,
      invoice_id: form.invoice_id || null,
      amount: Number(form.amount),
      date: form.date,
      mode: form.mode,
      notes: form.notes.trim() || null,
      mn_number: recNum ?? null,
    })

    // Update invoice payment status if linked
    if (form.invoice_id) {
      const inv = invoices.find(i => i.id === form.invoice_id)
      if (inv) {
        const newPaid = Number(inv.amount_paid) + Number(form.amount)
        const status = newPaid >= inv.total_amount ? 'paid' : 'partial'
        await supabase.from('invoices').update({ amount_paid: Math.min(newPaid, inv.total_amount), payment_status: status }).eq('id', form.invoice_id)
      }
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} title={`Record Payment — ${customerName}`} onClose={onClose} size="md">
      <div className="space-y-4">
        {invoices.length > 0 && (
          <FormField label="Apply to Invoice (optional)">
            <Select value={form.invoice_id} onChange={set('invoice_id')}>
              <option value="">No specific invoice (general payment)</option>
              {invoices.map(i => (
                <option key={i.id} value={i.id}>
                  {formatDate(i.date)} — {formatINR(i.total_amount - i.amount_paid, 2)} pending
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Amount (₹)" required error={errors.amount}>
            <Input type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" error={!!errors.amount} autoFocus />
          </FormField>
          <FormField label="Date" required error={errors.date} hint="Backdated entries allowed up to 15 days">
            <DateInput value={form.date} onChange={iso => setForm(f => ({ ...f, date: iso }))} min={minBackdateISO()} max={todayISO()} error={!!errors.date} />
          </FormField>
        </div>
        <FormField label="Payment Mode">
          <Select value={form.mode} onChange={set('mode')}>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="bank">Bank Transfer</option>
          </Select>
        </FormField>
        <FormField label="Notes">
          <Textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Optional" />
        </FormField>
        <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Record Payment</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Customers Page ───────────────────────────────────────────────────────────

export default function CustomersPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<CustomerDueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [payModal, setPayModal] = useState<{ id: string; name: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('customer_outstanding_dues')
      .select('*')
      .order('total_due', { ascending: false })
    setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const totalDue = rows.reduce((s, r) => s + Number(r.total_due), 0)
  const overdueRows = rows.filter(r => r.days_outstanding != null && r.credit_period_days != null && Number(r.days_outstanding) > Number(r.credit_period_days))

  return (
    <div>
      <PageHeader
        title="Customers / Dues"
        subtitle="Outstanding dues and payment status per customer"
      />

      {!loading && (
        <div className="flex flex-wrap gap-6 px-6 py-3 bg-white border-b border-slate-200 text-sm">
          <span className="text-red-600 font-semibold">Total due: {formatINR(totalDue, 0)}</span>
          <span className="text-slate-500">{rows.length} customers</span>
          {overdueRows.length > 0 && (
            <span className="flex items-center gap-1 text-amber-600 font-medium">
              <AlertTriangle size={14} />{overdueRows.length} overdue
            </span>
          )}
        </div>
      )}

      {/* Mobile card list */}
      <div className="p-4 md:hidden space-y-2">
        {loading && <p className="text-center py-10 text-slate-400">Loading…</p>}
        {!loading && rows.length === 0 && (
          <p className="text-center py-12 text-slate-400">No customers yet. Add customers in Settings.</p>
        )}
        {rows.map(r => {
          const daysOut = r.days_outstanding != null ? Number(r.days_outstanding) : null
          const isOverdue = daysOut != null && r.credit_period_days != null && daysOut > Number(r.credit_period_days)
          const hasDue = Number(r.total_due) > 0
          return (
            <div key={r.customer_id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/customers/${r.customer_id}`} className="font-medium text-blue-600 hover:underline truncate block">
                    {r.customer_name}
                  </Link>
                  {daysOut != null && hasDue && (
                    <span className={`flex items-center gap-1 text-xs mt-0.5 ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                      {isOverdue && <AlertTriangle size={12} />}
                      {daysOut} days outstanding
                    </span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {hasDue
                    ? <span className={`text-base font-semibold ${isOverdue ? 'text-red-600' : 'text-slate-800'}`}>{formatINR(Number(r.total_due), 2)}</span>
                    : <span className="text-green-600 text-xs font-medium">Settled</span>
                  }
                </div>
              </div>
              {hasDue && (
                <button
                  onClick={() => setPayModal({ id: r.customer_id, name: r.customer_name })}
                  className="mt-3 w-full flex items-center justify-center gap-1 text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 min-h-11 rounded-lg transition-colors"
                >
                  <DollarSign size={14} />Record Payment
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="hidden md:block p-6">
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Customer', 'Phone', 'Invoices', 'Oldest Invoice', 'Days Outstanding', 'Credit Period', 'Total Due', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="text-center py-10 text-slate-400">Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400">No customers yet. Add customers in Settings.</td></tr>
              )}
              {rows.map(r => {
                const daysOut = r.days_outstanding != null ? Number(r.days_outstanding) : null
                const isOverdue = daysOut != null && r.credit_period_days != null && daysOut > Number(r.credit_period_days)
                const hasDue = Number(r.total_due) > 0
                return (
                  <tr key={r.customer_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/customers/${r.customer_id}`} className="font-medium text-blue-600 hover:underline">
                        {r.customer_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600 text-center">{Number(r.invoice_count) > 0 ? r.invoice_count : '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{r.oldest_invoice_date ? formatDate(r.oldest_invoice_date) : '—'}</td>
                    <td className="px-4 py-3">
                      {daysOut != null && hasDue ? (
                        <span className={`flex items-center gap-1 font-medium ${isOverdue ? 'text-red-600' : 'text-slate-700'}`}>
                          {isOverdue && <AlertTriangle size={13} />}
                          {daysOut} days
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.credit_period_days} days</td>
                    <td className="px-4 py-3">
                      {hasDue
                        ? <span className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-slate-800'}`}>{formatINR(Number(r.total_due), 2)}</span>
                        : <span className="text-green-600 text-xs font-medium">Settled</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {hasDue && (
                          <button
                            onClick={() => setPayModal({ id: r.customer_id, name: r.customer_name })}
                            className="flex items-center gap-1 text-xs bg-green-50 text-green-700 hover:bg-green-100 px-2 py-1 rounded transition-colors"
                          >
                            <DollarSign size={11} />Pay
                          </button>
                        )}
                        <Link href={`/customers/${r.customer_id}`} className="flex items-center gap-0.5 text-xs text-blue-600 hover:underline">
                          Ledger <ChevronRight size={12} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {payModal && (
        <RecordPaymentModal
          open={!!payModal}
          onClose={() => setPayModal(null)}
          onSaved={load}
          customerId={payModal.id}
          customerName={payModal.name}
        />
      )}
    </div>
  )
}
