// Used to load README.md for assertions in these tests.
import { readFileSync } from 'fs';
// Path utility for resolve/__dirname usage below.
import { resolve } from 'path';
// Explicit Vitest imports are required because globals are not enabled in
// `vitest.config.ts` for this repo — import `describe`, `expect`, `test` to
// avoid runtime failures (see Copilot suggestion).
import { describe, expect, test } from 'vitest';

describe('README badges (beans-vscode-an5a)', () => {
  const README = readFileSync(resolve(__dirname, '../../..', 'README.md'), 'utf8');

  test('version badge uses capital V in label', () => {
    // expects shields.io label query to use `Version` (capital V)
    expect(README).toMatch(/label=Version/);
  });

  test('CI badge display label changed to Tests (alt text)', () => {
    // README currently uses an actions badge image; the display-name change is the alt text in Markdown
    expect(README).toContain('[![Tests](');
  });

  test('Remote Compatibility badge display label changed to Remote Tests (alt text)', () => {
    expect(README).toContain('[![Remote Tests](');
  });
});
