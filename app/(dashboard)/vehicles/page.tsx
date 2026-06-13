'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Fuel } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField'
import { formatDate, formatNumber, todayISO, minBackdateISO } from '@/lib/formatters'
import type { Vehicle, Driver } from '@/types/database'

interface LogRow {
  id: string; date: string; vehicle_name: string; driver_name: string | null
  odo_start: number | null; odo_end: number | null; km_travelled: number | null
  diesel_litres: number | null; diesel_rate: number | null; diesel_amount: number | null
}

function AddLogModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [form, setForm] = useState({
    vehicle_id: '', driver_id: '', date: todayISO(),
    odo_start: '', odo_end: '', diesel_litres: '', diesel_rate: '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setForm({ vehicle_id: '', driver_id: '', date: todayISO(), odo_start: '', odo_end: '', diesel_litres: '', diesel_rate: '' })
    setErrors({})
    Promise.all([
      supabase.from('vehicles').select('*').order('name'),
      supabase.from('drivers').select('*').order('name'),
    ]).then(([vRes, dRes]) => { setVehicles(vRes.data ?? []); setDrivers(dRes.data ?? []) })
  }, [open])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const oStart = Number(form.odo_start) || null
  const oEnd = Number(form.odo_end) || null
  const km = oStart != null && oEnd != null ? oEnd - oStart : null
  const litres = Number(form.diesel_litres) || null
  const rate = Number(form.diesel_rate) || null
  const dieselAmt = litres != null && rate != null ? litres * rate : null

  const save = async () => {
    const e: Record<string, string> = {}
    if (!form.vehicle_id) e.vehicle_id = 'Required'
    if (!form.date) e.date = 'Required'
    else if (form.date < minBackdateISO()) e.date = 'Date cannot be more than 15 days in the past'
    else if (form.date > todayISO()) e.date = 'Date cannot be in the future'
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    await supabase.from('vehicle_logs').insert({
      vehicle_id: form.vehicle_id,
      driver_id: form.driver_id || null,
      date: form.date,
      odo_start: oStart,
      odo_end: oEnd,
      diesel_litres: litres,
      diesel_rate: rate,
    })
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} title="Add Vehicle Log Entry" onClose={onClose} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Vehicle" required error={errors.vehicle_id}>
            <Select value={form.vehicle_id} onChange={set('vehicle_id')} error={!!errors.vehicle_id}>
              <option value="">Select vehicle</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} {v.registration_number ? `(${v.registration_number})` : ''}</option>)}
            </Select>
          </FormField>
          <FormField label="Driver">
            <Select value={form.driver_id} onChange={set('driver_id')}>
              <option value="">None / Not assigned</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </FormField>
        </div>
        <FormField label="Date" required error={errors.date} hint="Backdated entries allowed up to 15 days">
          <Input type="date" value={form.date} onChange={set('date')} min={minBackdateISO()} max={todayISO()} error={!!errors.date} />
        </FormField>

        <div className="border border-slate-200 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Odometer</p>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start (km)">
              <Input type="number" min="0" value={form.odo_start} onChange={set('odo_start')} placeholder="e.g. 12500" />
            </FormField>
            <FormField label="End (km)">
              <Input type="number" min="0" value={form.odo_end} onChange={set('odo_end')} placeholder="e.g. 12650" />
            </FormField>
          </div>
          {km != null && <p className="text-sm text-blue-600 font-medium">Distance: {km} km</p>}
        </div>

        <div className="border border-slate-200 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1"><Fuel size={12} />Diesel Fill</p>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Litres" hint="Leave blank if no diesel today">
              <Input type="number" min="0" step="0.01" value={form.diesel_litres} onChange={set('diesel_litres')} placeholder="0.00" />
            </FormField>
            <FormField label="Rate (₹/litre)">
              <Input type="number" min="0" step="0.01" value={form.diesel_rate} onChange={set('diesel_rate')} placeholder="0.00" />
            </FormField>
          </div>
          {dieselAmt != null && (
            <p className="text-sm text-slate-700 font-medium">
              Diesel cost: ₹{dieselAmt.toFixed(2)}
              <span className="text-xs text-slate-400 ml-2">(auto-added to Expenses)</span>
            </p>
          )}
        </div>

        <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Save Log</Button>
        </div>
      </div>
    </Modal>
  )
}

export default function VehiclesPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('vehicle_logs')
      .select('*, vehicles(name), drivers(name)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)
    setLogs((data ?? []).map((l: any) => ({
      id: l.id, date: l.date,
      vehicle_name: l.vehicles?.name ?? '—',
      driver_name: l.drivers?.name ?? null,
      odo_start: l.odo_start, odo_end: l.odo_end, km_travelled: l.km_travelled,
      diesel_litres: l.diesel_litres, diesel_rate: l.diesel_rate, diesel_amount: l.diesel_amount,
    })))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const totalKm = logs.reduce((s, l) => s + (l.km_travelled ?? 0), 0)
  const totalDiesel = logs.reduce((s, l) => s + (l.diesel_amount ?? 0), 0)
  const totalLitres = logs.reduce((s, l) => s + (l.diesel_litres ?? 0), 0)
  const avgRate = totalLitres > 0 ? (totalDiesel / totalLitres) : 0

  return (
    <div>
      <PageHeader
        title="Vehicles / Diesel"
        subtitle="Daily odometer logs and diesel fill tracking"
        actions={<Button onClick={() => setAddOpen(true)} size="sm"><Plus size={14} />Add Log</Button>}
      />

      {!loading && logs.length > 0 && (
        <div className="flex flex-wrap gap-6 px-6 py-3 bg-white border-b border-slate-200 text-sm">
          <span className="text-slate-700 font-medium">Total: {formatNumber(totalKm)} km</span>
          <span className="text-slate-600">Diesel: {totalLitres.toFixed(1)} L</span>
          <span className="text-slate-600">Diesel cost: ₹{totalDiesel.toFixed(2)}</span>
          {avgRate > 0 && <span className="text-slate-600">Avg rate: ₹{avgRate.toFixed(2)}/L</span>}
          {totalKm > 0 && totalDiesel > 0 && (
            <span className="text-slate-600">Cost/km: ₹{(totalDiesel / totalKm).toFixed(2)}</span>
          )}
        </div>
      )}

      <div className="p-6">
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Date', 'Vehicle', 'Driver', 'Odo Start', 'Odo End', 'KM', 'Diesel (L)', 'Rate (₹/L)', 'Diesel Cost'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="text-center py-10 text-slate-400">Loading…</td></tr>}
              {!loading && logs.length === 0 && (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400">No vehicle logs yet. Click + Add Log.</td></tr>
              )}
              {logs.map(l => (
                <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(l.date)}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{l.vehicle_name}</td>
                  <td className="px-4 py-3 text-slate-600">{l.driver_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600 text-right">{l.odo_start != null ? formatNumber(l.odo_start) : '—'}</td>
                  <td className="px-4 py-3 text-slate-600 text-right">{l.odo_end != null ? formatNumber(l.odo_end) : '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-blue-700">{l.km_travelled != null ? `${l.km_travelled} km` : '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{l.diesel_litres != null ? `${l.diesel_litres} L` : '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{l.diesel_rate != null ? `₹${Number(l.diesel_rate).toFixed(2)}` : '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-amber-700">{l.diesel_amount != null ? `₹${Number(l.diesel_amount).toFixed(2)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AddLogModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={load} />
    </div>
  )
}
