import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInputArea as ChatInput } from '@/components/chat/chat-input-area';

vi.mock('@/lib/offline/draft-storage', () => ({
  loadDraft: vi.fn().mockResolvedValue(null),
  autoSaveDraft: vi.fn(),
  deleteDraft: vi.fn(),
}));

vi.mock('@/hooks/use-connectivity', () => ({
  useConnectivity: () => ({ isOffline: false, isLiefi: false, isReconnecting: false }),
}));

vi.mock('@/hooks/use-offline-query', () => ({
  useOfflineMutation: () => ({ mutate: vi.fn(), pendingCount: 0 }),
}));

describe('ChatInput', () => {
  const defaultProps = {
    hasMessages: false,
    isLoading: false,
    isStreaming: false,
    onSendMessage: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders input field correctly', () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder');
  });

  it('handles text input', async () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Hello world');

    expect(input).toHaveValue('Hello world');
  });

  it('submits message on Enter key', async () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Test message');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(defaultProps.onSendMessage).toHaveBeenCalledWith('Test message', undefined);
  });

  it('does not submit on Shift+Enter (newline)', async () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Line 1');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    expect(defaultProps.onSendMessage).not.toHaveBeenCalled();
  });

  it('submits message on button click', async () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Click test');

    const submitButton = screen.getByRole('button', { name: /send/i });
    fireEvent.click(submitButton);

    expect(defaultProps.onSendMessage).toHaveBeenCalledWith('Click test', undefined);
  });

  it('clears input after submission', async () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Clear me');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('shows loading state', () => {
    render(<ChatInput {...defaultProps} isLoading />);

    const submitButton = screen.getByRole('button', { name: /send/i });
    expect(submitButton).toBeDisabled();

    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('disables input when loading', () => {
    render(<ChatInput {...defaultProps} isLoading />);

    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('submits with Ctrl+Enter', async () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Ctrl enter test');
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });

    expect(defaultProps.onSendMessage).toHaveBeenCalledWith('Ctrl enter test', undefined);
  });

  it('submits with Cmd+Enter on Mac', async () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Cmd enter test');
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true });

    expect(defaultProps.onSendMessage).toHaveBeenCalledWith('Cmd enter test', undefined);
  });

  it('is accessible with proper ARIA attributes', () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('placeholder');
  });
});
