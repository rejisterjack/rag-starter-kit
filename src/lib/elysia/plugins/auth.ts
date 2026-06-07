import type { Elysia } from 'elysia';
import { auth } from '@/lib/auth';
import { getServerSession } from '@/lib/auth/session';

export const requireAuth = (app: Elysia) =>
  app
    .derive(async () => {
      const session = await auth();
      if (!session?.user?.id) {
        return { session: undefined, workspace: undefined };
      }

      const workspace = await getServerSession();

      return {
        session: {
          userId: session.user.id,
          role: session.user.role,
          workspaceId: session.user.workspaceId,
          workspaceRole: session.user.workspaceRole,
        },
        workspace,
      };
    })
    .onBeforeHandle(({ session }): Response | undefined => {
      if (!session) {
        return new Response(
          JSON.stringify({
            error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          }),
          { status: 401, headers: { 'content-type': 'application/json' } }
        );
      }
      return undefined;
    });
