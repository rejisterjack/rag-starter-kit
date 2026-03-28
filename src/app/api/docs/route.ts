/**
 * API Documentation Route
 *
 * Serves interactive API documentation using Swagger UI.
 * Available at /api/docs
 */

import { NextResponse } from 'next/server';
import { generateSwaggerUIHTML } from '@/lib/api/openapi-spec';

/**
 * GET /api/docs
 * Returns the Swagger UI HTML for API documentation
 */
export async function GET(): Promise<NextResponse> {
  const html = generateSwaggerUIHTML();

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
