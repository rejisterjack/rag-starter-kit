import { NextResponse } from 'next/server';

export function apiSuccess<T>(data: T, status = 200, headers?: HeadersInit) {
  return NextResponse.json({ success: true, data }, { status, headers });
}

export function apiError(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
  headers?: HeadersInit
) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message, ...(details !== undefined ? { details } : {}) },
    },
    { status, headers }
  );
}
