import { describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import { BeansDetailsViewProvider } from '../../../../src/beans/details/BeansDetailsViewProvider';
import { BeansService } from '../../../../src/beans/service';

describe('renderMarkdown list grouping', () => {
  it('keeps separate lists separate when rendered', () => {
    const service = new BeansService('/mock');
    const provider = new BeansDetailsViewProvider(vscode.Uri.file('/mock/ext'), service as any);

    const md = `- item a
- item b

Some paragraph here.

- second 1
- second 2
`;

    const html = (provider as any).renderMarkdown(md);

    // Should have two separate <ul> blocks
    const firstUlIndex = html.indexOf('<ul>');
    const lastUlIndex = html.lastIndexOf('</ul>');
    expect(firstUlIndex).toBeGreaterThan(-1);
    expect(lastUlIndex).toBeGreaterThan(firstUlIndex);

    const between = html.substring(firstUlIndex, lastUlIndex + 4);
    // There should be two closing/opening </ul>...<ul> occurrences, not a single merged list
    const ulCount = (between.match(/<ul>/g) || []).length;
    expect(ulCount).toBeGreaterThanOrEqual(2);
  });
});
