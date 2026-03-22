import type { Meta, StoryObj } from '@storybook/react';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { AlertCircle, CheckCircle2, Terminal, Info } from 'lucide-react';

/**
 * Alert component for displaying important messages.
 * Supports different variants for different severity levels.
 */
const meta: Meta<typeof Alert> = {
  title: 'UI/Alert',
  component: Alert,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive'],
      description: 'The visual style of the alert',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default alert style.
 */
export const Default: Story = {
  args: {
    children: (
      <>
        <Terminal className="h-4 w-4" />
        <AlertTitle>Heads up!</AlertTitle>
        <AlertDescription>
          You can add components to your app using the CLI.
        </AlertDescription>
      </>
    ),
  },
};

/**
 * Destructive alert for errors.
 */
export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: (
      <>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Something went wrong. Please try again later.
        </AlertDescription>
      </>
    ),
  },
};

/**
 * Success alert (custom styling).
 */
export const Success: Story = {
  render: () => (
    <Alert className="border-green-500/50 bg-green-500/10 text-green-500">
      <CheckCircle2 className="h-4 w-4" />
      <AlertTitle>Success</AlertTitle>
      <AlertDescription>
        Your changes have been saved successfully.
      </AlertDescription>
    </Alert>
  ),
};

/**
 * Info alert (custom styling).
 */
export const Info: Story = {
  render: () => (
    <Alert className="border-blue-500/50 bg-blue-500/10 text-blue-500">
      <Info className="h-4 w-4" />
      <AlertTitle>Information</AlertTitle>
      <AlertDescription>
        A new version is available. Update now to get the latest features.
      </AlertDescription>
    </Alert>
  ),
};

/**
 * Alert without description.
 */
export const TitleOnly: Story = {
  args: {
    children: (
      <>
        <Info className="h-4 w-4" />
        <AlertTitle>This is a simple alert message</AlertTitle>
      </>
    ),
  },
};

/**
 * Alert with long content.
 */
export const LongContent: Story = {
  args: {
    children: (
      <>
        <Info className="h-4 w-4" />
        <AlertTitle>Important Notice</AlertTitle>
        <AlertDescription>
          This is a longer alert message that contains more detailed information
          about the current state. It might span multiple lines and provide
          additional context to help users understand what&apos;s happening and
          what actions they should take next.
        </AlertDescription>
      </>
    ),
  },
};

/**
 * Multiple alerts stacked.
 */
export const Stacked: Story = {
  render: () => (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Information</AlertTitle>
        <AlertDescription>This is an informational message.</AlertDescription>
      </Alert>
      <Alert className="border-yellow-500/50 bg-yellow-500/10 text-yellow-600">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Warning</AlertTitle>
        <AlertDescription>Please review your settings before continuing.</AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to save changes. Please try again.</AlertDescription>
      </Alert>
    </div>
  ),
};
