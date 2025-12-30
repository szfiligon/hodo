import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'

export function middleware(request: NextRequest) {
  // Get the pathname of the request (e.g. /, /protected)
  const path = request.nextUrl.pathname

  // Define public paths that don't require authentication
  const isPublicPath = path === '/login'

  // Check for JWT token in Authorization header or cookie
  const authHeader = request.headers.get('authorization')
  const tokenFromHeader = extractTokenFromHeader(authHeader)
  const tokenFromCookie = request.cookies.get('hodo_token')?.value
  
  const token = tokenFromHeader || tokenFromCookie

  // Verify JWT token if present
  let isAuthenticated = false
  if (token) {
    const decoded = verifyToken(token)
    isAuthenticated = !!decoded
  }

  // Only redirect from login page if user is authenticated
  // Don't redirect from protected pages to login - let the client handle it
  if (isPublicPath && isAuthenticated) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

// Configure which paths should be processed by this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - hodo-modern.* (logo files)
     */
    '/((?!api|_next/static|_next/image|hodo-modern).*)',
  ],
} 