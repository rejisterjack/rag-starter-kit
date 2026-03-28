/**
 * API v1 Root
 *
 * Returns API information and available endpoints
 */

import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    name: 'RAG Starter Kit API',
    version: '1.0.0',
    documentation: '/api/v1/docs',
    endpoints: {
      documents: '/api/v1/documents',
      chats: '/api/v1/chats',
      workspaces: '/api/v1/workspaces',
      search: '/api/v1/search',
    },
    authentication: {
      type: 'Bearer',
      header: 'Authorization: Bearer <token>',
      alternative: 'X-API-Key: <api-key>',
    },
  });
}
