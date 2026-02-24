import { describe, expect, it } from 'vitest';
import { sanitizeSearchFilterState } from '../../../beans/search/SearchFilterUI';

describe('SearchFilterUI branch tests', () => {
  it('sanitizeSearchFilterState trims and rejects invalid entries', () => {
    const out = sanitizeSearchFilterState({ text: '  Hi  ', tags: [null, 't'], statuses: ['todo', 'bad'] } as any);
    expect(out.text).toBe('Hi');
    expect(out.tags).toEqual(['t']);
    expect(out.statuses).toEqual(['todo']);
  });

  it('showSearchFilterUI handles user cancel/hide path', async () => {
    // simulate QuickPick hide by attaching a createQuickPick on test mock
    const vscodeMock = await import('../../mocks/vscode.js');
    (vscodeMock as any).window.createQuickPick = () => {
      const qp: any = {
        canSelectMany: true,
        title: '',
        items: [],
        selectedItems: [],
        onDidAccept: (_cb: any) => {},
        onDidHide: (cb: any) => cb(),
        show: () => {},
        dispose: () => {},
      };
      return qp;
    };

    const mod = await import('../../../beans/search/SearchFilterUI.js');
    const res = await mod.showSearchFilterUI(undefined);
    // canceled/hide should return undefined or empty
    expect(res === undefined || Object.keys(res).length === 0).toBe(true);
  });
});
