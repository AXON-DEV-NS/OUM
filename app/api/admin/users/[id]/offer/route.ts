import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin-session';
import { grantFreeAccess } from '@/lib/admin/data';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const planId = typeof body.planId === 'string' ? body.planId : null;
  const durationDays = Number(body.durationDays) || 30;

  try {
    const grant = await grantFreeAccess({
      userId: id,
      planId,
      durationDays,
    });
    return NextResponse.json({ ok: true, grant });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }
    if (message === 'INVALID_PLAN') {
      return NextResponse.json({ error: 'Unknown plan. Use starter, growth, or agency.' }, { status: 400 });
    }
    if (message === 'INVALID_DURATION') {
      return NextResponse.json({ error: 'Duration must be between 1 and 3650 days.' }, { status: 400 });
    }
    console.error('[admin/user-offer]', err);
    return NextResponse.json({ error: 'Failed to grant access.' }, { status: 500 });
  }
}
