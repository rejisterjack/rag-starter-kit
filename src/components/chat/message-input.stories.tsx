import { action } from '@storybook/addon-actions';
import type { Meta, StoryObj } from '@storybook/react';
import { MessageInput } from './message-input';

/**
 * MessageInput component for entering chat messages.
 * Supports file attachments and voice input.
 */
const meta: Meta<typeof MessageInput> = {
  title: 'Chat/MessageInput',
  component: MessageInput,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default input state.
 */
export const Default: Story = {
  args: {
    onSend: action('send'),
    isLoading: false,
  },
};

/**
 * Loading state during message sending.
 */
export const Loading: Story = {
  args: {
    onSend: action('send'),
    isLoading: true,
  },
};

/**
 * Disabled state.
 */
export const Disabled: Story = {
  args: {
    onSend: action('send'),
    isLoading: false,
    disabled: true,
  },
};

/**
 * Input in a constrained container.
 */
export const InContainer: Story = {
  args: {
    onSend: action('send'),
    isLoading: false,
  },
  decorators: [
    (Story) => (
      <div className="w-[600px] border rounded-lg p-4 bg-muted/20">
        <Story />
      </div>
    ),
  ],
};
