import { type NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(SESSION_COOKIE)?.value

  // verifySessionToken handles malformed/expired tokens gracefully (returns false)
  const authed = !!token && (await verifySessionToken(token))

  // /login: redirect to dashboard if already authenticated, otherwise allow through
  if (pathname === '/login') {
    if (authed) return NextResponse.redirect(new URL('/', request.url))
    return NextResponse.next()
  }

  // All other routes: require a valid session
  if (!authed) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

// Run on all paths except:
//  - /api/login and /api/logout (public auth endpoints)
//  - Next.js internals (_next/static, _next/image)
//  - Static assets (favicon.ico, images)
export const config = {
  matcher: [
    '/((?!api/login|api/logout|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
