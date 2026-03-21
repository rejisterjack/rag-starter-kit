import type { Meta, StoryObj } from '@storybook/react';
import type { Document } from './document-card';
import { DocumentCard } from './document-card';

const meta: Meta<typeof DocumentCard> = {
  title: 'Documents/DocumentCard',
  component: DocumentCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Card component for displaying document information with status and actions.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DocumentCard>;

const baseDocument: Document = {
  id: 'doc-1',
  name: 'Project-Requirements.pdf',
  type: 'pdf',
  size: 1024 * 1024 * 2.5, // 2.5 MB
  status: 'completed',
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
  pages: 15,
};

export const Completed: Story = {
  args: {
    document: baseDocument,
    onPreview: () => {},
    onDelete: () => {},
  },
};

export const Processing: Story = {
  args: {
    document: {
      ...baseDocument,
      id: 'doc-2',
      name: 'Research-Paper.docx',
      type: 'docx',
      status: 'processing',
      pages: 0,
    },
    onPreview: () => {},
    onDelete: () => {},
  },
};

export const Pending: Story = {
  args: {
    document: {
      ...baseDocument,
      id: 'doc-3',
      name: 'Meeting-Notes.txt',
      type: 'txt',
      status: 'pending',
      size: 1024 * 5, // 5 KB
      pages: 0,
    },
    onPreview: () => {},
    onDelete: () => {},
  },
};

export const Failed: Story = {
  args: {
    document: {
      ...baseDocument,
      id: 'doc-4',
      name: 'Corrupted-File.pdf',
      type: 'pdf',
      status: 'failed',
      pages: 0,
    },
    onPreview: () => {},
    onDelete: () => {},
  },
};

export const LargeFile: Story = {
  args: {
    document: {
      ...baseDocument,
      id: 'doc-5',
      name: 'Annual-Report-2024.pdf',
      type: 'pdf',
      size: 1024 * 1024 * 45, // 45 MB
      pages: 150,
    },
    onPreview: () => {},
    onDelete: () => {},
  },
};

export const Markdown: Story = {
  args: {
    document: {
      ...baseDocument,
      id: 'doc-6',
      name: 'Documentation.md',
      type: 'md',
      size: 1024 * 15, // 15 KB
      status: 'completed',
      pages: 0,
    },
    onPreview: () => {},
    onDelete: () => {},
  },
};

export const Selected: Story = {
  args: {
    document: baseDocument,
    isSelected: true,
    onPreview: () => {},
    onDelete: () => {},
  },
};

export const DarkMode: Story = {
  args: {
    document: baseDocument,
    onPreview: () => {},
    onDelete: () => {},
  },
  parameters: {
    themes: {
      default: 'dark',
    },
  },
};

export const GridView: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 w-[600px]">
      <DocumentCard document={baseDocument} onPreview={() => {}} onDelete={() => {}} />
      <DocumentCard
        document={{
          ...baseDocument,
          id: 'doc-7',
          name: 'Architecture-Diagram.pdf',
          type: 'pdf',
          status: 'completed',
        }}
        onPreview={() => {}}
        onDelete={() => {}}
      />
      <DocumentCard
        document={{
          ...baseDocument,
          id: 'doc-8',
          name: 'API-Documentation.md',
          type: 'md',
          status: 'processing',
        }}
        onPreview={() => {}}
        onDelete={() => {}}
      />
      <DocumentCard
        document={{
          ...baseDocument,
          id: 'doc-9',
          name: 'User-Guide.docx',
          type: 'docx',
          status: 'completed',
        }}
        onPreview={() => {}}
        onDelete={() => {}}
      />
    </div>
  ),
};
