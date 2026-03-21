import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';
import { Loader2, Plus, Trash2, Save } from 'lucide-react';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A versatile button component with multiple variants and sizes.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      description: 'The visual style of the button',
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
      description: 'The size of the button',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the button is disabled',
    },
    loading: {
      control: 'boolean',
      description: 'Whether to show a loading spinner',
    },
    asChild: {
      control: 'boolean',
      description: 'Render as a child element',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default button
export const Default: Story = {
  args: {
    children: 'Button',
    variant: 'default',
    size: 'default',
  },
};

// Variants
export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="default">Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All available button variants.',
      },
    },
  },
};

// Sizes
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon">
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All available button sizes.',
      },
    },
  },
};

// With Icons
export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button>
        <Plus className="mr-2 h-4 w-4" />
        Add New
      </Button>
      <Button variant="outline">
        <Save className="mr-2 h-4 w-4" />
        Save
      </Button>
      <Button variant="destructive">
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Buttons with icons.',
      },
    },
  },
};

// Loading State
export const Loading: Story = {
  args: {
    children: 'Loading',
    loading: true,
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Button in loading state shows a spinner and is disabled.',
      },
    },
  },
};

// Disabled State
export const Disabled: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button disabled>Disabled</Button>
      <Button variant="secondary" disabled>
        Disabled
      </Button>
      <Button variant="outline" disabled>
        Disabled
      </Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Disabled buttons are not interactive.',
      },
    },
  },
};

// As Link
export const AsLink: Story = {
  render: () => (
    <Button asChild>
      <a href="https://example.com" target="_blank" rel="noopener noreferrer">
        External Link
      </a>
    </Button>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Button rendered as a link element.',
      },
    },
  },
};

// Playground
export const Playground: Story = {
  args: {
    children: 'Playground Button',
    variant: 'default',
    size: 'default',
    disabled: false,
    loading: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Customize the button using the controls panel.',
      },
    },
  },
};
