'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronRight, DollarSign } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField'
import DateInput from '@/components/ui/DateInput'
import { formatINR, formatDate, todayISO, minBackdateISO } from '@/lib/formatters'
import type { BrandPayableRow } from '@/types/database'

// ─── Record Payment to Brand ──────────────────────────────────────────────────

function PayBrandModal({ open, onClose, onSaved, brandId, brandName }: {
  open: boolean; onClose: () => void; onSaved: () => void
  brandId: string; brandName: string
}) {
  const supabase = createClient()
  const [bills, setBills] = useState<any[]>([])
  const [form, setForm] = useState({ amount: '', date: todayISO(), mode: 'cash', bill_id: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setForm({ amount: '', date: todayISO(), mode: 'cash', bill_id: '', notes: '' })
    setErrors({})
    supabase.from('purchase_bills')
      .select('*')
      .eq('brand_id', brandId)
      .in('payment_status', ['unpaid', 'partial'])
      .order('date')
      .then(({ data }) => setBills(data ?? []))
  }, [open, brandId])

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

    await supabase.from('payments').insert({
      type: 'paid_to_brand',
      brand_id: brandId,
      purchase_bill_id: form.bill_id || null,
      amount: Number(form.amount),
      date: form.date,
      mode: form.mode,
      notes: form.notes.trim() || null,
    })

    if (form.bill_id) {
      const bill = bills.find(b => b.id === form.bill_id)
      if (bill) {
        const newPaid = Number(bill.amount_paid) + Number(form.amount)
        const status = newPaid >= bill.total_amount ? 'paid' : 'partial'
        await supabase.from('purchase_bills').update({ amount_paid: Math.min(newPaid, bill.total_amount), payment_status: status }).eq('id', form.bill_id)
      }
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} title={`Pay to Brand — ${brandName}`} onClose={onClose} size="md">
      <div className="space-y-4">
        {bills.length > 0 && (
          <FormField label="Apply to Bill (optional)">
            <Select value={form.bill_id} onChange={set('bill_id')}>
              <option value="">No specific bill (general payment)</option>
              {bills.map(b => (
                <option key={b.id} value={b.id}>
                  {formatDate(b.date)} {b.invoice_number ? `#${b.invoice_number}` : ''} — {formatINR(b.total_amount - b.amount_paid, 2)} pending
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
            <option value="card">Card</option>
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

// ─── Suppliers Page ───────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<BrandPayableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [payModal, setPayModal] = useState<{ id: string; name: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('brand_payables')
      .select('*')
      .order('total_payable', { ascending: false })
    setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const totalPayable = rows.reduce((s, r) => s + Number(r.total_payable), 0)

  return (
    <div>
      <PageHeader title="Suppliers / Brands" subtitle="Amounts payable to brand suppliers" />

      {!loading && (
        <div className="flex gap-6 px-6 py-3 bg-white border-b border-slate-200 text-sm">
          <span className="text-red-600 font-semibold">Total payable: {formatINR(totalPayable, 0)}</span>
          <span className="text-slate-500">{rows.length} suppliers</span>
        </div>
      )}

      {/* Mobile card list */}
      <div className="p-4 md:hidden space-y-2">
        {loading && <p className="text-center py-10 text-slate-400">Loading…</p>}
        {!loading && rows.length === 0 && (
          <p className="text-center py-12 text-slate-400">No suppliers yet. Add brands in Settings.</p>
        )}
        {rows.map(r => (
          <div key={r.brand_id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/suppliers/${r.brand_id}`} className="font-medium text-blue-600 hover:underline truncate block">
                  {r.brand_name}
                </Link>
                <p className="text-xs text-slate-500 mt-0.5">{r.payment_terms ?? 'No payment terms'}</p>
                {Number(r.bill_count) > 0 && <p className="text-xs text-slate-400 mt-0.5">{r.bill_count} open bills</p>}
              </div>
              <div className="text-right shrink-0">
                {Number(r.total_payable) > 0
                  ? <span className="text-base font-semibold text-red-600">{formatINR(Number(r.total_payable), 2)}</span>
                  : <span className="text-green-600 text-xs font-medium">Settled</span>
                }
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              {Number(r.total_payable) > 0 && (
                <button
                  onClick={() => setPayModal({ id: r.brand_id, name: r.brand_name })}
                  className="flex-1 flex items-center justify-center gap-1 text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 min-h-11 rounded-lg transition-colors"
                >
                  <DollarSign size={14} />Pay
                </button>
              )}
              <Link href={`/suppliers/${r.brand_id}`} className="flex-1 flex items-center justify-center gap-1 text-sm font-medium bg-slate-50 text-slate-700 hover:bg-slate-100 min-h-11 rounded-lg transition-colors">
                Ledger <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block p-6">
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Brand / Supplier', 'Payment Terms', 'Open Bills', 'Total Payable', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="text-center py-10 text-slate-400">Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-slate-400">No suppliers yet. Add brands in Settings.</td></tr>
              )}
              {rows.map(r => (
                <tr key={r.brand_id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/suppliers/${r.brand_id}`} className="font-medium text-blue-600 hover:underline">{r.brand_name}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.payment_terms ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600 text-center">{Number(r.bill_count) > 0 ? r.bill_count : '—'}</td>
                  <td className="px-4 py-3">
                    {Number(r.total_payable) > 0
                      ? <span className="font-semibold text-red-600">{formatINR(Number(r.total_payable), 2)}</span>
                      : <span className="text-green-600 text-xs font-medium">Settled</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {Number(r.total_payable) > 0 && (
                        <button
                          onClick={() => setPayModal({ id: r.brand_id, name: r.brand_name })}
                          className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
                        >
                          <DollarSign size={11} />Pay
                        </button>
                      )}
                      <Link href={`/suppliers/${r.brand_id}`} className="flex items-center gap-0.5 text-xs text-blue-600 hover:underline">
                        Ledger <ChevronRight size={12} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {payModal && (
        <PayBrandModal
          open={!!payModal} onClose={() => setPayModal(null)} onSaved={load}
          brandId={payModal.id} brandName={payModal.name}
        />
      )}
    </div>
  )
}
