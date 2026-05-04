import type { Meta, StoryObj } from '@storybook/react';
import { Textarea } from './textarea';

const meta: Meta<typeof Textarea> = {
  title: 'UI/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  argTypes: {
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    rows: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  args: {
    placeholder: 'Type your message here...',
  },
};

export const WithValue: Story = {
  args: {
    defaultValue:
      'This is a pre-filled textarea with some content that demonstrates how text looks inside the component.',
  },
};

export const Disabled: Story = {
  args: {
    placeholder: 'This textarea is disabled',
    disabled: true,
  },
};

export const ChatInput: Story = {
  args: {
    placeholder: 'Ask anything about your documents...',
    rows: 3,
    className: 'resize-none',
  },
  decorators: [
    (Story) => (
      <div className="max-w-lg p-4 glass-panel rounded-xl">
        <Story />
      </div>
    ),
  ],
};
