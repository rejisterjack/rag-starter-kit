import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentList } from '@/components/documents/document-list';
import { sampleDocuments } from '@/tests/utils/fixtures/documents';

describe('DocumentList', () => {
  const mockOnSelect = vi.fn();
  const mockOnDelete = vi.fn();
  // const mockOnDownload = vi.fn();

  it('renders list of documents', () => {
    render(<DocumentList documents={sampleDocuments as any} />);

    sampleDocuments.forEach((doc) => {
      expect(screen.getByText(doc.name!)).toBeInTheDocument();
    });
  });

  it('shows empty state when no documents', () => {
    render(<DocumentList documents={[]} />);

    expect(screen.getByText(/no documents/i)).toBeInTheDocument();
  });

  it('calls onSelect when document is clicked', () => {
    render(<DocumentList documents={sampleDocuments as any} onSelect={mockOnSelect} />);

    fireEvent.click(screen.getByText(sampleDocuments[0].name!));
    expect(mockOnSelect).toHaveBeenCalledWith(sampleDocuments[0].id);
  });

  it('displays document status correctly', () => {
    render(<DocumentList documents={sampleDocuments as any} />);

    expect(screen.getByText('processed')).toBeInTheDocument();
    expect(screen.getByText('processing')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
  });

  it('formats file size correctly', () => {
    render(<DocumentList documents={sampleDocuments as any} />);

    expect(screen.getByText(/MB/)).toBeInTheDocument();
  });

  it('shows checkbox for multi-select', () => {
    render(<DocumentList documents={sampleDocuments as any} selectable />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it('handles select all', () => {
    const mockOnSelectAll = vi.fn();

    render(
      <DocumentList documents={sampleDocuments as any} selectable onSelectAll={mockOnSelectAll} />
    );

    const selectAllCheckbox = screen.getByLabelText(/select all/i);
    fireEvent.click(selectAllCheckbox);

    expect(mockOnSelectAll).toHaveBeenCalled();
  });

  it('shows delete button on hover', () => {
    render(<DocumentList documents={sampleDocuments as any} onDelete={mockOnDelete} />);

    const firstDoc = screen.getByText(sampleDocuments[0].name!).closest('div');
    fireEvent.mouseEnter(firstDoc!);

    const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0];
    expect(deleteButton).toBeVisible();
  });

  it('shows processing indicator for pending documents', () => {
    render(<DocumentList documents={sampleDocuments as any} />);

    const processingSpinner = screen.getByTestId('processing-spinner');
    expect(processingSpinner).toBeInTheDocument();
  });

  it('formats date correctly', () => {
    render(<DocumentList documents={sampleDocuments as any} />);

    // Should show relative date
    expect(screen.getAllByText(/ago|today|yesterday/i).length).toBeGreaterThan(0);
  });
});
