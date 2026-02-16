import { defineConfig } from 'vitest/config';
import * as path from 'node:path';

export default defineConfig({
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
