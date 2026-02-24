import { describe, expect, it } from 'vitest';
import { sanitizeSearchFilterState } from '../../../../src/beans/search/SearchFilterUI';

describe('SearchFilterUI sanitizeSearchFilterState', () => {
  it('trims text and removes empty values', () => {
    const s = sanitizeSearchFilterState({
      text: '  hello  ',
      tags: ['a', '', ' '],
      statuses: ['todo', 'invalid'],
      types: ['task'],
      priorities: ['high', 'nope'],
    } as any);
    expect(s.text).toBe('hello');
    expect(s.tags).toEqual(['a']);
    // invalid status/types/priorities should be removed
    expect(s.statuses).toEqual(['todo']);
    expect(s.types).toEqual(['task']);
    expect(s.priorities).toEqual(['high']);
  });

  it('returns empty object for undefined input', () => {
    expect(sanitizeSearchFilterState(undefined)).toEqual({});
  });
});
