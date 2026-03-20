import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInput } from '@/components/chat/chat-input';

describe('ChatInput', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    onFileUpload: vi.fn(),
    isLoading: false,
    disabled: false,
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
    await userEvent.type(input, 'Test message{Enter}');

    expect(defaultProps.onSubmit).toHaveBeenCalledWith('Test message');
  });

  it('does not submit on Shift+Enter (newline)', async () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Line 1');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('submits message on button click', async () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Click test');

    const submitButton = screen.getByRole('button', { name: /send/i });
    fireEvent.click(submitButton);

    expect(defaultProps.onSubmit).toHaveBeenCalledWith('Click test');
  });

  it('clears input after submission', async () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Clear me{Enter}');

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

  it('disables input when disabled prop is true', () => {
    render(<ChatInput {...defaultProps} disabled />);

    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  describe('File Upload', () => {
    it('renders file upload button', () => {
      render(<ChatInput {...defaultProps} allowFileUpload />);

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      expect(uploadButton).toBeInTheDocument();
    });

    it('opens file picker on upload button click', () => {
      render(<ChatInput {...defaultProps} allowFileUpload />);

      const fileInput = screen.getByTestId('file-input');
      const clickSpy = vi.spyOn(fileInput, 'click');

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      fireEvent.click(uploadButton);

      expect(clickSpy).toHaveBeenCalled();
    });

    it('handles file selection', async () => {
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

      render(<ChatInput {...defaultProps} allowFileUpload />);

      const fileInput = screen.getByTestId('file-input');
      await userEvent.upload(fileInput, file);

      await waitFor(() => {
        expect(defaultProps.onFileUpload).toHaveBeenCalledWith([file]);
      });
    });

    it('validates file type', async () => {
      const invalidFile = new File(['test'], 'test.exe', { type: 'application/x-msdownload' });

      render(<ChatInput {...defaultProps} allowFileUpload accept=".pdf,.docx,.txt" />);

      const fileInput = screen.getByTestId('file-input');
      await userEvent.upload(fileInput, invalidFile);

      expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
      expect(defaultProps.onFileUpload).not.toHaveBeenCalled();
    });

    it('validates file size', async () => {
      const largeFile = new File(['x'], 'large.pdf', { type: 'application/pdf' });
      Object.defineProperty(largeFile, 'size', { value: 50 * 1024 * 1024 }); // 50MB

      render(<ChatInput {...defaultProps} allowFileUpload maxFileSize={10 * 1024 * 1024} />);

      const fileInput = screen.getByTestId('file-input');
      await userEvent.upload(fileInput, largeFile);

      expect(screen.getByText(/file too large/i)).toBeInTheDocument();
      expect(defaultProps.onFileUpload).not.toHaveBeenCalled();
    });

    it('displays selected file name', async () => {
      const file = new File(['test'], 'document.pdf', { type: 'application/pdf' });

      render(<ChatInput {...defaultProps} allowFileUpload />);

      const fileInput = screen.getByTestId('file-input');
      await userEvent.upload(fileInput, file);

      expect(screen.getByText('document.pdf')).toBeInTheDocument();
    });

    it('allows removing selected file', async () => {
      const file = new File(['test'], 'document.pdf', { type: 'application/pdf' });

      render(<ChatInput {...defaultProps} allowFileUpload />);

      const fileInput = screen.getByTestId('file-input');
      await userEvent.upload(fileInput, file);

      const removeButton = screen.getByRole('button', { name: /remove file/i });
      fireEvent.click(removeButton);

      expect(screen.queryByText('document.pdf')).not.toBeInTheDocument();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('focuses input on / key when not typing', () => {
      render(<ChatInput {...defaultProps} />);

      fireEvent.keyDown(document, { key: '/' });

      const input = screen.getByRole('textbox');
      expect(document.activeElement).toBe(input);
    });

    it('does not focus on / when modifier keys are pressed', () => {
      render(<ChatInput {...defaultProps} />);

      const input = screen.getByRole('textbox');
      input.blur();

      fireEvent.keyDown(document, { key: '/', ctrlKey: true });

      expect(document.activeElement).not.toBe(input);
    });

    it('submits with Ctrl+Enter', async () => {
      render(<ChatInput {...defaultProps} />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Ctrl enter test');

      fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });

      expect(defaultProps.onSubmit).toHaveBeenCalledWith('Ctrl enter test');
    });

    it('submits with Cmd+Enter on Mac', async () => {
      render(<ChatInput {...defaultProps} />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Cmd enter test');

      fireEvent.keyDown(input, { key: 'Enter', metaKey: true });

      expect(defaultProps.onSubmit).toHaveBeenCalledWith('Cmd enter test');
    });
  });

  describe('Character Count', () => {
    it('displays character count when near limit', async () => {
      render(<ChatInput {...defaultProps} maxLength={100} showCharCount />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'a'.repeat(90));

      expect(screen.getByText(/90\/100/)).toBeInTheDocument();
    });

    it('prevents typing beyond max length', async () => {
      render(<ChatInput {...defaultProps} maxLength={10} />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'This is a very long message');

      expect(input).toHaveValue('This is a ');
    });
  });

  it('is accessible with proper ARIA attributes', () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-label');
    expect(input).toHaveAttribute('aria-multiline', 'true');
  });
});
