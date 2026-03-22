import type { Meta, StoryObj } from '@storybook/react';
import { MessageItem } from './message-item';

/**
 * MessageItem component displays a chat message with support for
 * user/assistant roles, citations, and action buttons.
 */
const meta: Meta<typeof MessageItem> = {
  title: 'Chat/MessageItem',
  component: MessageItem,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="max-w-3xl mx-auto p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A user message in the chat.
 */
export const UserMessage: Story = {
  args: {
    message: {
      id: '1',
      content: 'What are the key findings in the quarterly report?',
      role: 'user',
      createdAt: new Date(),
    },
  },
};

/**
 * An assistant message with markdown content.
 */
export const AssistantMessage: Story = {
  args: {
    message: {
      id: '2',
      content: `Based on the quarterly report, here are the key findings:

## Revenue Growth
- **Q3 Revenue**: $2.4M (+15% YoY)
- **Subscription Revenue**: $1.8M (+22% YoY)

## User Metrics
- **MAU**: 45,000 (+30% YoY)
- **Churn Rate**: 2.1% (improved from 3.2%)

## Key Highlights
1. New enterprise clients added: 12
2. Average contract value increased by 18%
3. Customer satisfaction score: 4.7/5`,
      role: 'assistant',
      createdAt: new Date(),
    },
  },
};

/**
 * Assistant message with source citations.
 */
export const WithCitations: Story = {
  args: {
    message: {
      id: '3',
      content: 'According to the documentation, the system supports multiple authentication methods including OAuth, SAML, and API keys.',
      role: 'assistant',
      createdAt: new Date(),
      citations: [
        { index: 1, documentName: 'Authentication Guide', content: 'OAuth 2.0 support', page: 5 },
        { index: 2, documentName: 'SSO Setup', content: 'SAML 2.0 configuration', page: 12 },
        { index: 3, documentName: 'API Reference', content: 'API key management', page: 8 },
      ],
    },
  },
};

/**
 * Assistant message with code block.
 */
export const WithCode: Story = {
  args: {
    message: {
      id: '4',
      content: `Here's how to configure the webhook:

\`\`\`typescript
const webhook = await createWebhook({
  url: 'https://api.example.com/webhook',
  events: ['document.created', 'chat.completed'],
  secret: process.env.WEBHOOK_SECRET,
});
\`\`\`

Make sure to verify the signature using the secret.`,
      role: 'assistant',
      createdAt: new Date(),
    },
  },
};

/**
 * The last message in a conversation showing regenerate button.
 */
export const LastMessage: Story = {
  args: {
    message: {
      id: '5',
      content: 'I apologize, but I cannot find information about that in your documents.',
      role: 'assistant',
      createdAt: new Date(),
    },
    isLastMessage: true,
    onRegenerate: () => console.log('Regenerate clicked'),
  },
};

/**
 * Message with feedback buttons enabled.
 */
export const WithFeedback: Story = {
  args: {
    message: {
      id: '6',
      content: 'The system architecture consists of three main layers: presentation, API, and data.',
      role: 'assistant',
      createdAt: new Date(),
    },
    onFeedback: (id, rating) => console.log(`Feedback: ${id} - ${rating}`),
  },
};

/**
 * Long message content to test scrolling.
 */
export const LongMessage: Story = {
  args: {
    message: {
      id: '7',
      content: `# Comprehensive Analysis

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

## Section 1
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

## Section 2
Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

## Section 3
Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.`,
      role: 'assistant',
      createdAt: new Date(),
    },
  },
};

/**
 * Multiple messages in a conversation.
 */
export const Conversation: Story = {
  render: () => (
    <div className="space-y-6">
      <MessageItem
        message={{
          id: '1',
          content: 'Can you summarize the project roadmap?',
          role: 'user',
          createdAt: new Date(Date.now() - 60000),
        }}
      />
      <MessageItem
        message={{
          id: '2',
          content: `Here's a summary of the Q4 roadmap:

**Phase 1 (Oct)**
- Launch document search v2
- Improve citation accuracy

**Phase 2 (Nov)**
- Multi-modal support (images)
- Real-time collaboration

**Phase 3 (Dec)**
- Enterprise SSO
- Advanced analytics`,
          role: 'assistant',
          createdAt: new Date(Date.now() - 30000),
        }}
        isLastMessage={false}
      />
      <MessageItem
        message={{
          id: '3',
          content: 'What about the mobile app?',
          role: 'user',
          createdAt: new Date(),
        }}
      />
    </div>
  ),
};
