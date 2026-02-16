# Copilot Instructions for `beans-vscode`

## Mission

Build a production-quality VS Code extension for the Beans issue tracker that **faithfully emulates the Beans TUI workflows** while feeling native in VS Code.

Use Beans as the source of truth for issue operations and model behavior after the upstream TUI (`internal/tui/*`), especially list/detail interactions, keyboard-first actions, and batch edit flows.

## Product goals (non-negotiable)

1. Provide a sidebar-first workflow for browsing, filtering, and editing Beans.
2. Match core TUI operations in VS Code commands and context menus.
3. Integrate with Copilot via MCP + chat participant + prompt templates.
4. Work in local and remote environments.
5. Ship with robust tests and CI.

## Core user experience requirements

### Sidebar and tree behavior

- Provide a dedicated Beans activity bar view container and at least one tree view.
- Render beans in a hierarchical tree:
  - Group and order by type and parent relationships.
  - Show `code/id`, `type`, `status`, and `priority` in tree item label/description/tooltip.
- Provide dedicated collapsible panes in the sidebar for:
  - Active beans
  - Completed beans
  - Draft beans
  - Scrapped beans
  - Archived beans
- These panes must be independently expandable/collapsible and persist user expand/collapse state when possible.
- Support sorting options (at minimum):
  - status/priority/type/title (default)
  - updated_at
  - created_at
  - id/code

### Open/edit flows

- Opening a bean must be possible via:
  - selecting tree item + Enter
  - tree item context action
  - command palette
- Editing a bean must be possible via:
  - explicit pencil/edit action in item context
  - command palette
- If true double-click is not available for tree items, use single-click + open command semantics and document this limitation clearly in code comments and docs.

### TUI parity actions

Implement commands + UI affordances for:

- view bean
- create bean
- edit bean
- set/remove parent
- set status
- set type
- set priority
- edit blocking links
- delete scrapped/draft issue
- copy bean id
- filter/tag filter
- clear filter
- refresh/reload

Support multi-select batch operations where VS Code APIs allow it.

### Command palette behavior

- Include all major Beans operations.
- Provide dedicated reopen/revive flows that include completed/scrapped.
- Deletion flows must only allow deleting scrapped and draft issues (not active/completed by default), and should require explicit confirmation.

### Visual design

- Inspiration can be taken from the Beads extension patterns (issues tree + details + actionable commands), but implementation must be visually and structurally distinct.
- Follow VS Code UX guidance for views, view actions, quick picks, and notifications.

## Missing-project initialization

When a workspace is opened and Beans is not initialized:

- Detect missing `.beans` and/or `.beans.yml`.
- Prompt user with actionable options:
  - Initialize Beans now
  - Learn more
  - Dismiss
- Provide setting to disable this prompt.
- Do not repeatedly nag after explicit dismissal in a workspace session.

## Architecture expectations

### Recommended module boundaries

- `BeansService`: typed wrapper around Beans CLI/GraphQL operations.
- `BeansRepository`: data normalization, mapping to extension models.
- `BeansTreeDataProvider`: tree shaping, sorting, filtering, refresh events.
- `BeansCommands`: command registration and orchestration.
- `BeansPreviewProvider`: markdown/details rendering.
- `BeansConfigManager`: reads/writes `.beans.yml` safely.
- `BeansMcpIntegration`: MCP server definition provider and related commands.
- `BeansChatIntegration`: Copilot chat participant and prompt composition.

### Data access strategy

- Prefer stable machine-readable Beans outputs (`--json`) when available.
- Avoid fragile plain-text parsing.
- Normalize status/type/priority values against workspace config.
- Use explicit error types for CLI invocation, parse failures, missing config, and permission errors.

### Process execution + security

- Never build shell strings with unsanitized input.
- Use argument arrays for process execution.
- Treat workspace content as untrusted input.
- Never hardcode secrets.
- If future features need credentials, use environment variables or VS Code secret storage.

## Copilot + AI integration requirements

### MCP integration

- Support MCP server integration for Beans workflows:
  - contribute/start/manage server definitions as appropriate for extension capabilities.
  - align with VS Code MCP config model (`mcp.json` and provider APIs).
- Provide commands for troubleshooting (open MCP output/log guidance).
- Respect trust and security expectations for MCP servers.

### Chat participant integration

- Add a Beans-focused chat participant that can:
  - summarize issue status
  - suggest next actions
  - create/update beans from structured user intent
- Use prompt templates (prompt-tsx) to keep prompts structured and maintainable.
- Explicitly scope tool usage to Beans operations to reduce accidental side effects.

### Copilot instructions interplay

- Keep this file current as extension capabilities evolve.
- Add concise tool-selection guidance for Beans workflows.

## Settings and configuration

Contribute extension settings for at least:

- auto-init prompt enable/disable
- default sort mode
- default expanded/collapsed state per pane (active/completed/scrapped/archived)
- default command palette scope (active vs all)
- beans CLI path override
- log verbosity
- preview behavior

Use clear names, descriptions, defaults, and validation.

## Notifications and UX feedback

- Use concise, actionable notifications.
- Distinguish between info/warn/error.
- Include “Open Logs” / “Retry” actions when relevant.
- Avoid repeated spam notifications for the same root cause.

## Keyboard and accessibility requirements

- Ensure all major actions are command-accessible (keyboard-first).
- Respect focus behavior in tree, quick picks, and editors.
- Follow WCAG 2.2 AA intent for extension UI surfaces.
- Use semantic labels and accessible names in quick picks and action titles.

## Remote compatibility requirements

- Design extension to work in SSH/WSL/devcontainer/Codespaces scenarios.
- Ensure Beans CLI invocation resolves correctly in remote extension host.
- Handle absent CLI with guided install/help messaging.
- Avoid assumptions about local file paths.

## Testing strategy (required)

### Unit tests

- Tree shaping/sorting/filtering logic.
- Command argument mapping.
- Config parsing and defaults.
- Error mapping.

### Integration tests

- Extension activation + command registration.
- Tree population from fixture Beans workspaces.
- Create/edit/status/type/priority/blocking flows.
- Init prompt behavior with and without `.beans.yml`.
- Command palette filtering for completed/scrapped.

### AI integration tests

- MCP provider registration and definition refresh behavior.
- Chat participant prompt assembly and guardrails.

### CI expectations

- Run lint, typecheck, unit, and integration tests in CI.
- Fail fast on type or lint regressions.
- Publish test artifacts/logs on failure.

## Implementation sequencing guidance

1. Build Beans service + models.
2. Implement tree view + refresh + sorting/filtering.
3. Add open/edit/create and core metadata mutations.
4. Add blocking/parent/tag workflows.
5. Add init detection and settings.
6. Add Copilot MCP + chat integration.
7. Harden remote behavior.
8. Finalize tests + CI.

## Definition of done

A feature is done only when:

- command(s) implemented
- tree/context/menu wiring complete
- settings and docs updated
- tests added/updated
- remote behavior considered
- errors surfaced with actionable messages

## Quality guardrails for contributors

- Keep changes modular and testable.
- Prefer small PRs with focused scope.
- Do not rewrite unrelated code.
- Preserve existing public command IDs unless intentionally versioned.
- Update this file whenever behavior contracts change.
