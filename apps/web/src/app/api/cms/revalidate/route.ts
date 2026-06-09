import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

const ALLOWED_REVALIDATE_PREFIXES = [
  '/shop',
  '/products',
  '/fandoms',
  '/collections',
  '/sellers',
  '/help',
  '/blog',
  '/shipping',
  '/founding-members',
  '/universes',
  '/the-experience',
];

function isAllowedRevalidatePath(path: string): boolean {
  if (!path.startsWith('/') || path.includes('..') || path.includes('://')) {
    return false;
  }
  return ALLOWED_REVALIDATE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const secret = process.env.CMS_REVALIDATE_SECRET;

    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { path } = body;

    if (!path || typeof path !== 'string') {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    if (!isAllowedRevalidatePath(path)) {
      return NextResponse.json({ error: 'Path not allowed for revalidation' }, { status: 400 });
    }

    revalidatePath(path);

    return NextResponse.json({ revalidated: true, path });
  } catch (error) {
    console.error('Error revalidating CMS content:', error);
    return NextResponse.json(
      { error: 'Error revalidating' },
      { status: 500 }
    );
  }
}
