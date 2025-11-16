import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

describe('cn utility function', () => {
  it('should merge class names correctly', () => {
    const result = cn('foo', 'bar');
    expect(result).toBe('foo bar');
  });

  it('should handle conditional class names', () => {
    const result = cn('foo', false && 'bar', 'baz');
    expect(result).toBe('foo baz');
  });

  it('should merge tailwind classes correctly', () => {
    const result = cn('px-2 py-1', 'px-4');
    // twMerge should keep only px-4 (the latter one)
    expect(result).toBe('py-1 px-4');
  });

  it('should handle arrays of class names', () => {
    const result = cn(['foo', 'bar'], 'baz');
    expect(result).toBe('foo bar baz');
  });

  it('should handle objects with conditional classes', () => {
    const result = cn({
      'text-red-500': true,
      'text-blue-500': false,
      'font-bold': true,
    });
    expect(result).toBe('text-red-500 font-bold');
  });

  it('should handle empty inputs', () => {
    const result = cn();
    expect(result).toBe('');
  });

  it('should handle null and undefined', () => {
    const result = cn('foo', null, undefined, 'bar');
    expect(result).toBe('foo bar');
  });

  it('should handle duplicate class names', () => {
    const result = cn('foo', 'foo', 'bar');
    // Note: clsx keeps duplicates, twMerge may or may not deduplicate depending on the classes
    expect(result).toContain('foo');
    expect(result).toContain('bar');
  });

  it('should handle complex tailwind merge scenarios', () => {
    const result = cn(
      'bg-red-500 text-white',
      'bg-blue-500' // Should override bg-red-500
    );
    expect(result).toBe('text-white bg-blue-500');
  });
});
