import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './input';
import { Label } from './label';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A form input component for text entry.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'tel', 'url'],
      description: 'The type of input',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the input is disabled',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default input
export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
    type: 'text',
  },
};

// With Label
export const WithLabel: Story = {
  render: () => (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor="email">Email</Label>
      <Input type="email" id="email" placeholder="Email" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Input with an associated label.',
      },
    },
  },
};

// Input Types
export const Types: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-4">
      <div>
        <Label htmlFor="text">Text</Label>
        <Input type="text" id="text" placeholder="Text input" />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input type="email" id="email" placeholder="Email input" />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input type="password" id="password" placeholder="Password input" />
      </div>
      <div>
        <Label htmlFor="number">Number</Label>
        <Input type="number" id="number" placeholder="Number input" />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Different input types.',
      },
    },
  },
};

// Disabled State
export const Disabled: Story = {
  args: {
    placeholder: 'Disabled input',
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Disabled input cannot be interacted with.',
      },
    },
  },
};

// With Error
export const WithError: Story = {
  render: () => (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor="error">Email</Label>
      <Input
        type="email"
        id="error"
        placeholder="Email"
        aria-invalid="true"
        className="border-destructive"
      />
      <p className="text-sm text-destructive">Please enter a valid email address.</p>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Input with error state and message.',
      },
    },
  },
};

// File Input
export const File: Story = {
  render: () => (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor="picture">Picture</Label>
      <Input id="picture" type="file" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'File input for uploading files.',
      },
    },
  },
};

// Playground
export const Playground: Story = {
  args: {
    placeholder: 'Type something...',
    type: 'text',
    disabled: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Customize the input using the controls panel.',
      },
    },
  },
};
