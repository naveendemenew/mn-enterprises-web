'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

interface DateInputProps {
  value: string
  onChange: (iso: string) => void
  min?: string
  max?: string
  error?: boolean
  id?: string
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Parse "YYYY-MM-DD" into a local Date (avoids UTC offset issues from new Date(str)) */
function parseISO(iso: string): Date | null {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDisplay(iso: string): string {
  const d = parseISO(iso)
  if (!d) return ''
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}-${month}-${d.getFullYear()}`
}

/** Custom calendar-picker date input. Displays/accepts DD-MM-YYYY, stores ISO (yyyy-mm-dd). */
export default function DateInput({ value, onChange, min, max, error, id }: DateInputProps) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => {
    const d = parseISO(value) ?? new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open) {
      const d = parseISO(value) ?? new Date()
      setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1))
    }
  }, [open, value])

  const minDate = parseISO(min ?? '')
  const maxDate = parseISO(max ?? '')
  const selected = parseISO(value)

  const isDisabled = (d: Date) => {
    if (minDate && d < minDate) return true
    if (maxDate && d > maxDate) return true
    return false
  }

  const firstDayOfWeek = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay()
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()

  const cells: (Date | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d))

  const goToday = () => {
    const today = new Date()
    if (isDisabled(today)) return
    onChange(toISO(today))
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen(o => !o)}
        className={`w-full min-h-11 px-3 py-2 text-sm border rounded-lg bg-white text-left flex items-center justify-between gap-2
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          ${error ? 'border-red-400' : 'border-slate-300'}`}
      >
        <span className={value ? 'text-slate-800' : 'text-slate-400'}>
          {value ? formatDisplay(value) : 'Select date'}
        </span>
        <Calendar size={16} className="text-slate-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-3 w-72 left-0">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-slate-800">
              {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(w => (
              <div key={w} className="text-center text-xs font-medium text-slate-400 py-1">{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />
              const disabled = isDisabled(d)
              const isSelected = selected && toISO(d) === toISO(selected)
              const isToday = toISO(d) === toISO(new Date())
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => { onChange(toISO(d)); setOpen(false) }}
                  className={`mx-auto flex items-center justify-center w-9 h-9 rounded-full text-sm transition-colors
                    ${isSelected ? 'bg-blue-600 text-white font-semibold'
                      : disabled ? 'text-slate-300 cursor-not-allowed'
                      : isToday ? 'text-blue-600 font-semibold hover:bg-blue-50'
                      : 'text-slate-700 hover:bg-slate-100'}`}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={goToday} className="text-xs text-blue-600 hover:underline font-medium px-1 py-1">
              Today
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:text-slate-700 px-1 py-1">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
