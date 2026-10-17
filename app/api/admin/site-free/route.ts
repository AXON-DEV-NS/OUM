import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin-session';
import { grantFreeAccess } from '@/lib/admin/data';

/**
 * Free access — for everyone (userId omitted) or a specific user, with a
 * configurable duration. Owner only.
 */
export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === 'string' && body.userId ? body.userId : null;
  const planId = typeof body.planId === 'string' ? body.planId : null;
  const durationDays = Number(body.durationDays) || 1;

  try {
    const grant = await grantFreeAccess({ userId, planId, durationDays });
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
    console.error('[admin/site-free]', err);
    return NextResponse.json({ error: 'Failed to grant access.' }, { status: 500 });
  }
}
