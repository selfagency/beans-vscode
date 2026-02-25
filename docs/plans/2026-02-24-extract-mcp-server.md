## Plan: Extract MCP server to npm package

TL;DR — Extract the MCP runtime (tools, handlers, CLI) into a new npm package named `beans-mcp-server` (bundled single-file build, Node 18+). Keep VS Code-specific provider glue (`BeansMcpIntegration`) in the extension and make it call the package's programmatic API (`createBeansMcpServer`).

## Steps

1. Create new package repo / workspace package `@selfagency/beans-mcp-server`
   - Files to add:
     - `package.json` (name: "beans-mcp-server", engines.node: ">=18", exports + types)
     - `src/index.ts` — programmatic exports (createBeansMcpServer, startBeansMcpServer, parseCliArgs, isPathWithinRoot, types)
     - `src/cli.ts` — CLI entry that calls startBeansMcpServer(process.argv)
     - `src/server/BeansMcpServer.ts` — moved logic from `src/beans/mcp/BeansMcpServer.ts` (tool registrations + handlers)
     - `src/server/backend.ts` — BeansCliBackend or BackendInterface (wraps execFile, fs helpers, GraphQL helpers)
     - `src/internal/queryHelpers.ts` — copy from `src/beans/mcp/internal/queryHelpers.ts`
     - `src/templates/*` — copilot templates or bake templates into JS at build-time
     - `README.md`, `LICENSE`, `CHANGELOG.md`, `tsconfig.json`, `esbuild` build config
     - `dist/` (build outputs)
   - Build: esbuild bundle to single ESM file for API and a bundled executable (CLI) — produce `dist/index.js` (ESM programmatic entry) and `dist/beans-mcp-server.cjs` (CLI CJS bundle with shebang).
   - Bundle runtime deps into the single-file build per maintainers' preference (recommended to bundle to reduce install friction).

2. Public API design (exports in `src/index.ts`)
   - `createBeansMcpServer(opts: { workspaceRoot: string; cliPath?: string; name?: string; version?: string; logDir?: string; allowedRoots?: string[]; backend?: BackendInterface }): { server: McpServer; backend: BackendInterface }`
   - `startBeansMcpServer(argvOrOptions): Promise<void>` (CLI-compatible entrypoint)
   - `parseCliArgs(argv: string[]): { workspaceRoot, cliPath, port, logDir }`
   - `isPathWithinRoot(root: string, target: string): boolean`
   - `BeansCliBackend` class and `BackendInterface` type
   - types: `BeanRecord`, `SortMode`, tool request/response types
   - Export zod validation schemas or ensure they’re embedded in handlers.

3. Tests & CI
   - Move / adapt existing MCP tests:
     - `src/test/beans/mcp/*` → use package internal tests that exercise handlers and utilities
     - Keep integration tests in extension repo; after package is published, update extension tests to import from `beans-mcp-server` where they previously imported the local file.
   - Add `vitest` config to package, run unit tests on build CI.
   - Publish artifacts (dist + types). Add `prepare` script to build on publish.

4. Extension migration (after package publish)
   - Replace local server implementation:
     - Keep `src/beans/mcp/BeansMcpIntegration.ts` in extension but modify it to import from `beans-mcp-server`:
       - `import { createBeansMcpServer, parseCliArgs } from 'beans-mcp-server'`
       - Use provider adapter: call `createBeansMcpServer({ workspaceRoot, cliPath, logDir, backend: new BackendAdapter(...) })` and `server.connect(new StdioServerTransport())` OR use `startBeansMcpServer` if launching as process.
     - Update `src/beans/mcp/index.ts` to re-export only integration/provider glue that references the installed package.
   - Update extension `package.json` to depend on `beans-mcp-server`.
   - Update extension tests to reference the published package (or locally link to package via workspace pnpm/yarn link during development).

5. Backwards-compat / compatibility notes
   - Provide both programmatic API and CLI entry. The extension will prefer the programmatic API to avoid child_process unless you want to keep CLI mode.
   - Provide a small adapter snippet in package README showing how to wire VS Code provider APIs to the packaged server.
   - Ensure the bundled CLI provides a CJS entry with a require.main guard (or ESM-compatible import.meta guard). Build both formats if needed.

6. Publish & replace
   - Publish `beans-mcp-server` to npm (or your registry).
   - In extension repo: update dependency and code as above, run tests, verify VS Code activation registers MCP provider and tools still work.

## Verification

- Unit tests: run package `pnpm test` (vitest) — existing MCP unit tests (parseCliArgs, isPathWithinRoot, sortBeans) pass.
- Build: `pnpm run build` produces `dist/index.js` and `dist/beans-mcp-server.cjs` and type declarations.
- Integration: in extension workspace, run full test suite and run extension in Extension Development Host; verify MCP provider registers and `beans_vscode_query` and `beans_vscode_view` calls function end-to-end (use existing integration test `src/test/integration/ai/mcp-integration.test.ts`).
- Manual: start extension in host, open Beans Output log, run the MCP tools via an LLM client (or a simple stdio client) and confirm responses.

## Decisions & rationale

- Package name: `beans-mcp-server` (unscoped, per your selection).
- Bundle runtime deps into single JS (you chose bundling) so consumers can install and run without extra dependency resolution complexity.
- Programmatic API preferred for the extension — less OS/process complexity and easier testing.
- Target Node 18+.

## Files to be created/modified (summary)

- New package: files listed in Step 1.
- Modified in extension:
  - `src/beans/mcp/BeansMcpIntegration.ts` — remove server code, import package API, adapt to provider.
  - `src/beans/mcp/index.ts` — change exports to adapter/provider-only.
  - `src/extension.ts` — ensure activation uses new provider API unchanged in semantics.
  - Tests under `src/test/*` — update imports of server utilities to package or local dev link.

## Risks & mitigations

- VS Code-specific code must remain in the extension (provider registration). Mitigation: keep `BeansMcpIntegration` in extension and use package for runtime.
- Path & log checks rely on VS Code context — expose options in package to accept allowedRoots or logDir from the extension.
- Module format mismatch: produce both ESM programmatic entry and a bundled CLI CJS for maximum compatibility.

## Draft checklist

- [ ] Create new package repo `beans-mcp-server` with source and build pipeline
- [ ] Port `BeansMcpServer.ts`, `queryHelpers.ts`, backend, templates, GraphQL snippets
- [ ] Implement public API and types
- [ ] Add unit tests and CI
- [ ] Build bundle (single-file) and CLI wrapper
- [ ] Publish to npm / registry
- [ ] Update extension to depend on `beans-mcp-server` and adapt provider glue
- [ ] Update extension tests and run integration tests
- [ ] Final verification in Extension Development Host

## Next steps (short)

- I can scaffold the new package (package.json, tsconfig, esbuild config, src skeleton) and prepare a draft of `src/server/BeansMcpServer.ts` and `src/index.ts` that mirror the current implementation but decoupled from `vscode` APIs. Or I can produce a migration PR sketch showing exact edits to `BeansMcpIntegration.ts` to call the packaged API after publish. Which would you like me to do next?
