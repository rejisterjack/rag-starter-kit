import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { question: _question } = await req.json();
  
  return NextResponse.json({
    success: true,
    data: {
      answer: 'This is the public API for RAG Starter Kit',
      citations: [],
    },
  });
}

export async function GET() {
  return NextResponse.json({
    name: 'RAG Starter Kit Public API',
    version: '1.0.0',
  });
}
