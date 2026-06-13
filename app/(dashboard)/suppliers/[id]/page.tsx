'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/ui/PageHeader'
import { formatINR, formatDate } from '@/lib/formatters'

export default function SupplierDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const [brand, setBrand] = useState<any>(null)
  const [bills, setBills] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [brandRes, billRes, payRes] = await Promise.all([
      supabase.from('brands').select('*, categories(name)').eq('id', params.id).single(),
      supabase.from('purchase_bills').select('*').eq('brand_id', params.id).order('date', { ascending: false }),
      supabase.from('payments').select('*').eq('brand_id', params.id).order('date', { ascending: false }),
    ])
    setBrand(brandRes.data)
    setBills(billRes.data ?? [])
    setPayments(payRes.data ?? [])
    setLoading(false)
  }, [params.id])

  useEffect(() => { load() }, [load])

  const totalBilled = bills.reduce((s, b) => s + Number(b.total_amount), 0)
  const totalPaid = bills.reduce((s, b) => s + Number(b.amount_paid), 0)
  const totalDue = totalBilled - totalPaid

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
          <Link href="/suppliers" className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
            <ArrowLeft size={14} />All Suppliers
          </Link>
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
    </div>
  )
}
