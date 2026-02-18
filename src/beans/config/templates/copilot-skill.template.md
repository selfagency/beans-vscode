---
name: beans
description: 'Use for Beans issue tracker workflows in this workspace: planning and decomposing epics, listing issues, finding top-priority or stale work, starting work on a bean, creating/updating issues via extension commands or MCP tools, managing status/type/priority/parent/blocking relationships, and suggesting issue-related branch, commit, and PR workflows. Triggers on: "create a bean", "what should I work on", "plan this epic", "decompose this feature", "find stale issues", "set priority", "start work", "what beans are in progress", "commit this work".'
---

# Beans Skill

This skill drives all Beans issue tracker operations in this workspace using the VS Code extension and MCP server as the primary interfaces. The CLI is a last-resort fallback only.

## Interface priority

**Always use the highest available interface. Never skip levels for convenience.**

1. **VS Code extension commands** (`beans.*`) — invoke via command palette or sidebar UI
2. **`@beans` chat participant** — for guidance, summaries, and structured workflows
3. **Beans MCP tools** — preferred programmatic interface when the UI is not in focus
4. **CLI** — only when extension, chat, and MCP are all genuinely unavailable; see CLI constraints

## Core rules (always enforced)

- **Never start work without a bean.** Find a relevant bean or create one first. No exceptions.
- **Always use the extension or MCP.** Do not reach for the CLI unless all other interfaces are unavailable.
- **The bean is the source of truth.** Keep status, type, priority, parent, blocking, and body current.
- **Create a branch before writing code.** Name it `feature/<bean-id>-<slug>` or `fix/<bean-id>-<slug>`.
- **Record branch and PR in bean frontmatter.** Add `branch:` and `pr:` as soon as they exist; commit immediately.
- **Commit beans promptly.** Commit after create/edit unless building an epic hierarchy (batch commit everything together).
- **Track todos in the bean body.** Maintain a `## Todo` checklist; update and commit after every completed step.

## Starting work on a bean

1. Search for a relevant bean: `beans.search` or `@beans /search <keywords>`.
2. If none found, create one: `beans.create` → fill title, type, priority, description.
3. Set status to `in-progress`: `beans.setStatus`.
4. Create a branch named `feature/<bean-id>-<slug>` and push it.
5. Edit the bean to add `branch: <name>` to its frontmatter: `beans.edit`.
6. Commit the bean file with message: `chore(beans): start <bean-id> — set branch`.

## During work

- Add a `## Todo` checklist to the bean body on first edit.
- After each completed step: check off the item, `beans.edit` to save, commit bean with related code.
- If scope grows, create child beans with `beans.create` → `beans.setParent` to link them.

## Completing or scrapping a bean

**Complete:**

1. Add `## Summary of Changes` section to bean body via `beans.edit`.
2. `beans.setStatus` → `completed`.
3. Commit: `chore(beans): complete <bean-id>`.

**Scrap:**

1. Add `## Reasons for Scrapping` section via `beans.edit`.
2. `beans.setStatus` → `scrapped`.
3. Commit: `chore(beans): scrap <bean-id>`.

## VS Code extension command reference

| Command | Purpose |
| --- | --- |
| `beans.create` | Create a new bean |
| `beans.view` | Open bean details sidebar |
| `beans.edit` | Edit bean body/frontmatter in editor |
| `beans.setStatus` | Change status (todo → in-progress → completed / scrapped) |
| `beans.setType` | Change type (task / feature / bug / milestone) |
| `beans.setPriority` | Change priority (① critical … ⑤ low) |
| `beans.setParent` | Link a bean to a parent epic |
| `beans.removeParent` | Remove parent link |
| `beans.editBlocking` | Edit blocking/blocked-by relationships |
| `beans.copyId` | Copy bean ID to clipboard |
| `beans.delete` | Delete a bean (only draft or scrapped) |
| `beans.search` | Full-text search across all beans |
| `beans.filter` | Filter tree by status/type/priority/tag |
| `beans.sort` | Change tree sort mode |
| `beans.refresh` | Force reload from disk |
| `beans.reopenCompleted` | Reopen a completed bean |
| `beans.reopenScrapped` | Reopen a scrapped bean |
| `beans.copilotStartWork` | Ask Copilot to start work on the selected bean |

## Chat participant (`@beans`) command reference

| Slash command | Purpose |
| --- | --- |
| `/summary` | Status overview of all open beans |
| `/priority` | Top-priority active beans |
| `/stale` | Beans that haven't been updated recently |
| `/next` | Suggest the best bean to start next |
| `/create` | Guided bean creation workflow |
| `/search <query>` | Search beans by text |
| `/commit` | Suggest a commit message for current work |

## MCP tool guidance

Use MCP tools when automation is needed outside the VS Code UI:

1. **Read context first** — call `beans_vscode_llm_context` or equivalent view/search/filter/sort tools before mutating anything.
2. **Mutate with explicit intent** — create, edit, set status/type/priority, manage relationships.
3. **Destructive actions** — `delete` and `archive` require explicit user confirmation.
4. Prefer MCP over the CLI for any scripted or agent-driven operation.

## Planning mode: epic decomposition

When the user asks to plan an epic or decompose a feature:

### Step 1 — Clarify

Ask (or confirm from context):

- What is the end goal?
- Are there known constraints (deadline, stack, scope limits)?
- What is the definition of done?
- Does an epic/milestone bean already exist, or should one be created?

### Step 2 — Create the epic bean (if needed)

Use `beans.create`:

- Type: `milestone`
- Status: `todo`
- Title: concise epic name
- Body: goal statement + constraints + definition of done

### Step 3 — Propose the issue map

Group proposed child issues by outcome phase. Present a compact checklist for user approval before creating anything:

```text
- [ ] <title> — type=<task|feature|bug>, priority=<①–⑤>, depends_on=<bean-ids or none>
```

Example phases: **Foundation**, **Implementation**, **Validation**, **Documentation**, **Deployment**.

For each child issue include:

- Concise title (action-oriented)
- Type and priority
- One-line rationale
- Dependency chain (what must be done first)

### Step 4 — Get approval

Do not create any beans until the user approves the plan. Ask for a quick pass:

- "Does the issue map look right? Any changes before I create these?"

### Step 5 — Create child beans

For each approved child issue:

1. `beans.create` — set title, type, priority, and description.
2. `beans.setParent` — link to the epic bean.
3. `beans.setStatus` — set to `todo` (or `in-progress` for the first one the user wants to start immediately).

### Step 6 — Commit the hierarchy

Commit the epic bean and all child bean files together:

```text
chore(beans): plan <epic-bean-id> — <N> child issues
```

### Step 7 — Return a summary

Reply with:

```text
Epic:    <epic-id> <epic-title>
Created: <id> <title> [depends_on: <ids>]
         <id> <title>
         ...
Start with: <id> <title> — <one-line reason why>
```

## CLI fallback (last resort only)

Use CLI only when extension, `@beans`, and MCP tools are all unavailable.

**Hard constraints:**

- Always use `--json`; never parse plain-text output.
- Never pass large body text as a shell argument — write to a temp file and use `--body-file <path>`.
- One operation at a time; no chained destructive commands.

**Allowed commands:**

- `beans list --json --ready`
- `beans show --json <id>`
- `beans create --json --title "<title>" [--body-file <path>] ...`
- `beans update --json <id> [--body-file <path>] ...`
- `beans archive <id>` — only with explicit user request

## Beans CLI baseline (from `beans prime`)

```text
{{PRIME_OUTPUT}}
```
