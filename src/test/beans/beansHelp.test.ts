import { describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import { BeansHelpViewProvider } from '../../beans/help/BeansHelpViewProvider';

describe('BeansHelpViewProvider', () => {
  it('produces HTML containing expected sections', () => {
    const provider = new BeansHelpViewProvider(vscode.Uri.file('/tmp/'));
    const html = (provider as any).getHtml();
    expect(html).toContain('Beans Help');
    expect(html).toContain('Documentation');
    expect(html).toContain('Support');
    expect(html).toContain('About Beans');
  });
});
