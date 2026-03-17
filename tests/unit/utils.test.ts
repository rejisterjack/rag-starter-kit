import { describe, expect, it } from 'vitest';

import { cn, formatDate, generateId, truncate } from '@/lib/utils';

describe('cn (className utilities)', () => {
  it('should merge class names correctly', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
  });

  it('should handle conditional classes', () => {
    expect(cn('base', true && 'conditional')).toBe('base conditional');
    expect(cn('base', false && 'conditional')).toBe('base');
  });

  it('should merge Tailwind classes properly', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });
});

describe('formatDate', () => {
  it('should format a date string correctly', () => {
    const date = new Date('2024-01-15');
    const formatted = formatDate(date);
    expect(formatted).toContain('January');
    expect(formatted).toContain('15');
    expect(formatted).toContain('2024');
  });

  it('should handle string input', () => {
    const formatted = formatDate('2024-01-15');
    expect(formatted).toContain('January');
  });
});

describe('truncate', () => {
  it('should truncate strings longer than specified length', () => {
    const longString = 'This is a very long string that needs truncation';
    const truncated = truncate(longString, 20);
    expect(truncated.length).toBeLessThanOrEqual(23); // 20 + '...'
    expect(truncated.endsWith('...')).toBe(true);
  });

  it('should not truncate strings shorter than specified length', () => {
    const shortString = 'Short';
    const truncated = truncate(shortString, 20);
    expect(truncated).toBe(shortString);
  });
});

describe('generateId', () => {
  it('should generate an ID of default length 16', () => {
    const id = generateId();
    expect(id.length).toBe(16);
  });

  it('should generate an ID of specified length', () => {
    const id = generateId(32);
    expect(id.length).toBe(32);
  });

  it('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });
});
