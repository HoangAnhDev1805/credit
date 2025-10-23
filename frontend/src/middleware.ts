import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const accept = request.headers.get('accept') || ''
  // Only force no-store for HTML documents to avoid Next invariant (0 < 1)
  if (accept.includes('text/html')) {
    const res = NextResponse.next()
    res.headers.set('Cache-Control', 'no-store')
    return res
  }
  return NextResponse.next()
}

export const config = {
  // Run on all routes; static assets are excluded by Next by default
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest).*)'],
}
