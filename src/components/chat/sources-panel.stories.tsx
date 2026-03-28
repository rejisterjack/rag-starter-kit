import { action } from '@storybook/addon-actions';
import type { Meta, StoryObj } from '@storybook/react';
import { InlineSourcesPanel, SourcesPanel } from './sources-panel';

const sampleSources = [
  {
    id: '1',
    index: 1,
    documentName: 'Q3 Financial Report',
    documentType: 'pdf',
    chunkText:
      'Revenue increased by 15% year-over-year, reaching $2.4M. The growth was primarily driven by new enterprise contracts.',
    pageNumber: 5,
    relevanceScore: 0.92,
  },
  {
    id: '2',
    index: 2,
    documentName: 'Annual Review 2024',
    documentType: 'pdf',
    chunkText: 'Customer acquisition cost decreased by 20% while lifetime value increased by 35%.',
    pageNumber: 12,
    relevanceScore: 0.87,
  },
  {
    id: '3',
    index: 3,
    documentName: 'Product Roadmap',
    documentType: 'pdf',
    chunkText:
      'The new AI features are scheduled for Q4 release, with beta testing starting in October.',
    pageNumber: 3,
    relevanceScore: 0.75,
  },
];

/**
 * SourcesPanel component displays RAG sources/citations
 * in a slide-out panel or inline.
 */
const meta: Meta<typeof SourcesPanel> = {
  title: 'Chat/SourcesPanel',
  component: SourcesPanel,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Slide-out panel (modal) view.
 */
export const Modal: Story = {
  args: {
    sources: sampleSources,
    isOpen: true,
    onClose: action('closed'),
    onSourceClick: action('source-clicked'),
  },
};

/**
 * Inline panel view.
 */
export const Inline: Story = {
  render: () => (
    <div className="h-[500px] border rounded-lg overflow-hidden">
      <InlineSourcesPanel
        sources={sampleSources}
        isCollapsed={false}
        onToggle={action('toggle')}
        onSourceClick={action('source-clicked')}
      />
    </div>
  ),
};

/**
 * Inline panel collapsed.
 */
export const InlineCollapsed: Story = {
  render: () => (
    <div className="h-[500px] border rounded-lg overflow-hidden">
      <InlineSourcesPanel
        sources={sampleSources}
        isCollapsed={true}
        onToggle={action('toggle')}
        onSourceClick={action('source-clicked')}
      />
    </div>
  ),
};

/**
 * Empty sources state.
 */
export const Empty: Story = {
  args: {
    sources: [],
    isOpen: true,
    onClose: action('closed'),
  },
};

/**
 * Single source.
 */
export const SingleSource: Story = {
  args: {
    sources: [sampleSources[0]],
    isOpen: true,
    onClose: action('closed'),
    onSourceClick: action('source-clicked'),
  },
};

/**
 * Many sources (scrolling).
 */
export const ManySources: Story = {
  args: {
    sources: [
      ...sampleSources,
      ...sampleSources.map((s, i) => ({ ...s, id: `${s.id}-copy-${i}`, index: s.index + 3 })),
      ...sampleSources.map((s, i) => ({ ...s, id: `${s.id}-copy2-${i}`, index: s.index + 6 })),
    ],
    isOpen: true,
    onClose: action('closed'),
    onSourceClick: action('source-clicked'),
  },
};
