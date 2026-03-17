import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageItem } from '@/components/chat/message-item';
import type { Message } from 'ai';

describe('MessageItem', () => {
  const mockUserMessage: Message = {
    id: 'msg-1',
    role: 'user',
    content: 'What is the revenue for Q3?',
  };

  const mockAssistantMessage: Message = {
    id: 'msg-2',
    role: 'assistant',
    content: 'Based on the financial report, Q3 2024 revenue was $35 million.',
  };

  const mockAssistantWithCitations: Message = {
    id: 'msg-3',
    role: 'assistant',
    content: 'The company revenue was $150 million in 2024.',
    annotations: [
      {
        type: 'citation',
        documentId: 'doc-001',
        chunkId: 'chunk-001',
        page: 2,
      },
    ],
  };

  it('renders user message correctly', () => {
    render(<MessageItem message={mockUserMessage} />);
    
    expect(screen.getByText('What is the revenue for Q3?')).toBeInTheDocument();
    expect(screen.getByRole('article')).toHaveAttribute('data-role', 'user');
  });

  it('renders assistant message correctly', () => {
    render(<MessageItem message={mockAssistantMessage} />);
    
    expect(screen.getByText(/based on the financial report/i)).toBeInTheDocument();
    expect(screen.getByRole('article')).toHaveAttribute('data-role', 'assistant');
  });

  it('displays user avatar for user messages', () => {
    render(<MessageItem message={mockUserMessage} />);
    
    const avatar = screen.getByTestId('user-avatar');
    expect(avatar).toBeInTheDocument();
  });

  it('displays assistant avatar for assistant messages', () => {
    render(<MessageItem message={mockAssistantMessage} />);
    
    const avatar = screen.getByTestId('assistant-avatar');
    expect(avatar).toBeInTheDocument();
  });

  it('renders markdown content correctly', () => {
    const markdownMessage: Message = {
      id: 'msg-4',
      role: 'assistant',
      content: '# Heading\n\n**Bold text** and *italic text*\n\n- Item 1\n- Item 2',
    };
    
    render(<MessageItem message={markdownMessage} />);
    
    expect(screen.getByRole('heading', { name: /heading/i })).toBeInTheDocument();
    expect(screen.getByText(/bold text/i)).toHaveClass('font-bold');
    expect(screen.getByText(/italic text/i)).toHaveClass('italic');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders code blocks with syntax highlighting', () => {
    const codeMessage: Message = {
      id: 'msg-5',
      role: 'assistant',
      content: '```typescript\nconst x = 1;\n```',
    };
    
    render(<MessageItem message={codeMessage} />);
    
    const codeBlock = screen.getByRole('code');
    expect(codeBlock).toBeInTheDocument();
    expect(codeBlock).toHaveClass('language-typescript');
  });

  it('displays citations when present', () => {
    render(<MessageItem message={mockAssistantWithCitations} />);
    
    const citation = screen.getByTestId('citation');
    expect(citation).toBeInTheDocument();
    expect(citation).toHaveTextContent(/document/i);
  });

  it('displays page number in citation', () => {
    render(<MessageItem message={mockAssistantWithCitations} />);
    
    expect(screen.getByText(/page 2/i)).toBeInTheDocument();
  });

  it('handles streaming state', () => {
    render(<MessageItem message={mockAssistantMessage} isStreaming />);
    
    const streamingIndicator = screen.getByTestId('streaming-indicator');
    expect(streamingIndicator).toBeInTheDocument();
    expect(streamingIndicator).toHaveAttribute('aria-busy', 'true');
  });

  it('renders tool calls correctly', () => {
    const toolMessage: Message = {
      id: 'msg-6',
      role: 'assistant',
      content: '',
      toolInvocations: [
        {
          toolCallId: 'tool-1',
          toolName: 'searchDocuments',
          args: { query: 'revenue' },
          state: 'result',
          result: { documents: ['doc-1'] },
        },
      ],
    };
    
    render(<MessageItem message={toolMessage} />);
    
    expect(screen.getByTestId('tool-invocation')).toBeInTheDocument();
    expect(screen.getByText(/searching documents/i)).toBeInTheDocument();
  });

  it('allows copying message content', () => {
    render(<MessageItem message={mockAssistantMessage} />);
    
    const copyButton = screen.getByRole('button', { name: /copy/i });
    expect(copyButton).toBeInTheDocument();
  });

  it('is accessible with proper ARIA attributes', () => {
    render(<MessageItem message={mockAssistantMessage} />);
    
    const article = screen.getByRole('article');
    expect(article).toHaveAttribute('aria-label');
  });
});
