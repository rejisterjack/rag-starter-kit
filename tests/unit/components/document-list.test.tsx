import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Document } from '@/components/documents/document-card';
import { DocumentList } from '@/components/documents/document-list';
import { sampleDocuments } from '@/tests/utils/fixtures/documents';

function toListDocument(doc: (typeof sampleDocuments)[number]): Document {
  const statusMap = {
    COMPLETED: 'completed',
    PROCESSING: 'processing',
    FAILED: 'error',
    PENDING: 'pending',
  } as const;

  return {
    id: doc.id ?? 'doc-unknown',
    name: doc.name ?? 'unknown',
    type: doc.type ?? 'application/octet-stream',
    size: doc.size ?? 0,
    status: statusMap[(doc.status as keyof typeof statusMap) ?? 'PENDING'] ?? 'pending',
    createdAt: doc.createdAt ?? new Date(),
  };
}

const listDocuments = sampleDocuments.map(toListDocument);

describe('DocumentList', () => {
  const mockOnPreview = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnUpload = vi.fn();

  it('renders list of documents', () => {
    render(<DocumentList documents={listDocuments} />);

    listDocuments.forEach((doc) => {
      expect(screen.getByText(doc.name)).toBeInTheDocument();
    });
  });

  it('shows empty state when no documents', () => {
    render(<DocumentList documents={[]} />);

    expect(screen.getByText(/no documents/i)).toBeInTheDocument();
  });

  it('calls onPreview when document is clicked', () => {
    render(<DocumentList documents={listDocuments} onPreview={mockOnPreview} />);

    fireEvent.click(screen.getByText(listDocuments[0]!.name));
    expect(mockOnPreview).toHaveBeenCalledWith(listDocuments[0]);
  });

  it('renders search input', () => {
    render(<DocumentList documents={listDocuments} />);

    expect(screen.getByLabelText(/search documents/i)).toBeInTheDocument();
  });

  it('filters documents by search query', () => {
    render(<DocumentList documents={listDocuments} />);

    const search = screen.getByLabelText(/search documents/i);
    fireEvent.change(search, { target: { value: 'annual-report' } });

    expect(screen.getByText('annual-report-2024.pdf')).toBeInTheDocument();
    expect(screen.queryByText('project-specs.docx')).not.toBeInTheDocument();
  });

  it('calls onUpload when upload button is clicked', () => {
    render(<DocumentList documents={listDocuments} onUpload={mockOnUpload} />);

    fireEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(mockOnUpload).toHaveBeenCalled();
  });

  it('shows delete-all when onDeleteAll is provided', () => {
    const mockOnDeleteAll = vi.fn();
    render(
      <DocumentList
        documents={listDocuments}
        onDeleteAll={mockOnDeleteAll}
        onDelete={mockOnDelete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /delete all documents/i }));
    expect(mockOnDeleteAll).toHaveBeenCalled();
  });

  it('shows loading skeleton when isLoading', () => {
    render(<DocumentList documents={[]} isLoading />);

    expect(screen.getByLabelText(/document library/i)).toHaveAttribute('aria-busy', 'true');
  });
});
