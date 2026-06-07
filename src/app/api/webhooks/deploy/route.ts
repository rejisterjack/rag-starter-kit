import { timingSafeEqual } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

const DEPLOY_WEBHOOK_SECRET = process.env.DEPLOY_WEBHOOK_SECRET ?? '';

export async function POST(req: Request) {
  if (!DEPLOY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Deploy webhook not configured' }, { status: 501 });
  }

  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(DEPLOY_WEBHOOK_SECRET);
  if (tokenBuf.length !== expectedBuf.length || !timingSafeEqual(tokenBuf, expectedBuf)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  revalidatePath('/docs');

  return NextResponse.json({
    revalidated: true,
    paths: ['/docs'],
    at: new Date().toISOString(),
  });
}
