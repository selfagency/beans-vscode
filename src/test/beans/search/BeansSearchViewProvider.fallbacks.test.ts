import { describe, expect, it } from 'vitest';
import * as model from '../../../../src/beans/model';
// reuse the vscode mock types if needed
import { BeansSearchViewProvider } from '../../../../src/beans/search/BeansSearchViewProvider';
import '../../mocks/vscode.js';

describe('BeansSearchViewProvider getHtml fallbacks', () => {
  it('uses fallback icons when model lists unknown statuses/types/priorities', () => {
    // add unknown entries to BEAN_* arrays temporarily
    const addStatus = 'unknown-status-test';
    const addType = 'unknown-type-test';
    const addPriority = 'unknown-priority-test';
    (model as any).BEAN_STATUSES.push(addStatus);
    (model as any).BEAN_TYPES.push(addType);
    (model as any).BEAN_PRIORITIES.push(addPriority);

    // use a minimal shim for vscode.Uri expected by the provider constructor
    const extUri: any = { scheme: 'file', fsPath: '/tmp', path: '/tmp' };
    const provider = new BeansSearchViewProvider(extUri as any, { listBeans: async () => [] } as any);
    const html = (provider as any).getHtml({
      cspSource: 'vscode-resource:',
      asWebviewUri: (u: any) => ({ toString: () => String(u.path || '') }),
    } as any);

    // check that fallback codicon names appear for unknown entries
    expect(html).toContain('circle');
    expect(html).toContain('circle-large-outline');

    // cleanup: remove the injected entries
    (model as any).BEAN_STATUSES.pop();
    (model as any).BEAN_TYPES.pop();
    (model as any).BEAN_PRIORITIES.pop();
  });
});
