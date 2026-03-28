import type { Meta, StoryObj } from '@storybook/react';
import { Lock, Mail, Search as SearchIcon, User } from 'lucide-react';
import { Input } from './input';
import { Label } from './label';

/**
 * Input component for text entry.
 * Supports icons, states, and various types.
 */
const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'password', 'email', 'number', 'search', 'tel', 'url'],
    },
    disabled: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default text input.
 */
export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
};

/**
 * Input with label.
 */
export const WithLabel: Story = {
  render: () => (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor="email">Email</Label>
      <Input type="email" id="email" placeholder="Email" />
    </div>
  ),
};

/**
 * Disabled input.
 */
export const Disabled: Story = {
  args: {
    placeholder: 'Disabled input',
    disabled: true,
  },
};

/**
 * Input with icon.
 */
export const WithIcon: Story = {
  render: () => (
    <div className="relative w-full max-w-sm">
      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input className="pl-10" placeholder="Email address" type="email" />
    </div>
  ),
};

/**
 * Password input.
 */
export const Password: Story = {
  render: () => (
    <div className="relative w-full max-w-sm">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input className="pl-10" placeholder="Password" type="password" />
    </div>
  ),
};

/**
 * Search input.
 */
export const Search: Story = {
  render: () => (
    <div className="relative w-full max-w-sm">
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input className="pl-10" placeholder="Search..." type="search" />
    </div>
  ),
};

/**
 * File input.
 */
export const File: Story = {
  render: () => (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor="picture">Picture</Label>
      <Input id="picture" type="file" />
    </div>
  ),
};

/**
 * Input states showcase.
 */
export const AllStates: Story = {
  render: () => (
    <div className="space-y-4 w-[350px]">
      <div>
        <Label>Default</Label>
        <Input placeholder="Default input" />
      </div>
      <div>
        <Label>With Icon</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Username" />
        </div>
      </div>
      <div>
        <Label>Disabled</Label>
        <Input placeholder="Disabled input" disabled />
      </div>
      <div>
        <Label>Error</Label>
        <Input placeholder="Error state" className="border-red-500 focus-visible:ring-red-500" />
        <p className="text-sm text-red-500 mt-1">This field is required</p>
      </div>
    </div>
  ),
};
