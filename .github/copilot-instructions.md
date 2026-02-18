# Copilot Instructions for `beans-vscode`

## What this is

A VS Code extension for the [Beans](https://github.com/hmans/beans) issue tracker. It wraps the `beans` CLI, provides sidebar tree views, webview details/search panels, an MCP server, and a `@beans` chat participant.

## Build & test

```bash
pnpm run compile          # esbuild bundle + tsc type-check (one-shot)
pnpm run watch:esbuild    # incremental bundle (dev)
pnpm run watch:tsc        # incremental type-check (dev)
pnpm run test             # Vitest (vscode API mocked)
pnpm run lint             # ESLint
```

`esbuild.js` is the bundler config. It uses `loader: { '.md': 'text' }` to inline Markdown template files as string constants — used for Copilot instructions/skill templates in `src/beans/config/templates/`.

## Module map

| Module                                          | Purpose                                                                                                               |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/extension.ts`                              | Activation: wires all providers, registers disposables                                                                |
| `src/beans/service/BeansService.ts`             | Typed CLI wrapper — **all** `beans` invocations go through here as argument arrays                                    |
| `src/beans/tree/BeansTreeDataProvider.ts`       | Base tree provider; status-specific subclasses in `tree/providers/`                                                   |
| `src/beans/tree/registerBeansTreeViews.ts`      | Registers all five pane tree views (active/completed/draft/scrapped/archived)                                         |
| `src/beans/commands/BeansCommands.ts`           | All command registration and orchestration                                                                            |
| `src/beans/details/BeansDetailsViewProvider.ts` | Webview sidebar — bean detail view + inline metadata selects                                                          |
| `src/beans/search/BeansSearchViewProvider.ts`   | Webview search panel                                                                                                  |
| `src/beans/mcp/BeansMcpIntegration.ts`          | Stdio MCP server lifecycle; port from `beans.mcp.port` (default 39173)                                                |
| `src/beans/chat/BeansChatIntegration.ts`        | `@beans` chat participant + slash commands                                                                            |
| `src/beans/config/BeansConfigManager.ts`        | Reads/writes `.beans.yml`, generates `.github/instructions/tasks.instructions.md` and `.github/skills/beans/SKILL.md` |
| `src/beans/config/templates/`                   | Markdown templates for generated Copilot artifacts; `{{PRIME_OUTPUT}}` placeholder replaced at write time             |
| `src/beans/model/`                              | `Bean` type, `errors.ts` typed error classes, `config.ts` workspace config types                                      |

## Tool usage priority

**Always prefer extension commands and MCP tools over CLIs.** The priority depends on context:

### For Beans work tracking (using this extension)

When tracking your own work with Beans in this repository:

1. **VS Code extension commands/UI first** — use command palette, sidebar, or webviews (`beans.create`, `beans.edit`, `beans.setStatus`, etc.). Best user experience.
2. **@beans chat participant second** — conversational interface for guidance, summaries, and workflows.
3. **MCP tools third** — programmatic interface when integrated into automated workflows.
4. **CLI last resort only** — via `BeansService` argument arrays; never shell strings.

### For testing extension code

When writing tests or verifying extension functionality:

1. **MCP tools first** — programmatic, deterministic testing of Beans operations.
2. **Extension commands second** — for UI/UX verification and integration testing.
3. **Direct TypeScript calls third** — when testing internal APIs (`BeansService`, etc.).
4. **CLI last resort only** — via `BeansService` argument arrays; never shell strings.

Both contexts: never build shell command strings; always use `BeansService` with argument arrays when CLI invocation is unavoidable.

## Key patterns

**Process execution** — never build shell strings. `BeansService` always calls `beans` via an argument array with `child_process.execFile` or similar. Treat all bean content as untrusted input.

**Codicons in webviews** — `@vscode/codicons` ships a `@font-face` with a relative URL that fails in `vscode-webview:` context. Always add an explicit override at the top of inline `<style>`:

```html
<style>
  @font-face { font-family:"codicon"; src:url("${codiconFontUri}") format("truetype"); }
```

where `codiconFontUri = webview.asWebviewUri(Uri.joinPath(extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.ttf'))`.

**Priority labels** — use circled Unicode characters ①②③④⑤ (not codicons) for priority in all UI surfaces (tree item labels, quick picks, webview selects).

**Context keys** — dynamic UI state (e.g. navigation back-button visibility) uses the pattern: expose a getter → call `executeCommand('setContext', 'beans.<key>', value)` → reference in `package.json` `when` clauses. See `BeansDetailsViewProvider.updateDetailsContextKeys`.

**Tree providers** — each status pane is a subclass of `BeansTreeDataProvider` with a fixed `statusFilter`. Shared sort/filter/refresh logic lives in the base class. Registered and disposed in `registerBeansTreeViews.ts`.

**Markdown templates** — `CopilotInstructions.ts` and `CopilotSkill.ts` import from `.md` template files (inlined by esbuild). Use `{{PRIME_OUTPUT}}` as the sole placeholder; no complex interpolation in TS.

## Testing

`vitest.config.ts` aliases `vscode` → `src/test/mocks/vscode.ts`. Tests live under `src/test/`. Do not import `vscode` directly in tests — use the mock.

## Security constraints

- No shell-interpolated strings anywhere in CLI invocation.
- CSP in all webviews: `default-src 'none'`; explicitly allowlist `font-src ${webview.cspSource}` and `img-src ${webview.cspSource} data:`.
- `localResourceRoots: [extensionUri]` on all webviews.

## Definition of done

A change is complete when: command wired in `package.json` + `BeansCommands.ts`, errors surface via `BeansOutput` logger, unit test added/updated, and compile passes.
