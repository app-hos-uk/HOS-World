import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || '';
const ACCESS_TOKEN = process.env.META_CONVERSIONS_API_TOKEN?.trim() || '';
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE?.trim() || '';

function hashSha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function normalizeUserData(userData?: {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  externalId?: string;
}): Record<string, string> {
  const result: Record<string, string> = {};
  if (!userData) return result;

  if (userData.email) result.em = hashSha256(userData.email);
  if (userData.phone) result.ph = hashSha256(userData.phone.replace(/\D/g, ''));
  if (userData.firstName) result.fn = hashSha256(userData.firstName);
  if (userData.lastName) result.ln = hashSha256(userData.lastName);
  if (userData.externalId) result.external_id = hashSha256(userData.externalId);

  return result;
}

export async function POST(request: NextRequest) {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return NextResponse.json({ ok: false, skipped: true }, { status: 200 });
  }

  try {
    const body = await request.json();
    const {
      event_name,
      event_id,
      event_time,
      event_source_url,
      user_data,
      custom_data,
    } = body;

    if (!event_name || !event_id) {
      return NextResponse.json({ error: 'event_name and event_id are required' }, { status: 400 });
    }

    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    const hashedUserData = normalizeUserData(user_data);
    const serverEvent: Record<string, unknown> = {
      event_name,
      event_time: event_time || Math.floor(Date.now() / 1000),
      event_id,
      action_source: 'website',
      event_source_url: event_source_url || request.headers.get('referer') || undefined,
      user_data: {
        ...hashedUserData,
        client_ip_address: clientIp,
        client_user_agent: userAgent,
      },
    };

    if (custom_data && Object.keys(custom_data).length > 0) {
      serverEvent.custom_data = custom_data;
    }

    const payload: Record<string, unknown> = {
      data: [serverEvent],
      access_token: ACCESS_TOKEN,
    };

    if (TEST_EVENT_CODE) {
      payload.test_event_code = TEST_EVENT_CODE;
    }

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${PIXEL_ID}/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('Meta CAPI error:', response.status, errorText.slice(0, 500));
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    const result = await response.json();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error('Meta CAPI route error:', error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
