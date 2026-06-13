import { type NextRequest, NextResponse } from 'next/server'

// Session refresh proxy — handles Supabase cookie refreshing on every request.
// For v1 (no auth requirement) this is a simple pass-through.
export function proxy(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
