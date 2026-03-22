import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton } from './skeleton';

/**
 * Skeleton component for showing loading states.
 * Use to reduce perceived loading time and prevent layout shift.
 */
const meta: Meta<typeof Skeleton> = {
  title: 'UI/Skeleton',
  component: Skeleton,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default skeleton (full width).
 */
export const Default: Story = {
  args: {
    className: 'h-4 w-full',
  },
};

/**
 * Circular skeleton for avatars.
 */
export const Circle: Story = {
  args: {
    className: 'h-12 w-12 rounded-full',
  },
};

/**
 * Card skeleton layout.
 */
export const Card: Story = {
  render: () => (
    <div className="w-[300px] space-y-3">
      <Skeleton className="h-[125px] w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  ),
};

/**
 * Message skeleton for chat loading.
 */
export const Message: Story = {
  render: () => (
    <div className="flex items-start gap-4 w-[500px]">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    </div>
  ),
};

/**
 * List skeleton for table/list loading.
 */
export const List: Story = {
  render: () => (
    <div className="w-[400px] space-y-3">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  ),
};

/**
 * Statistics cards skeleton.
 */
export const Stats: Story = {
  render: () => (
    <div className="grid grid-cols-4 gap-4 w-[600px]">
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-24 rounded-lg" />
    </div>
  ),
};
