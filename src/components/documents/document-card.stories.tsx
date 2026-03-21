import type { Meta, StoryObj } from '@storybook/react';
import { DocumentCard } from './document-card';
import type { Document } from './document-card';

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
    onPreview: () => console.log('Preview clicked'),
    onDelete: () => console.log('Delete clicked'),
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
    onPreview: () => console.log('Preview clicked'),
    onDelete: () => console.log('Delete clicked'),
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
    onPreview: () => console.log('Preview clicked'),
    onDelete: () => console.log('Delete clicked'),
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
    onPreview: () => console.log('Preview clicked'),
    onDelete: () => console.log('Delete clicked'),
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
    onPreview: () => console.log('Preview clicked'),
    onDelete: () => console.log('Delete clicked'),
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
    onPreview: () => console.log('Preview clicked'),
    onDelete: () => console.log('Delete clicked'),
  },
};

export const Selected: Story = {
  args: {
    document: baseDocument,
    isSelected: true,
    onPreview: () => console.log('Preview clicked'),
    onDelete: () => console.log('Delete clicked'),
  },
};

export const DarkMode: Story = {
  args: {
    document: baseDocument,
    onPreview: () => console.log('Preview clicked'),
    onDelete: () => console.log('Delete clicked'),
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
      <DocumentCard
        document={baseDocument}
        onPreview={() => console.log('Preview 1')}
        onDelete={() => console.log('Delete 1')}
      />
      <DocumentCard
        document={{
          ...baseDocument,
          id: 'doc-7',
          name: 'Architecture-Diagram.pdf',
          type: 'pdf',
          status: 'completed',
        }}
        onPreview={() => console.log('Preview 2')}
        onDelete={() => console.log('Delete 2')}
      />
      <DocumentCard
        document={{
          ...baseDocument,
          id: 'doc-8',
          name: 'API-Documentation.md',
          type: 'md',
          status: 'processing',
        }}
        onPreview={() => console.log('Preview 3')}
        onDelete={() => console.log('Delete 3')}
      />
      <DocumentCard
        document={{
          ...baseDocument,
          id: 'doc-9',
          name: 'User-Guide.docx',
          type: 'docx',
          status: 'completed',
        }}
        onPreview={() => console.log('Preview 4')}
        onDelete={() => console.log('Delete 4')}
      />
    </div>
  ),
};
