import type { Meta, StoryObj } from '@storybook/react';
import { StreamingMessage } from './streaming-message';
import { action } from '@storybook/addon-actions';

/**
 * StreamingMessage component shows an in-progress AI response
 * with a typing indicator and cancel button.
 */
const meta: Meta<typeof StreamingMessage> = {
  title: 'Chat/StreamingMessage',
  component: StreamingMessage,
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
 * Initial loading state with no content.
 */
export const Initial: Story = {
  args: {
    content: '',
    onCancel: action('cancelled'),
  },
};

/**
 * Streaming with partial content.
 */
export const PartialContent: Story = {
  args: {
    content: 'Based on the documentation, the system supports multiple authentication methods including',
    onCancel: action('cancelled'),
  },
};

/**
 * Streaming with longer content.
 */
export const LongContent: Story = {
  args: {
    content: `Based on the quarterly report, here are the key findings:

## Revenue Growth
- **Q3 Revenue**: $2.4M (+15% YoY)
- **Subscription Revenue**: $1.8M (+22% YoY)

## User Metrics
- **MAU**: 45,000 (+30% YoY)
- **Churn Rate**: 2.1% (improved from 3.2%)`,
    onCancel: action('cancelled'),
  },
};

/**
 * Without cancel button.
 */
export const NoCancel: Story = {
  args: {
    content: 'Processing your request...',
  },
};
