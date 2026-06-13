import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/session'

export async function POST(request: Request) {
  const { phone, pin } = await request.json()

  if (!phone || !pin) {
    return NextResponse.json({ error: 'Phone number and PIN are required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('verify_pin', { p_phone: String(phone).trim(), p_pin: String(pin).trim() })

  if (error || data !== true) {
    return NextResponse.json({ error: 'Incorrect phone number or PIN' }, { status: 401 })
  }

  const token = await createSessionToken(String(phone).trim())
  const response = NextResponse.json({ success: true })
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return response
}
