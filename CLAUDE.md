# Claude Instructions for `beans-vscode`

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
| `src/beans/config/templates/`                   | Markdown templates for generated Copilot artifacts; `{{GRAPHQL_SCHEMA}}` placeholder replaced at write time           |
| `src/beans/model/`                              | `Bean` type, `errors.ts` typed error classes, `config.ts` workspace config types                                      |

## Key patterns

**Process execution** — never build shell strings. `BeansService` always calls `beans` via an argument array with `child_process.execFile` or similar. Treat all bean content as untrusted input.

**Codicons in webviews** — `@vscode/codicons` ships a `@font-face` with a relative URL that fails in `vscode-webview:` context. Always add an explicit override at the top of inline `<style>`:

```html
<style>
  @font-face { font-family:"codicon"; src:url("${codiconFontUri}") format("truetype"); }
```

where `codiconFontUri = webview.asWebviewUri(Uri.joinPath(extensionUri, 'dist', 'media', 'codicon.ttf'))`.

> **Note:** `node_modules/**` is excluded from the VSIX. The build step (`scripts/copy-codicons.js`) copies `codicon.ttf` and `codicon.css` into `dist/media/` so they are packaged and available at runtime. Never reference `node_modules/@vscode/codicons/…` paths in webview URIs.

**Priority labels** — use circled Unicode characters ①②③④⑤ (not codicons) for priority in all UI surfaces (tree item labels, quick picks, webview selects).

**Context keys** — dynamic UI state (e.g. navigation back-button visibility) uses the pattern: expose a getter → call `executeCommand('setContext', 'beans.<key>', value)` → reference in `package.json` `when` clauses. See `BeansDetailsViewProvider.updateDetailsContextKeys`.

**Tree providers** — each status pane is a subclass of `BeansTreeDataProvider` with a fixed `statusFilter`. Shared sort/filter/refresh logic lives in the base class. Registered and disposed in `registerBeansTreeViews.ts`.

**Markdown templates** — `CopilotInstructions.ts` and `CopilotSkill.ts` import from `.md` template files (inlined by esbuild). Use `{{GRAPHQL_SCHEMA}}` as the sole placeholder; no complex interpolation in TS.

## Testing

`vitest.config.ts` aliases `vscode` → `src/test/mocks/vscode.ts`. Tests live under `src/test/`. Do not import `vscode` directly in tests — use the mock.

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

**Markdown templates** — `CopilotInstructions.ts` and `CopilotSkill.ts` import from `.md` template files (inlined by esbuild). Use `{{GRAPHQL_SCHEMA}}` as the sole placeholder; no complex interpolation in TS.

## Testing

`vitest.config.ts` aliases `vscode` → `src/test/mocks/vscode.ts`. Tests live under `src/test/`. Do not import `vscode` directly in tests — use the mock.

## Security constraints

- No shell-interpolated strings anywhere in CLI invocation.
- CSP in all webviews: `default-src 'none'`; explicitly allowlist `font-src ${webview.cspSource}` and `img-src ${webview.cspSource} data:`.
- `localResourceRoots: [extensionUri]` on all webviews.

## Definition of done

A change is complete when: command wired in `package.json` + `BeansCommands.ts`, errors surface via `BeansOutput` logger, unit test added/updated, and compile passes.

---

title: Beans Task Management Rules
description: Generated Copilot instructions for Beans workflows in this workspace.

---

# Beans Task Management Rules

<CRITICALLY_IMPORTANT>

1. **Never start work without a bean.** Before writing any code or making any change, find a relevant existing bean or create a new one. Set its status to `in-progress`. There are no exceptions.

2. **Always use the extension or MCP first.** Invoke Beans operations through the VS Code extension commands or MCP tools. Use the `@beans` chat participant for guidance. Fall back to the CLI only when the extension, chat, and MCP are genuinely unavailable — and even then, read the constraints below.

3. **Track all work in the bean's body.** Maintain a `## Todo` checklist in the bean body. After each completed step, mark the item done and sync the bean. Never use TodoWrite, editor scratch pads, or ad-hoc lists.

4. **Commit beans promptly.**
   - Commit a bean immediately after creating or modifying it — unless you are creating a milestone/epic and are about to create its child beans, in which case commit everything together once the hierarchy is complete.
   - Completed todo items may be committed together with the code changes they relate to.

5. **Start or resume on the correct issue branch before writing code.**
   - If the issue does not already have a branch, create one when you begin work.
   - If you are resuming work, checkout the existing branch for that issue first.
   - Branch names must follow: `[type]/[issue-number-without-prefix]-[short-title]`.
   - Examples: `feat/1234-add-search`, `fix/987-crash-on-init`.
   - Push the branch and record it in the bean frontmatter as soon as it exists.

6. **Record the branch and PR in the bean.** As soon as a branch or PR exists, add it to the bean's YAML frontmatter:

   ```yaml
   branch: feature/<bean-id>-<slug>
   pr: <pr-number>
   ```

   Commit this update immediately.

7. **Closing a bean.**
   - Completed: add a `## Summary of Changes` section, then set status to `completed`.
   - Scrapped: add a `## Reasons for Scrapping` section, then set status to `scrapped`.

