import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceLimitsForm } from '@/components/admin/workspaces/workspace-limits-form';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

const workspace = {
  maxDocuments: 100,
  maxStorageMb: 2048,
  maxChats: 500,
  maxChatPerDay: 50,
  llmProvider: null,
  llmModel: null,
};

describe('WorkspaceLimitsForm (D-19)', () => {
  it('opens the inline limits form when "Edit Limits" is clicked', () => {
    render(<WorkspaceLimitsForm workspaceId="ws-1" workspace={workspace} />);

    const editButton = screen.getByRole('button', { name: /edit limits/i });
    expect(editButton).toBeInTheDocument();

    fireEvent.click(editButton);

    // The expanded form renders the Save/Cancel actions and limit inputs
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/max documents/i)).toBeInTheDocument();
  });

  it('starts collapsed showing only the edit button', () => {
    render(<WorkspaceLimitsForm workspaceId="ws-1" workspace={workspace} />);

    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit limits/i })).toBeInTheDocument();
  });
});
