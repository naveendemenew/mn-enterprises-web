import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/session'

export async function POST() {
  const response = NextResponse.json({ success: true })
  // Must include the same flags (httpOnly, secure, sameSite) as login to properly expire the cookie
  // on browsers (especially mobile) that validate attribute matching on deletion
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}
