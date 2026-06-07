import { type NextRequest, NextResponse } from 'next/server';

import { generateCsrfToken } from '@/lib/security/csrf';

export async function GET(req: NextRequest): Promise<Response> {
  const response = new NextResponse(JSON.stringify({ token: '' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  const token = generateCsrfToken(req, response, undefined);

  // Return the actual token in the body with the cookie header set by generateCsrfToken
  return new NextResponse(JSON.stringify({ token }), {
    status: 200,
    headers: response.headers,
  });
}
