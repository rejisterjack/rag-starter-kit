import type { Meta, StoryObj } from '@storybook/react';
import { AlertCircle, Check, X } from 'lucide-react';
import { Badge } from './badge';

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Badge component for displaying status, labels, and counts.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: {
    children: 'Badge',
    variant: 'default',
  },
};

export const Secondary: Story = {
  args: {
    children: 'Secondary',
    variant: 'secondary',
  },
};

export const Destructive: Story = {
  args: {
    children: 'Error',
    variant: 'destructive',
  },
};

export const Outline: Story = {
  args: {
    children: 'Outline',
    variant: 'outline',
  },
};

export const Success: Story = {
  args: {
    children: (
      <>
        <Check className="mr-1 h-3 w-3" />
        Completed
      </>
    ),
    className: 'bg-green-100 text-green-800 hover:bg-green-100',
  },
};

export const Warning: Story = {
  args: {
    children: (
      <>
        <AlertCircle className="mr-1 h-3 w-3" />
        Warning
      </>
    ),
    className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  },
};

export const Info: Story = {
  args: {
    children: (
      <>
        <Info className="mr-1 h-3 w-3" />
        Info
      </>
    ),
    className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  },
};

export const Processing: Story = {
  args: {
    children: (
      <>
        <div className="mr-1 h-2 w-2 animate-pulse rounded-full bg-current" />
        Processing
      </>
    ),
  },
};

export const WithCount: Story = {
  args: {
    children: 'Messages 12',
  },
};

export const Dismissible: Story = {
  args: {
    children: (
      <>
        Tag
        <X className="ml-1 h-3 w-3 cursor-pointer" />
      </>
    ),
    variant: 'secondary',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge className="bg-green-100 text-green-800">Success</Badge>
      <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>
      <Badge className="bg-blue-100 text-blue-800">Info</Badge>
    </div>
  ),
};

export const DocumentStatus: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Badge className="bg-gray-100 text-gray-800">Pending</Badge>
        <Badge className="bg-blue-100 text-blue-800">
          <div className="mr-1 h-2 w-2 animate-pulse rounded-full bg-current" />
          Processing
        </Badge>
        <Badge className="bg-green-100 text-green-800">
          <Check className="mr-1 h-3 w-3" />
          Completed
        </Badge>
        <Badge variant="destructive">
          <X className="mr-1 h-3 w-3" />
          Failed
        </Badge>
      </div>
    </div>
  ),
};
