import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://hos-marketplaceapi-production.up.railway.app';

function getBackendBase(): string {
  let base = BACKEND_URL.trim().replace(/\/+$/, '');
  if (!base.endsWith('/api')) {
    base += '/api';
  }
  return base;
}

const STRIP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
]);

async function handler(req: NextRequest) {
  const path = req.nextUrl.pathname.replace(/^\/api\/proxy/, '');
  const search = req.nextUrl.search;
  const target = `${getBackendBase()}${path}${search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!STRIP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  headers.set('X-Forwarded-For', req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1');
  headers.set('X-Forwarded-Host', req.headers.get('host') || '');
  headers.set('X-Forwarded-Proto', req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', '') || 'https');

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'DELETE';
  const body = hasBody ? await req.arrayBuffer() : undefined;

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body,
    redirect: 'manual',
    ...(hasBody ? { duplex: 'half' } : {}),
  });

  const resHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (STRIP_HEADERS.has(lower)) return;
    // Rewrite Set-Cookie to be on the frontend domain (first-party)
    if (lower === 'set-cookie') {
      const rewritten = rewriteSetCookie(value);
      resHeaders.append(key, rewritten);
      return;
    }
    // Strip backend CORS headers — the browser sees this as same-origin
    if (lower.startsWith('access-control-')) return;
    resHeaders.set(key, value);
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  });
}

function rewriteSetCookie(raw: string): string {
  // Remove Domain= (let it default to the frontend domain)
  let cookie = raw.replace(/;\s*Domain=[^;]*/i, '');
  // Change SameSite=None to SameSite=Lax (now first-party, doesn't need None)
  cookie = cookie.replace(/;\s*SameSite=None/i, '; SameSite=Lax');
  // Path stays /
  return cookie;
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
export const HEAD = handler;
export const OPTIONS = handler;

export const runtime = 'edge';
