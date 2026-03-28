import type { Meta, StoryObj } from '@storybook/react';
import { ShareDialog } from './share-dialog';

/**
 * ShareDialog component for creating and managing chat shares.
 * Allows setting public/private access, expiration, and comments.
 */
const meta: Meta<typeof ShareDialog> = {
  title: 'Chat/ShareDialog',
  component: ShareDialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Share dialog for a new chat.
 */
export const NewShare: Story = {
  args: {
    chatId: 'chat-123',
    chatTitle: 'Project Roadmap Discussion',
  },
};

/**
 * Share dialog with a long title.
 */
export const LongTitle: Story = {
  args: {
    chatId: 'chat-456',
    chatTitle: 'Quarterly Review: Financial Performance and Strategic Initiatives for 2024',
  },
};

/**
 * Share dialog trigger button only.
 */
export const TriggerOnly: Story = {
  args: {
    chatId: 'chat-789',
    chatTitle: 'API Documentation Q&A',
  },
  render: (args) => (
    <div className="p-8 border rounded-lg">
      <p className="text-sm text-muted-foreground mb-4">Click to open dialog:</p>
      <ShareDialog {...args} />
    </div>
  ),
};
