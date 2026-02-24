import { describe, it, expect } from 'vitest';
import * as vscode from 'vscode';
import { BeansDetailsViewProvider } from '../../../../src/beans/details/BeansDetailsViewProvider';

describe('BeansDetailsViewProvider.escapeHtml', () => {
  it('escapes special HTML characters', () => {
    const provider = new BeansDetailsViewProvider(vscode.Uri.file('/tmp'), {} as any);
    const raw = '&<>"\'';
    // access private method via any cast
    const escaped = (provider as any).escapeHtml(raw);
    expect(escaped).toBe('&amp;&lt;&gt;&quot;&#039;');
  });

  it('leaves safe text unchanged', () => {
    const provider = new BeansDetailsViewProvider(vscode.Uri.file('/tmp'), {} as any);
    const raw = 'simple text 123';
    const escaped = (provider as any).escapeHtml(raw);
    expect(escaped).toBe(raw);
  });
});
