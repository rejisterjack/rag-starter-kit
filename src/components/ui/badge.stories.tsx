import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './badge';

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A badge component for displaying status or labels.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline'],
      description: 'The visual style of the badge',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default badge
export const Default: Story = {
  args: {
    children: 'Badge',
    variant: 'default',
  },
};

// Variants
export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All available badge variants.',
      },
    },
  },
};

// Common Use Cases
export const UseCases: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Badge>Active</Badge>
        <Badge variant="secondary">Pending</Badge>
        <Badge variant="destructive">Error</Badge>
        <Badge variant="outline">Draft</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge>New</Badge>
        <Badge variant="secondary">Beta</Badge>
        <Badge variant="destructive">Deprecated</Badge>
        <Badge variant="outline">Archived</Badge>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Common use cases for badges.',
      },
    },
  },
};

// Playground
export const Playground: Story = {
  args: {
    children: 'Custom Badge',
    variant: 'default',
  },
  parameters: {
    docs: {
      description: {
        story: 'Customize the badge using the controls panel.',
      },
    },
  },
};
