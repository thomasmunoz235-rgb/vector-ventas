import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySessionToken } from '@/lib/session'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/auth')) return NextResponse.next()

  const token = request.cookies.get('session')?.value
  const session = token ? await verifySessionToken(token) : null

  if (!session) {
    if (pathname === '/login') return NextResponse.next()
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Already authenticated — redirect login to dashboard
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
