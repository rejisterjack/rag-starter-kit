import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';
import { Input } from './input';
import { Label } from './label';

/**
 * Card component for containing related content.
 * Composed of Header, Content, and Footer sections.
 */
const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Simple card with content only.
 */
export const Simple: Story = {
  args: {
    children: (
      <CardContent className="pt-6">
        <p>This is a simple card with just content.</p>
      </CardContent>
    ),
  },
};

/**
 * Card with header and content.
 */
export const WithHeader: Story = {
  args: {
    className: 'w-[350px]',
    children: (
      <>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>You have 3 unread messages.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Card content goes here with more details.</p>
        </CardContent>
      </>
    ),
  },
};

/**
 * Card with all sections.
 */
export const Complete: Story = {
  args: {
    className: 'w-[350px]',
    children: (
      <>
        <CardHeader>
          <CardTitle>Create Project</CardTitle>
          <CardDescription>Deploy your new project in one-click.</CardDescription>
        </CardHeader>
        <CardContent>
          <form>
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="Name of your project" />
              </div>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="ghost">Cancel</Button>
          <Button>Deploy</Button>
        </CardFooter>
      </>
    ),
  },
};

/**
 * Stats card layout.
 */
export const Stats: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4 w-[600px]">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Total Revenue</CardDescription>
          <CardTitle className="text-3xl">$45,231</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">+20.1% from last month</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Active Users</CardDescription>
          <CardTitle className="text-3xl">2,350</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">+180 new this week</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Churn Rate</CardDescription>
          <CardTitle className="text-3xl">2.1%</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">-0.3% from last month</p>
        </CardContent>
      </Card>
    </div>
  ),
};

/**
 * Interactive hover state.
 */
export const Hoverable: Story = {
  args: {
    className: 'w-[350px] transition-shadow hover:shadow-lg cursor-pointer',
    children: (
      <CardContent className="pt-6">
        <h3 className="font-semibold mb-2">Hover over me</h3>
        <p className="text-sm text-muted-foreground">
          This card has a hover effect that adds a shadow.
        </p>
      </CardContent>
    ),
  },
};
