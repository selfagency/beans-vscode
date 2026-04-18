import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

// Vitest uses Vite's transform pipeline, which has no built-in .md loader.
// This plugin mirrors esbuild's `loader: { '.md': 'text' }` so that
// CopilotInstructions.ts / CopilotSkill.ts can import template files in tests.
const mdTextPlugin: Plugin = {
  name: "md-text",
  transform(code, id) {
    if (id.endsWith(".md")) {
      return `export default ${JSON.stringify(code)}`;
    }
  },
};

const require = createRequire(import.meta.url);

function ensureBeansMcpSourceMap(): void {
  try {
    const mcpEntryPath = require.resolve("@selfagency/beans-mcp");
    const sourceMapPath = `${mcpEntryPath}.map`;

    if (!fs.existsSync(sourceMapPath)) {
      const sourceMap = {
        version: 3,
        file: path.basename(mcpEntryPath),
        sources: [path.basename(mcpEntryPath)],
        names: [],
        mappings: "",
      };
      fs.writeFileSync(sourceMapPath, JSON.stringify(sourceMap), "utf8");
    }
  } catch {
    // Optional dependency lookup; ignore when unavailable in minimal test environments.
  }
}

ensureBeansMcpSourceMap();

export default defineConfig({
  plugins: [mdTextPlugin],
  test: {
    include: ["src/test/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, "src/test/mocks/vscode.ts"),
    },
  },
});
