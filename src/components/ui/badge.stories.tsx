import type { Meta, StoryObj } from '@storybook/react';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Badge } from './badge';

/**
 * Badge component for displaying status, labels, and counts.
 * Supports multiple variants for different semantic meanings.
 */
const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
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

/**
 * Default badge style.
 */
export const Default: Story = {
  args: {
    children: 'Badge',
    variant: 'default',
  },
};

/**
 * Secondary badge with muted background.
 */
export const Secondary: Story = {
  args: {
    children: 'Secondary',
    variant: 'secondary',
  },
};

/**
 * Destructive badge for errors or warnings.
 */
export const Destructive: Story = {
  args: {
    children: 'Error',
    variant: 'destructive',
  },
};

/**
 * Outline badge with border only.
 */
export const Outline: Story = {
  args: {
    children: 'Outline',
    variant: 'outline',
  },
};

/**
 * Badge with an icon.
 */
export const WithIcon: Story = {
  args: {
    children: (
      <>
        <CheckCircle className="h-3 w-3 mr-1" />
        Success
      </>
    ),
    variant: 'default',
  },
};

/**
 * Status badges for webhook deliveries.
 */
export const DeliveryStatuses: Story = {
  render: () => (
    <div className="flex gap-2">
      <Badge variant="default" className="bg-green-500/10 text-green-500 hover:bg-green-500/20">
        <CheckCircle className="h-3 w-3 mr-1" />
        Delivered
      </Badge>
      <Badge variant="destructive">
        <AlertCircle className="h-3 w-3 mr-1" />
        Failed
      </Badge>
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    </div>
  ),
};

/**
 * All variants displayed together.
 */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};
