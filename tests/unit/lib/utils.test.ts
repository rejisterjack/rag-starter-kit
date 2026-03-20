import { describe, it, expect, vi } from 'vitest';
import {
  cn,
  formatDate,
  formatRelativeTime,
  truncateText,
  slugify,
  generateId,
  sanitizeFilename,
  parseFileSize,
  debounce,
  throttle,
  groupBy,
  uniqueBy,
  sortBy,
  deepClone,
  deepMerge,
  isValidEmail,
  isValidUrl,
} from '@/lib/utils';

describe('cn() utility', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('foo', true && 'bar', false && 'baz')).toBe('foo bar');
  });

  it('handles object syntax', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
  });

  it('merges tailwind classes correctly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('handles undefined and null', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });

  it('handles empty strings', () => {
    expect(cn('foo', '', 'bar')).toBe('foo bar');
  });

  it('handles nested arrays', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
  });
});

describe('Date formatting', () => {
  describe('formatDate', () => {
    it('formats date to locale string', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      expect(formatDate(date)).toContain('2024');
    });

    it('accepts ISO string', () => {
      expect(formatDate('2024-01-15T10:30:00Z')).toContain('2024');
    });

    it('accepts timestamp', () => {
      expect(formatDate(1705312200000)).toContain('2024');
    });

    it('returns empty string for invalid date', () => {
      expect(formatDate('invalid')).toBe('');
    });

    it('applies custom format options', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = formatDate(date, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      expect(formatted).toMatch(/Jan/);
    });
  });

  describe('formatRelativeTime', () => {
    it('formats as "just now" for recent times', () => {
      const now = new Date();
      expect(formatRelativeTime(now)).toBe('just now');
    });

    it('formats minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      expect(formatRelativeTime(fiveMinutesAgo)).toBe('5 minutes ago');
    });

    it('formats hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(formatRelativeTime(twoHoursAgo)).toBe('2 hours ago');
    });

    it('formats days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(threeDaysAgo)).toBe('3 days ago');
    });

    it('switches to absolute date for old dates', () => {
      const oldDate = new Date('2023-01-01');
      expect(formatRelativeTime(oldDate)).toContain('2023');
    });
  });
});

describe('Text processing', () => {
  describe('truncateText', () => {
    it('truncates long text', () => {
      const text = 'This is a very long text that needs truncation';
      expect(truncateText(text, 20)).toBe('This is a very long...');
    });

    it('does not truncate short text', () => {
      const text = 'Short text';
      expect(truncateText(text, 100)).toBe('Short text');
    });

    it('uses custom suffix', () => {
      const text = 'Very long text here';
      expect(truncateText(text, 10, '…')).toBe('Very long…');
    });

    it('handles word boundaries', () => {
      const text = 'Hello world test';
      expect(truncateText(text, 12, '...', true)).toBe('Hello world...');
    });
  });

  describe('slugify', () => {
    it('converts text to slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('handles special characters', () => {
      expect(slugify('Hello & World!')).toBe('hello-world');
    });

    it('handles multiple spaces', () => {
      expect(slugify('Hello    World')).toBe('hello-world');
    });

    it('handles accents', () => {
      expect(slugify('Café résumé')).toBe('cafe-resume');
    });

    it('limits length', () => {
      const long = 'a'.repeat(100);
      expect(slugify(long, 50).length).toBeLessThanOrEqual(50);
    });
  });

  describe('generateId', () => {
    it('generates unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('generates IDs with correct length', () => {
      const id = generateId(16);
      expect(id.length).toBe(16);
    });

    it('uses correct character set', () => {
      const id = generateId();
      expect(id).toMatch(/^[a-z0-9]+$/);
    });
  });

  describe('sanitizeFilename', () => {
    it('removes invalid characters', () => {
      expect(sanitizeFilename('file<name>.txt')).toBe('file_name_.txt');
    });

    it('handles spaces', () => {
      expect(sanitizeFilename('my file name.pdf')).toBe('my_file_name.pdf');
    });

    it('preserves extension', () => {
      expect(sanitizeFilename('document.pdf')).toBe('document.pdf');
    });

    it('prevents path traversal', () => {
      expect(sanitizeFilename('../../../etc/passwd')).toBe('etc_passwd');
    });
  });

  describe('parseFileSize', () => {
    it('parses bytes', () => {
      expect(parseFileSize('100B')).toBe(100);
      expect(parseFileSize('100 b')).toBe(100);
    });

    it('parses kilobytes', () => {
      expect(parseFileSize('5KB')).toBe(5 * 1024);
      expect(parseFileSize('5 kb')).toBe(5 * 1024);
    });

    it('parses megabytes', () => {
      expect(parseFileSize('10MB')).toBe(10 * 1024 * 1024);
    });

    it('parses gigabytes', () => {
      expect(parseFileSize('2GB')).toBe(2 * 1024 * 1024 * 1024);
    });

    it('handles decimal values', () => {
      expect(parseFileSize('1.5MB')).toBe(1.5 * 1024 * 1024);
    });

    it('returns null for invalid input', () => {
      expect(parseFileSize('invalid')).toBeNull();
      expect(parseFileSize('')).toBeNull();
    });
  });
});

