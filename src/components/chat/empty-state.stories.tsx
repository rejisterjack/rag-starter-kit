import type { Meta, StoryObj } from '@storybook/react';
import { EmptyState } from './empty-state';
import { action } from '@storybook/addon-actions';

/**
 * EmptyState component displayed when no messages exist in a chat.
 * Provides suggestions to help users get started.
 */
const meta: Meta<typeof EmptyState> = {
  title: 'Chat/EmptyState',
  component: EmptyState,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default empty state with suggestions.
 */
export const Default: Story = {
  args: {
    onSuggestionClick: action('suggestion-clicked'),
    onUploadClick: action('upload-clicked'),
  },
};

/**
 * Without upload button.
 */
export const NoUpload: Story = {
  args: {
    onSuggestionClick: action('suggestion-clicked'),
  },
};

/**
 * Empty state in a constrained container.
 */
export const InContainer: Story = {
  args: {
    onSuggestionClick: action('suggestion-clicked'),
    onUploadClick: action('upload-clicked'),
  },
  decorators: [
    (Story) => (
      <div className="w-[600px] h-[400px] border rounded-lg flex items-center justify-center bg-muted/20">
        <Story />
      </div>
    ),
  ],
};
