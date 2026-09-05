import { type NextRequest, NextResponse } from 'next/server';
import { apiSuccess } from '@/lib/api-response';
import { generateCsrfToken } from '@/lib/security/csrf';

export async function GET(req: NextRequest): Promise<Response> {
  const response = new NextResponse(JSON.stringify({ success: true, data: { token: '' } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  const token = generateCsrfToken(req, response, undefined);

  return apiSuccess({ token }, 200, response.headers);
}
