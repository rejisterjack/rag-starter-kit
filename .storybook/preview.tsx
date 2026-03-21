import type { Preview } from '@storybook/react';
import React from 'react';
import '../src/styles/globals.css';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    backgrounds: {
      default: 'dark',
      values: [
        {
          name: 'light',
          value: '#ffffff',
        },
        {
          name: 'dark',
          value: '#18181b',
        },
      ],
    },
    docs: {
      toc: true,
    },
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-background p-4">
        <Story />
      </div>
    ),
  ],
};

export default preview;