</CRITICALLY_IMPORTANT>

<!-- Agent-specific constraints: enforce by Copilot/skills -->

1. **Agent MUST create or switch to the issue branch before making any edits.**
   - If the bean already has an existing branch, checkout that branch; otherwise create a new branch and push it immediately.
   - Branch names must follow the repository convention and be recorded in the bean frontmatter as shown above.

2. **Agents must NOT keep a separate internal todo list.**
   - All progress, subtasks and checkboxes belong in the bean's `## Todo` checklist in the bean body.
   - The agent must update the bean's `## Todo` via the MCP or extension APIs and commit the updated bean; never persist task state only in the agent runtime.

3. **Agents must NOT create bean files by writing files directly or adding custom frontmatter fields.**
   - Always use the MCP or extension commands to create or edit beans. Do not write new `.md` bean files directly in the repository.
   - The only permitted bean frontmatter keys the agent may set are `branch` and `pr` (PR number). Do not add custom fields beyond these.

## Beans Usage Guide for Agents (Extension-First)

This file is generated by the Beans VS Code extension and defines the preferred execution model.

## Interface priority (highest → lowest)

**Always try each level in order. Only descend when the level above is genuinely unavailable.**

1. **Beans VS Code extension commands/UI** ← start here every time
2. **Beans chat participant (`@beans`) and slash commands**
3. **Beans MCP tools**
4. **Beans CLI** ← last resort only; see constraints below

The CLI is a fallback for environments where the extension, chat participant, and MCP are all inaccessible. Do not prefer it for convenience.

## Generated artifact context

When AI features are enabled, the extension maintains:

- `.github/instructions/tasks.instructions.md`
- `.github/skills/beans/SKILL.md`

Use these as authoritative guidance for Beans workflows in this repository.

## Core Beans workflow

1. **Before any work:** search for a relevant bean using `beans.search` or `@beans /search`. If none fits, create one with `beans.create` and set it to `in-progress`.
2. **Create or checkout the issue branch** before coding.
   - If starting new issue work, create a branch using `[type]/[issue-number-without-prefix]-[short-title]`.
   - If resuming, checkout the issue's existing branch.
   - Examples: `feat/1234-add-search`, `fix/987-crash-on-init`.
3. **Push branch and add branch/PR to bean frontmatter** as soon as they exist. Commit the bean update.
4. **Maintain a `## Todo` checklist** in the bean body. Update it after every completed step and commit the updated bean (alone or together with related code changes).
5. **On completion**, add `## Summary of Changes`, set status to `completed`, and commit the final bean state.
6. **On scrap**, add `## Reasons for Scrapping`, set status to `scrapped`, and commit.

## Extension commands (preferred)

**Bean operations:**

- `beans.create`, `beans.view`, `beans.edit`, `beans.delete` (draft/scrapped only)
- `beans.setStatus`, `beans.setType`, `beans.setPriority`
- `beans.setParent`, `beans.removeParent`, `beans.editBlocking`
- `beans.reopenCompleted`, `beans.reopenScrapped`
- `beans.copyId`

**Search and navigation:**

- `beans.search`, `beans.filter`, `beans.sort`, `beans.refresh`
- `beans.searchView.filter` (filter search results), `beans.searchView.clear` (clear search)
- `beans.details.back` (navigate back in Details view history)

**AI and workflow:**

- `beans.copilotStartWork` — open Copilot Chat with a workflow template (assess status, remaining steps, close/commit, export to GitHub issue, set in-progress, flesh out specs)

**Configuration and help:**

- `beans.init`, `beans.openConfig`, `beans.openExtensionSettings`
- `beans.showOutput`, `beans.openUserGuide`, `beans.openAiFeaturesGuide`
- `beans.openFirstMalformedBean` (navigate to malformed bean files)

## Chat workflows (`@beans`)

- `/summary` — status overview
- `/priority` — top-priority active issues
- `/stale` — stale issues by age
- `/create` — issue creation guidance
- `/next` — suggest the next bean to start
- `/search` — issue search

1. **Read/context first**: `beans_vscode_llm_context`, view, search, filter, sort.
2. **Mutate only with explicit intent**: create, edit, set status/type/priority, manage relationships.
3. **Destructive actions** (delete, archive) require explicit user confirmation unless the user already requested it.
4. MCP is the preferred programmatic interface when the extension UI is not in focus.

## Planning mode for epic decomposition

When planning an epic:

1. Confirm goal, constraints, and definition of done.
2. Propose a child-issue map grouped by outcomes.
3. For each child issue, include title, type, priority, and dependencies.
4. Ask for approval before creating any issues.
5. Create all approved child issues and link them with parent relationships.
6. **Commit the parent epic and all child beans together** once the hierarchy is complete.
7. Return created IDs and suggest the first issue to start.

Use compact planning checklist format:

- [ ] `<title>` — type=`<type>`, priority=`<priority>`, depends_on=`<ids|none>`

**Constraints when using the CLI:**

- Always run `beans prime` before doing anything in the CLI.
- Always use `--json` for output; never parse plain-text output.
- Never pass large blocks of body text directly as a shell argument; use GraphQL variables or pipe the query into `beans graphql`.
- Run one operation at a time; do not chain destructive commands.
