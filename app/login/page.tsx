'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Droplets, Eye, EyeOff } from 'lucide-react'
import Button from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/FormField'

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!phone.trim() || !pin.trim()) {
      setError('Enter your phone number and PIN')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), pin: pin.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? 'Incorrect phone number or PIN')
        return
      }
      router.push('/')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center justify-center w-14 h-14 bg-blue-600 rounded-xl shadow-sm mb-4">
            <Droplets size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">MN Enterprises</h1>
          <p className="text-sm text-slate-500 mt-1 text-center">Inventory &amp; Distribution Management</p>
        </div>

        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
          <FormField label="Phone Number" required>
            <Input
              type="tel"
              inputMode="numeric"
              autoComplete="username"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. 9912063801"
              autoFocus
            />
          </FormField>

          <FormField label="4-Digit PIN" required error={error || undefined}>
            <div className="relative">
              <Input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={4}
                autoComplete="current-password"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="pr-10"
                error={!!error}
              />
              <button
                type="button"
                onClick={() => setShowPin(s => !s)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
                aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
              >
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </FormField>

          <Button type="submit" loading={loading} className="w-full">Sign In</Button>
        </form>
      </div>
    </div>
  )
}
