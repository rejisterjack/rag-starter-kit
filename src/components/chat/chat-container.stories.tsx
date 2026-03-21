import type { Meta, StoryObj } from '@storybook/react';
import type { Message } from '@/types';
import { ChatContainer } from './chat-container';

const meta: Meta<typeof ChatContainer> = {
  title: 'Chat/ChatContainer',
  component: ChatContainer,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Main chat interface with message list, input, and document sidebar.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ChatContainer>;

const mockMessages: Message[] = [
  {
    id: '1',
    role: 'user',
    content: 'What are the key features of this RAG starter kit?',
    createdAt: new Date(Date.now() - 1000 * 60 * 5),
  },
  {
    id: '2',
    role: 'assistant',
    content:
      'The RAG Starter Kit includes:\n\n• **100% Free AI** - Uses OpenRouter + Google Gemini\n• **Document Upload** - PDF, DOCX, TXT support\n• **Real-time Streaming** - Token-by-token responses\n• **Multi-model Fallback** - Automatic backup models\n• **Voice Features** - Speech-to-text and text-to-speech\n• **PWA Support** - Install as native app',
    createdAt: new Date(Date.now() - 1000 * 60 * 4),
    sources: [
      {
        id: 's1',
        content: 'RAG Starter Kit uses OpenRouter for free LLM access',
        similarity: 0.95,
        metadata: {
          documentId: 'doc1',
          documentName: 'README.md',
          page: 1,
        },
      },
    ],
  },
  {
    id: '3',
    role: 'user',
    content: 'How do I deploy this to production?',
    createdAt: new Date(Date.now() - 1000 * 60 * 2),
  },
];

export const Default: Story = {
  args: {
    messages: mockMessages,
    isLoading: false,
    isStreaming: false,
    streamingContent: '',
    onSendMessage: async () => {},
    onStop: () => {},
    sources: [
      {
        id: 's1',
        content: 'RAG Starter Kit uses OpenRouter for free LLM access',
        documentName: 'README.md',
        page: 1,
        similarity: 0.95,
      },
      {
        id: 's2',
        content: 'Deploy to Vercel, Railway, or Render with one click',
        documentName: 'DEPLOYMENT.md',
        page: 3,
        similarity: 0.88,
      },
    ],
  },
};

export const Loading: Story = {
  args: {
    messages: mockMessages,
    isLoading: true,
    isStreaming: false,
    streamingContent: '',
    onSendMessage: async () => {},
    onStop: () => {},
    sources: [],
  },
};

export const Streaming: Story = {
  args: {
    messages: mockMessages,
    isLoading: false,
    isStreaming: true,
    streamingContent:
      'You can deploy using Docker Compose for self-hosting or use one-click deploy buttons for Vercel, Railway, or Render...',
    onSendMessage: async () => {},
    onStop: () => {},
    sources: [],
  },
};

export const Empty: Story = {
  args: {
    messages: [],
    isLoading: false,
    isStreaming: false,
    streamingContent: '',
    onSendMessage: async () => {},
    onStop: () => {},
    sources: [],
  },
};

export const DarkMode: Story = {
  args: {
    messages: mockMessages,
    isLoading: false,
    isStreaming: false,
    streamingContent: '',
    onSendMessage: async () => {},
    onStop: () => {},
    sources: [],
  },
  parameters: {
    themes: {
      default: 'dark',
    },
  },
};
