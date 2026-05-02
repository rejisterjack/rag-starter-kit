import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Get query parameters
    const title = searchParams.get('title') || 'RAG Starter Kit';
    const description =
      searchParams.get('description') || 'Production-ready RAG chatbot boilerplate';

    return new ImageResponse(
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)',
          color: 'white',
          padding: '60px',
          position: 'relative',
        }}
      >
        {/* Background gradient overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'radial-gradient(circle at 30% 20%, rgba(124, 58, 237, 0.3) 0%, transparent 50%)',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          {/* Logo/Icon */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '80px',
              height: '80px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
              marginBottom: '30px',
              boxShadow: '0 20px 40px rgba(124, 58, 237, 0.4)',
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Chat icon</title>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: '60px',
              fontWeight: 'bold',
              textAlign: 'center',
              margin: '0 0 20px 0',
              background: 'linear-gradient(135deg, #ffffff 0%, #a1a1aa 100%)',
              backgroundClip: 'text',
              color: 'transparent',
              lineHeight: 1.2,
            }}
          >
            {title}
          </h1>

          {/* Description */}
          <p
            style={{
              fontSize: '28px',
              textAlign: 'center',
              color: '#a1a1aa',
              margin: 0,
              maxWidth: '800px',
              lineHeight: 1.4,
            }}
          >
            {description}
          </p>

          {/* Tech stack badges */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginTop: '40px',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            {['Next.js 15', 'React 19', 'PostgreSQL', 'LangChain'].map((tech) => (
              <span
                key={tech}
                style={{
                  padding: '8px 16px',
                  borderRadius: '9999px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#d4d4d8',
                  fontSize: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                {tech}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '18px',
            color: '#71717a',
          }}
        >
          <span>rag-starter-kit.vercel.app</span>
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (_error: unknown) {
    return new Response('Failed to generate image', { status: 500 });
  }
}
