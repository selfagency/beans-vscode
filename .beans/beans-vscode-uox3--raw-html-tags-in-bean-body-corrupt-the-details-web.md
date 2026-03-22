---
# beans-vscode-uox3
title: Raw HTML tags in bean body corrupt the details webview
status: completed
type: bug
priority: high
created_at: 2026-03-22T03:56:45Z
updated_at: 2026-03-22T03:56:55Z
---

Raw HTML tags in bean body text (e.g. <title>, <script>, <meta>) were passed through by marked as live DOM elements, corrupting the details webview. A <title> tag consumed all subsequent HTML including the <script> block that initialises the status/type/priority dropdowns, leaving the pane broken and triggering a misleading 'beans.openBean /277' command error on click.

Fixed by passing a walkTokens hook to marked.parse() that intercepts html-type tokens and escapes them as literal text before rendering. marked's own tokeniser correctly identifies these tokens in all contexts (fenced blocks, backtick spans, etc.) so no custom character scanning is needed.

Also exported BeansDetailsViewProviderPrivate from the provider module so both test files share one typed accessor definition rather than maintaining stale local copies.

## Summary of Changes

- `BeansDetailsViewProvider.renderMarkdown`: replaced handrolled `escapeRawHtmlOutsideCodeBlocks` pre-processor with a `walkTokens` hook passed directly to `marked.parse()`
- `BeansDetailsViewProvider`: deleted `escapeRawHtmlOutsideCodeBlocks` method entirely
- `BeansDetailsViewProviderPrivate`: exported from provider module; both test files import the shared type instead of declaring local copies
- `escapeHtml.test.ts`: added renderMarkdown HTML tag escaping tests with positive assertions on escaped output
- Branch: `fix/escape-raw-html-in-bean-body` in `beans-vscode`
