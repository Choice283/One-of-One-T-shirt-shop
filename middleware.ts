import { NextRequest, NextResponse } from 'next/server';

// Protects everything under /admin (pages AND the /api/admin/* routes) with
// HTTP Basic Auth. Good enough for a single-owner store; if you ever add
// other admins, swap this for real session-based auth.
export function middleware(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const expectedUser = process.env.ADMIN_USER;
  const expectedPass = process.env.ADMIN_PASS;

  if (!expectedUser || !expectedPass) {
    return new NextResponse('Admin auth is not configured. Set ADMIN_USER and ADMIN_PASS in .env', {
      status: 500
    });
  }

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      const [user, pass] = decoded.split(':');
      if (user === expectedUser && pass === expectedPass) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Admin"' }
  });
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*']
};
