import { describe, it, expect } from 'vitest';
import * as vscode from 'vscode';
import {
  BeansDetailsViewProvider,
  BeansDetailsViewProviderPrivate,
} from '../../../../src/beans/details/BeansDetailsViewProvider';
import { BeansService } from '../../../../src/beans/service';

function makeProvider(): BeansDetailsViewProviderPrivate {
  return new BeansDetailsViewProvider(vscode.Uri.file('/tmp'), {} as any) as unknown as BeansDetailsViewProviderPrivate;
}

function makeProviderWithService(): BeansDetailsViewProviderPrivate {
  const service = new BeansService('/mock');
  return new BeansDetailsViewProvider(
    vscode.Uri.file('/mock/ext'),
    service as any
  ) as unknown as BeansDetailsViewProviderPrivate;
}

/**
 * escapeHtml — generic template utility
 * Escapes &, <, >, ", ' so arbitrary values can be safely interpolated into
 * the webview HTML template (attribute values, text nodes, etc.).
 */
describe('BeansDetailsViewProvider.escapeHtml', () => {
  it('escapes special HTML characters', () => {
    expect(makeProvider().escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#039;');
  });

  it('leaves safe text unchanged', () => {
    expect(makeProvider().escapeHtml('simple text 123')).toBe('simple text 123');
  });
});

/**
 * renderMarkdown HTML tag handling.
 *
 * Raw HTML tags in bean body text (e.g. <title>, <script>) must render as
 * escaped literal text rather than live DOM elements. marked's walkTokens
 * hook escapes `html`-type tokens before rendering; fenced code blocks and
 * backtick spans tokenise as `code`/`codespan` and are unaffected.
 */
describe('BeansDetailsViewProvider.renderMarkdown — HTML tag escaping', () => {
  it('<title> in plain text is escaped to visible text, not a DOM element', () => {
    const html = makeProviderWithService().renderMarkdown('Replace the <title> tag and also the <meta> description.');
    expect(html).not.toContain('<title>');
    expect(html).not.toContain('<meta>');
    expect(html).toContain('&lt;title&gt;');
    expect(html).toContain('&lt;meta&gt;');
  });

  it('<title> inside a backtick span is escaped inside a <code> element', () => {
    const html = makeProviderWithService().renderMarkdown('document `<title>` tag');
    expect(html).not.toContain('<title>');
    expect(html).toContain('<code>&lt;title&gt;</code>');
  });

  it('<title> inside a fenced block is escaped inside a <pre><code> element', () => {
    const html = makeProviderWithService().renderMarkdown('```\n<title>Page</title>\n```');
    expect(html).not.toContain('<title>');
    expect(html).toContain('&lt;title&gt;Page&lt;/title&gt;');
    expect(html).toContain('<pre><code>');
  });
});
