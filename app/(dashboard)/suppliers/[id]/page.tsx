'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField'
import { formatINR, formatDate, todayISO, minBackdateISO } from '@/lib/formatters'
import type { PaymentMode } from '@/types/database'

// ─── Record Payment Modal ─────────────────────────────────────────────────────

function RecordPaymentModal({ open, onClose, onSaved, brandId, bills }: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  brandId: string
  bills: any[]
}) {
  const supabase = createClient()
  const [form, setForm] = useState({ purchase_bill_id: '', amount: '', date: todayISO(), mode: 'cash' as PaymentMode, notes: '' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const dueBills = bills.filter(b => Number(b.total_amount) - Number(b.amount_paid) > 0)

  useEffect(() => {
    if (open) {
      setForm({ purchase_bill_id: '', amount: '', date: todayISO(), mode: 'cash', notes: '' })
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

    await supabase.from('payments').insert({
      type: 'paid_to_brand',
      brand_id: brandId,
      purchase_bill_id: form.purchase_bill_id || null,
      amount,
      date: form.date,
      mode: form.mode,
      notes: form.notes.trim() || null,
    })

    if (form.purchase_bill_id) {
      const bill = bills.find(b => b.id === form.purchase_bill_id)
      if (bill) {
        const newPaid = Number(bill.amount_paid) + amount
        const status = newPaid >= Number(bill.total_amount) ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid'
        await supabase.from('purchase_bills').update({ amount_paid: newPaid, payment_status: status }).eq('id', bill.id)
      }
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} title="Record Payment" onClose={onClose} size="md">
      <div className="space-y-4">
        <FormField label="Against Bill" hint="Optional — leave blank for a general / on-account payment">
          <Select value={form.purchase_bill_id} onChange={set('purchase_bill_id')}>
            <option value="">General / on account</option>
            {dueBills.map(b => (
              <option key={b.id} value={b.id}>
                {formatDate(b.date)} — {b.invoice_number ?? 'No invoice #'} (Due {formatINR(Number(b.total_amount) - Number(b.amount_paid), 2)})
              </option>
            ))}
          </Select>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Amount (₹)" required error={errors.amount}>
            <Input type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" error={!!errors.amount} autoFocus />
          </FormField>
          <FormField label="Date" required error={errors.date} hint="Backdated entries allowed up to 15 days">
            <Input type="date" value={form.date} onChange={set('date')} min={minBackdateISO()} max={todayISO()} error={!!errors.date} />
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

export default function SupplierDetailPage() {
  const supabase = createClient()
  const params = useParams<{ id: string }>()
  const brandId = params.id
  const [brand, setBrand] = useState<any>(null)
  const [bills, setBills] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [payOpen, setPayOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [brandRes, billRes, payRes] = await Promise.all([
      supabase.from('brands').select('*, categories(name)').eq('id', brandId).single(),
      supabase.from('purchase_bills').select('*').eq('brand_id', brandId).order('date', { ascending: false }),
      supabase.from('payments').select('*').eq('brand_id', brandId).order('date', { ascending: false }),
    ])
    setBrand(brandRes.data)
    setBills(billRes.data ?? [])
    setPayments(payRes.data ?? [])
    setLoading(false)
  }, [brandId])

  useEffect(() => { load() }, [load])

  const totalBilled = bills.reduce((s, b) => s + Number(b.total_amount), 0)
  const totalPaid = bills.reduce((s, b) => s + Number(b.amount_paid), 0)
  const totalDue = totalBilled - totalPaid

  // Combined chronological ledger with running payable balance (debit = billed, credit = paid)
  const ledger = [
    ...bills.map(b => ({ date: b.date, created_at: b.created_at, type: 'Bill', description: b.invoice_number ? `Purchase bill #${b.invoice_number}` : 'Purchase bill', debit: Number(b.total_amount), credit: 0 })),
    ...payments.map(p => ({ date: p.date, created_at: p.created_at, type: 'Payment', description: `Payment made (${p.mode})${p.notes ? ' — ' + p.notes : ''}`, debit: 0, credit: Number(p.amount) })),
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
  if (!brand) return <div className="p-8 text-slate-400">Brand not found.</div>

  return (
    <div>
      <PageHeader
        title={brand.name}
        subtitle={`${brand.contact_name ?? ''} ${brand.contact_phone ? `· ${brand.contact_phone}` : ''} · ${brand.payment_terms ?? 'No payment terms'}`}
        actions={
          <div className="flex items-center gap-3">
            <Button onClick={() => setPayOpen(true)} size="sm"><Plus size={14} />Record Payment</Button>
            <Link href="/suppliers" className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
              <ArrowLeft size={14} />All Suppliers
            </Link>
          </div>
        }
      />

      <div className="flex gap-6 px-6 py-4 bg-white border-b border-slate-200">
        <div className="text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Billed</p>
          <p className="text-lg font-semibold text-slate-800">{formatINR(totalBilled, 2)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Paid</p>
          <p className="text-lg font-semibold text-green-600">{formatINR(totalPaid, 2)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Payable</p>
          <p className={`text-lg font-semibold ${totalDue > 0 ? 'text-red-600' : 'text-slate-600'}`}>{formatINR(totalDue, 2)}</p>
        </div>
      </div>

      {/* Ledger */}
      <div className="p-6 pb-0">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Account Ledger</h2>
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Date', 'Type', 'Description', 'Billed (Dr)', 'Paid (Cr)', 'Balance Payable'].map(h => (
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
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${l.type === 'Bill' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
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
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Purchase Bills</h2>
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Date', 'Invoice #', 'Amount', 'Paid', 'Due', 'Status'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bills.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-slate-400">No bills</td></tr>}
                {bills.map(b => (
                  <tr key={b.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-600">{formatDate(b.date)}</td>
                    <td className="px-3 py-2 text-slate-600">{b.invoice_number ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-800">{formatINR(b.total_amount, 2)}</td>
                    <td className="px-3 py-2 text-green-600">{formatINR(b.amount_paid, 2)}</td>
                    <td className="px-3 py-2 font-medium text-red-600">{formatINR(b.total_amount - b.amount_paid, 2)}</td>
                    <td className="px-3 py-2">{statusBadge(b.payment_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Payments Made</h2>
          <div className="rounded-lg border border-slate-200 overflow-hidden">
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
                    <td className="px-3 py-2 font-medium text-slate-800">{formatINR(p.amount, 2)}</td>
                    <td className="px-3 py-2 text-slate-600 capitalize">{p.mode}</td>
                    <td className="px-3 py-2 text-slate-500">{p.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <RecordPaymentModal open={payOpen} onClose={() => setPayOpen(false)} onSaved={load} brandId={brandId} bills={bills} />
    </div>
  )
}
