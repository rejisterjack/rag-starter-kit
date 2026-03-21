/**
 * Utility Functions Unit Tests
 */

import { describe, expect, it } from 'vitest';
import { cn, formatDate, truncate } from '@/lib/utils';

describe('cn (className utility)', () => {
  it('should merge class names correctly', () => {
    const result = cn('class1', 'class2');
    expect(result).toBe('class1 class2');
  });

  it('should handle conditional classes', () => {
    const result = cn('base', {
      'active': true,
      'disabled': false,
    });
    expect(result).toBe('base active');
  });

  it('should filter out falsy values', () => {
    const result = cn('base', null, undefined, false, 'valid');
    expect(result).toBe('base valid');
  });

  it('should handle tailwind merge conflicts', () => {
    const result = cn('px-2 py-1', 'px-4');
    expect(result).toBe('py-1 px-4');
  });
});

describe('formatDate', () => {
  it('should format date correctly', () => {
    const date = new Date('2024-01-15');
    const result = formatDate(date);
    expect(result).toContain('2024');
  });

  it('should handle invalid date', () => {
    const result = formatDate(null as unknown as Date);
    expect(result).toBe('');
  });
});

describe('truncate', () => {
  it('should truncate long text', () => {
    const longText = 'This is a very long text that should be truncated';
    const result = truncate(longText, 20);
    expect(result).toHaveLength(20);
    expect(result.endsWith('...')).toBe(true);
  });

  it('should not truncate short text', () => {
    const shortText = 'Short';
    const result = truncate(shortText, 20);
    expect(result).toBe(shortText);
  });
});
