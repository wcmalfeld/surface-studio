import { NextResponse, type NextRequest } from 'next/server';

// Give every browser a stable anonymous id so its projects stay together.
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.get('ss_uid')) {
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    const id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    res.cookies.set('ss_uid', id, { httpOnly: true, sameSite: 'lax', secure: req.nextUrl.protocol === 'https:', path: '/', maxAge: 60 * 60 * 24 * 400 });
  }
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