describe('Function utilities', () => {
  describe('debounce', () => {
    it('delays function execution', async () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      expect(fn).not.toHaveBeenCalled();

      await new Promise((r: (value: unknown) => void) => setTimeout(r, 150));
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('resets timer on subsequent calls', async () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      await new Promise((r: (value: unknown) => void) => setTimeout(r, 50));
      debounced();
      await new Promise((r: (value: unknown) => void) => setTimeout(r, 50));
      debounced();
      
      await new Promise((r: (value: unknown) => void) => setTimeout(r, 150));
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('passes arguments to function', async () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 10);

      debounced('arg1', 'arg2');
      await new Promise((r: (value: unknown) => void) => setTimeout(r, 20));

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('can be cancelled', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced.cancel();

      expect(debounced.pending()).toBe(false);
    });
  });

  describe('throttle', () => {
    it('limits function execution rate', async () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled();
      throttled();
      throttled();

      expect(fn).toHaveBeenCalledTimes(1);

      await new Promise((r: (value: unknown) => void) => setTimeout(r, 150));
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('executes immediately on first call', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 1000);

      throttled();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('passes latest arguments', async () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled('first');
      throttled('second');
      throttled('third');

      await new Promise((r: (value: unknown) => void) => setTimeout(r, 150));
      expect(fn).toHaveBeenLastCalledWith('third');
    });
  });
});

describe('Array utilities', () => {
  describe('groupBy', () => {
    it('groups array by key', () => {
      interface Item {
        category: string;
        name: string;
      }
      const items: Item[] = [
        { category: 'A', name: 'Item 1' },
        { category: 'B', name: 'Item 2' },
        { category: 'A', name: 'Item 3' },
      ];

      const grouped = groupBy(items, 'category');

      expect(grouped.A).toHaveLength(2);
      expect(grouped.B).toHaveLength(1);
    });

    it('groups by function', () => {
      const items = [1, 2, 3, 4, 5, 6];
      const grouped = groupBy(items, (n: number): string => n % 2 === 0 ? 'even' : 'odd');

      expect(grouped.even).toEqual([2, 4, 6]);
      expect(grouped.odd).toEqual([1, 3, 5]);
    });
  });

  describe('uniqueBy', () => {
    it('removes duplicates by key', () => {
      interface Item {
        id: number;
        name: string;
      }
      const items: Item[] = [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 1, name: 'C' },
      ];

      const unique = uniqueBy(items, 'id');

      expect(unique).toHaveLength(2);
      expect(unique.map((i: Item) => i.id)).toEqual([1, 2]);
    });

    it('keeps first occurrence by default', () => {
      interface Item {
        id: number;
        name: string;
      }
      const items: Item[] = [
        { id: 1, name: 'First' },
        { id: 1, name: 'Second' },
      ];

      const unique = uniqueBy(items, 'id');

      expect(unique[0].name).toBe('First');
    });
  });

  describe('sortBy', () => {
    it('sorts by key', () => {
      interface Item {
        name: string;
        age: number;
      }
      const items: Item[] = [
        { name: 'Charlie', age: 30 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 35 },
      ];

      const sorted = sortBy(items, 'name');

      expect(sorted.map((i: Item) => i.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('sorts in descending order', () => {
      const items = [3, 1, 4, 1, 5];

      const sorted = sortBy(items, (n: number): number => n, 'desc');

      expect(sorted).toEqual([5, 4, 3, 1, 1]);
    });

    it('handles nested keys', () => {
      interface Item {
        user: { name: string };
      }
      const items: Item[] = [
        { user: { name: 'Zoe' } },
        { user: { name: 'Amy' } },
      ];

      const sorted = sortBy(items, (i: Item): string => i.user.name);

      expect(sorted[0].user.name).toBe('Amy');
    });
  });
});

describe('Object utilities', () => {
  describe('deepClone', () => {
    it('creates deep copy', () => {
      interface NestedObject {
        nested: { value: number };
        arr: number[];
      }
      const original: NestedObject = { nested: { value: 1 }, arr: [1, 2, 3] };
      const cloned = deepClone(original);

      cloned.nested.value = 2;
      cloned.arr.push(4);

      expect(original.nested.value).toBe(1);
      expect(original.arr).toHaveLength(3);
    });

    it('handles circular references', () => {
      interface CircularObject {
        a: number;
        self?: CircularObject;
      }
      const obj: CircularObject = { a: 1 };
      obj.self = obj;

      expect(() => deepClone(obj)).not.toThrow();
    });

    it('preserves special types', () => {
      const date = new Date('2024-01-01');
      const cloned = deepClone({ date });

      expect(cloned.date).toBeInstanceOf(Date);
      expect(cloned.date.toISOString()).toBe(date.toISOString());
    });
  });

  describe('deepMerge', () => {
    it('merges objects deeply', () => {
      const target: Record<string, unknown> = { a: { b: 1, c: 2 }, d: 3 };
      const source: Record<string, unknown> = { a: { b: 10, e: 20 } };

      const merged = deepMerge(target, source);

      expect(merged).toEqual({
        a: { b: 10, c: 2, e: 20 },
        d: 3,
      });
    });

    it('does not mutate target', () => {
      const target: Record<string, unknown> = { a: { b: 1 } };
      const source: Record<string, unknown> = { a: { c: 2 } };

      deepMerge(target, source);

      expect(target.a).toEqual({ b: 1 });
    });

    it('handles arrays', () => {
      const target: Record<string, unknown> = { arr: [1, 2] };
      const source: Record<string, unknown> = { arr: [3, 4] };

      const merged = deepMerge(target, source);

      expect(merged.arr).toEqual([3, 4]);
    });

    it('merges multiple sources', () => {
      const result = deepMerge(
        { a: 1, b: 0, c: 0 } as Record<string, unknown>,
        { b: 2 } as Record<string, unknown>,
        { c: 3 } as Record<string, unknown>
      );

      expect(result).toEqual({ a: 1, b: 2, c: 3 });
    });
  });
});

describe('Validation utilities', () => {
  describe('isValidEmail', () => {
    it('validates correct emails', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('user.name@example.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.com')).toBe(true);
    });

    it('rejects invalid emails', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('validates correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('ftp://files.example.com')).toBe(true);
    });

    it('rejects invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('http://')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });

    it('optionally requires specific protocols', () => {
      expect(isValidUrl('https://example.com', ['https', 'http'])).toBe(true);
      expect(isValidUrl('ftp://example.com', ['https'])).toBe(false);
    });
  });
});
