import { timingSafeEqual } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { apiError, apiSuccess } from '@/lib/api-response';

const DEPLOY_WEBHOOK_SECRET = process.env.DEPLOY_WEBHOOK_SECRET ?? '';

export async function POST(req: Request) {
  if (!DEPLOY_WEBHOOK_SECRET) {
    return apiError('NOT_IMPLEMENTED', 'Deploy webhook not configured', 501);
  }

  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401);
  }

  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(DEPLOY_WEBHOOK_SECRET);
  if (tokenBuf.length !== expectedBuf.length || !timingSafeEqual(tokenBuf, expectedBuf)) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401);
  }

  revalidatePath('/docs');

  return apiSuccess({
    revalidated: true,
    paths: ['/docs'],
    at: new Date().toISOString(),
  });
}
