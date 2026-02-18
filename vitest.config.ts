import * as path from 'node:path';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

// Vitest uses Vite's transform pipeline, which has no built-in .md loader.
// This plugin mirrors esbuild's `loader: { '.md': 'text' }` so that
// CopilotInstructions.ts / CopilotSkill.ts can import template files in tests.
const mdTextPlugin: Plugin = {
  name: 'md-text',
  transform(code, id) {
    if (id.endsWith('.md')) {
      return `export default ${JSON.stringify(code)}`;
    }
  }
};

export default defineConfig({
  plugins: [mdTextPlugin],
  test: {
    include: ['src/test/**/*.test.ts'],
    environment: 'node'
  },
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, 'src/test/mocks/vscode.ts')
    }
  }
});
