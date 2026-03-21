import type { Meta, StoryObj } from '@storybook/react';
import type { Message } from '@/types';
import { MessageList } from './message-list';

const meta: Meta<typeof MessageList> = {
  title: 'Chat/MessageList',
  component: MessageList,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Displays a list of chat messages with user and assistant bubbles.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MessageList>;

const mockMessages: Message[] = [
  {
    id: '1',
    role: 'user',
    content: 'What is Retrieval-Augmented Generation?',
    createdAt: new Date(Date.now() - 1000 * 60 * 10),
  },
  {
    id: '2',
    role: 'assistant',
    content:
      'Retrieval-Augmented Generation (RAG) is an AI framework that enhances large language models by retrieving relevant information from external knowledge bases before generating responses. This approach helps reduce hallucinations and provides more accurate, up-to-date answers.',
    createdAt: new Date(Date.now() - 1000 * 60 * 9),
  },
  {
    id: '3',
    role: 'user',
    content: 'How does this starter kit implement RAG?',
    createdAt: new Date(Date.now() - 1000 * 60 * 5),
  },
  {
    id: '4',
    role: 'assistant',
    content:
      "This RAG Starter Kit implements a complete pipeline:\n\n1. **Document Processing**: Upload PDFs, DOCX, TXT files\n2. **Text Chunking**: Recursive splitting with overlap\n3. **Embeddings**: Google Gemini (free tier)\n4. **Vector Search**: PostgreSQL with pgvector\n5. **LLM Generation**: OpenRouter free models\n6. **Streaming**: Real-time token generation\n\nThe best part? It's completely free to use!",
    createdAt: new Date(Date.now() - 1000 * 60 * 4),
    sources: [
      {
        id: 's1',
        content: 'RAG Starter Kit uses OpenRouter for free LLM access',
        similarity: 0.95,
        metadata: { documentId: 'doc1', documentName: 'README.md', page: 1 },
      },
      {
        id: 's2',
        content: 'Google Gemini provides free embeddings via AI Studio',
        similarity: 0.92,
        metadata: { documentId: 'doc1', documentName: 'README.md', page: 2 },
      },
    ],
  },
];

export const Default: Story = {
  args: {
    messages: mockMessages,
    isLoading: false,
    streamingContent: '',
  },
};

export const Empty: Story = {
  args: {
    messages: [],
    isLoading: false,
    streamingContent: '',
  },
};

export const Loading: Story = {
  args: {
    messages: mockMessages,
    isLoading: true,
    streamingContent: '',
  },
};

export const Streaming: Story = {
  args: {
    messages: mockMessages,
    isLoading: false,
    streamingContent:
      'The vector search uses PostgreSQL with the pgvector extension for efficient similarity search...',
  },
};

export const SingleMessage: Story = {
  args: {
    messages: [mockMessages[0]!],
    isLoading: false,
    streamingContent: '',
  },
};

export const LongConversation: Story = {
  args: {
    messages: [
      ...mockMessages,
      {
        id: '5',
        role: 'user',
        content: 'Can I deploy this to Vercel?',
        createdAt: new Date(Date.now() - 1000 * 60 * 2),
      },
      {
        id: '6',
        role: 'assistant',
        content:
          'Yes! You can deploy to Vercel, Railway, or Render with one-click deploy buttons. The project includes complete Docker support for self-hosting as well.',
        createdAt: new Date(Date.now() - 1000 * 60 * 1),
      },
    ],
    isLoading: false,
    streamingContent: '',
  },
};

export const DarkMode: Story = {
  args: {
    messages: mockMessages,
    isLoading: false,
    streamingContent: '',
  },
  parameters: {
    themes: {
      default: 'dark',
    },
  },
};
