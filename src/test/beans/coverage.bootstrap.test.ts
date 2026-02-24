import { describe, expect, it } from 'vitest';

// Import index barrels to ensure they execute and count toward coverage
describe('index barrel imports', () => {
  it('imports key module index files without throwing', async () => {
    // these modules re-export APIs; importing them executes trivial top-level code
    // which increases coverage for index.ts files that were previously untested.

    const modules = [
      '../../beans/chat',
      '../../beans/commands',
      '../../beans/config',
      '../../beans/details',
      '../../beans/help',
      '../../beans/logging',
      '../../beans/mcp',
      '../../beans/preview',
      '../../beans/search',
      '../../beans/service',
      '../../beans/tree',
    ];

    for (const modPath of modules) {
      // Use dynamic import so the test runner transforms/loads TS modules

      const mod = await import(modPath);
      expect(mod).toBeTruthy();
    }
  });
});
