import { NextRequest, NextResponse } from 'next/server';
import { normalizeApiBaseUrl } from '@/lib/apiBaseUrl';

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

/** Resolve backend base URL at request time so Railway runtime env vars apply. */
function resolveBackendBases(): string[] {
  const candidates = [
    process.env.API_INTERNAL_URL,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:3001',
  ];

  const seen = new Set<string>();
  const bases: string[] = [];
  for (const raw of candidates) {
    const base = normalizeApiBaseUrl(raw);
    if (base && !seen.has(base)) {
      seen.add(base);
      bases.push(base);
    }
  }
  return bases;
}

async function handler(req: NextRequest) {
  const backendBases = resolveBackendBases();
  if (backendBases.length === 0) {
    return NextResponse.json(
      { message: 'API backend URL is not configured (set API_INTERNAL_URL or NEXT_PUBLIC_API_URL)' },
      { status: 503 },
    );
  }

  // CSRF protection: state-changing requests must include X-Requested-With header
  // (cannot be set by cross-origin form submissions or simple CORS requests)
  const stateMutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (stateMutating && req.headers.get('x-requested-with') !== 'XMLHttpRequest') {
    return NextResponse.json(
      { message: 'Missing CSRF header (X-Requested-With)' },
      { status: 403 },
    );
  }

  const path = req.nextUrl.pathname.replace(/^\/api\/proxy/, '');
  const search = req.nextUrl.search;

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

  let upstream: Response | null = null;
  let lastError: unknown;

  for (const base of backendBases) {
    const target = `${base}${path}${search}`;
    try {
      upstream = await fetch(target, {
        method: req.method,
        headers,
        body,
        redirect: 'manual',
        // Required by Node.js fetch when a body is present (DELETE is excluded via hasBody).
        ...(hasBody ? { duplex: 'half' as const } : {}),
      });
      break;
    } catch (error) {
      lastError = error;
      console.error(`[api/proxy] fetch failed for ${target}:`, error);
    }
  }

  if (!upstream) {
    const message =
      lastError instanceof Error ? lastError.message : 'Unable to reach API backend';
    return NextResponse.json(
      { message: `API proxy error: ${message}` },
      { status: 502 },
    );
  }

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

// Node.js runtime: reliable outbound fetch on Railway (edge runtime cannot use private networking).
export const runtime = 'nodejs';
