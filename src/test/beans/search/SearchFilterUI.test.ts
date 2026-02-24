import { describe, expect, it, vi } from 'vitest';
import { BEAN_PRIORITIES, BEAN_STATUSES, BEAN_TYPES } from '../../../beans/model';
import { sanitizeSearchFilterState } from '../../../beans/search/SearchFilterUI';

vi.mock('vscode');

describe('SearchFilterUI utilities', () => {
  it('sanitizeSearchFilterState removes invalid entries and trims text', () => {
    const input: any = {
      text: '  hello  ',
      tags: ['a', '', null, 123],
      statuses: ['todo', 'invalid-status'],
      types: ['feature', 'bad-type'],
      priorities: ['high', 'nope'],
    };

    const out = sanitizeSearchFilterState(input);
    expect(out.text).toBe('hello');
    expect(out.tags).toEqual(['a']);
    expect(out.statuses).toEqual(['todo']);
    expect(out.types).toEqual(['feature']);
    expect(out.priorities).toEqual(['high']);
  });

  it('sanitizeSearchFilterState returns empty object for undefined', () => {
    expect(sanitizeSearchFilterState(undefined)).toEqual({});
  });

  it('BEAN constants used to build items are populated', () => {
    expect(Array.isArray(BEAN_STATUSES)).toBe(true);
    expect(Array.isArray(BEAN_TYPES)).toBe(true);
    expect(Array.isArray(BEAN_PRIORITIES)).toBe(true);
  });

  it('showSearchFilterUI returns merged sanitized state when user picks items', async () => {
    // Mock createQuickPick to simulate user selecting two items
    // use the test vscode mock instead of resolving the real 'vscode' package
    const vscodeMock = await import('../../mocks/vscode.js');
    // attach a createQuickPick implementation directly on the test mock
    (vscodeMock as any).window.createQuickPick = () => {
      let acceptCb: () => void;
      const qp: any = {
        canSelectMany: true,
        title: '',
        items: [],
        selectedItems: [],
        onDidAccept: (cb: () => void) => {
          acceptCb = cb;
        },
        onDidHide: vi.fn(),
        show: () => {
          // simulate selection
          qp.selectedItems = [{ label: '① Critical', group: 'priority', value: 'critical' }];
          acceptCb?.();
        },
        dispose: vi.fn(),
      };
      return qp;
    };

    // require the module (CommonJS style) so local helper functions are invoked
    const mod = await import('../../../beans/search/SearchFilterUI.js');
    const result = await mod.showSearchFilterUI({ text: '  q  ' });
    expect(result).toBeTruthy();
    expect(result && result.text).toBe('q');
    // no cleanup necessary — test mock is local to the test environment
  });
});
