---
name: beans
title: Beans Skill
description: 'Use for Beans issue tracker workflows in this workspace: planning and decomposing epics, listing issues, finding top-priority or stale work, starting work on a bean, creating/updating issues via extension commands or MCP tools, managing status/type/priority/parent/blocking relationships, and suggesting issue-related branch, commit, and PR workflows. Triggers on: "create a bean", "what should I work on", "plan this epic", "decompose this feature", "find stale issues", "set priority", "start work", "what beans are in progress", "commit this work".'
---

# Beans Skill

This skill drives all Beans issue tracker operations in this workspace using the VS Code extension and MCP server as the primary interfaces. The CLI is a last-resort fallback only.

## Interface priority

**Always use the highest available interface. Never skip levels for convenience.**

1. **Beans MCP tools** — preferred programmatic interface when the UI is not in focus
2. **VS Code extension commands** (`beans.*`) — invoke via command palette or sidebar UI
3. **`@beans` chat participant** — for guidance, summaries, and structured workflows
4. **CLI** — only when extension, chat, and MCP are all genuinely unavailable; see CLI constraints

## Core rules (always enforced)

- **Never start work without a bean.** Find a relevant bean or create one first. No exceptions.
- **Prefer MCP tools, then extension commands.** Do not reach for the CLI unless all other interfaces are unavailable.
- **The bean is the source of truth.** Keep status, type, priority, parent, blocking, and body current.
- **Create a branch before writing code.** Name it `feature/<bean-id>-<slug>` or `fix/<bean-id>-<slug>`.
- **Record branch and PR in bean frontmatter.** Add `branch:` and `pr:` as soon as they exist; commit immediately.
- **Commit beans promptly.** Commit after create/edit unless building an epic hierarchy (batch commit everything together).
- **Track todos in the bean body.** Maintain a `## Todo` checklist; update and commit after every completed step.

## Agent constraints (must-follow)

- **Always create or switch to the bean's branch before editing code or files.**
  - If a branch exists for the bean, checkout it first. If not, create and push a new branch following the repository branch naming rules.
  - Record the branch in the bean frontmatter immediately after creating or checking out the branch.

- **Do not keep an internal agent todo list.**
  - All task state and subtasks must live in the bean's `## Todo` checklist in the bean body. The agent must update the bean `## Todo` via MCP or extension commands and commit the bean to persist progress.

- **Do not create or edit bean files by hand.**
  - Use the MCP or extension commands for bean creation and edits; never write `.md` bean files directly to the repository.
  - The agent must not add custom frontmatter keys except `branch` and `pr` (PR number). Adding other custom fields is forbidden.

## Starting work on a bean

1. Orient yourself first: `@beans /next` (what should I work on?) or `@beans /search <keywords>` (does a bean already exist?). Use `beans.search` if you know what you are looking for.
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

### Bean operations

| Command                 | Purpose                                                   |
| ----------------------- | --------------------------------------------------------- |
| `beans.create`          | Create a new bean                                         |
| `beans.view`            | Open bean in Details sidebar panel                        |
| `beans.edit`            | Edit bean body/frontmatter in editor                      |
| `beans.delete`          | Delete a bean (only draft or scrapped)                    |
| `beans.setStatus`       | Change status (todo → in-progress → completed / scrapped) |
| `beans.setType`         | Change type (task / feature / bug / epic / milestone)     |
| `beans.setPriority`     | Change priority (critical/high/normal/low/deferred)       |
| `beans.setParent`       | Link a bean to a parent epic or milestone                 |
| `beans.removeParent`    | Remove parent link                                        |
| `beans.editBlocking`    | Edit blocking/blocked-by relationships                    |
| `beans.reopenCompleted` | Reopen a completed bean                                   |
| `beans.reopenScrapped`  | Reopen a scrapped bean                                    |
| `beans.copyId`          | Copy bean ID to clipboard                                 |

### Search and navigation

| Command                   | Purpose                                        |
| ------------------------- | ---------------------------------------------- |
| `beans.search`            | Full-text search across all beans              |
| `beans.filter`            | Filter tree by status/type/priority/tag        |
| `beans.sort`              | Change tree sort mode                          |
| `beans.refresh`           | Force reload from disk                         |
| `beans.searchView.filter` | Filter search results                          |
| `beans.searchView.clear`  | Clear search filters and query                 |
| `beans.details.back`      | Navigate back in Details view browsing history |

### AI and workflow

| Command                  | Purpose                                         |
| ------------------------ | ----------------------------------------------- |
| `beans.copilotStartWork` | Open Copilot Chat with a bean workflow template |

**`beans.copilotStartWork` templates:** assess status, remaining steps, close/commit, export to GitHub issue, set in-progress, flesh out specs.

### Configuration and help

| Command                        | Purpose                                              |
| ------------------------------ | ---------------------------------------------------- |
| `beans.init`                   | Initialize Beans in an uninitialized workspace       |
| `beans.openConfig`             | Open `.beans.yml` configuration file                 |
| `beans.openExtensionSettings`  | Open VS Code extension settings for Beans            |
| `beans.showOutput`             | Show the Beans extension output/log channel          |
| `beans.openUserGuide`          | Open user guide documentation                        |
| `beans.openAiFeaturesGuide`    | Open AI features documentation                       |
| `beans.openFirstMalformedBean` | Navigate to first malformed bean file for correction |

## Chat participant (`@beans`) guidance

`@beans` is the human-facing conversational interface. Use it for orientation, guidance, and structured workflows — especially when you need to reason about what to work on next, confirm an epic plan before acting, or draft a commit message. It reads beans and returns natural-language responses; it does **not** mutate state. To create, edit, or change status, use extension commands or MCP tools.

**When to reach for `@beans`:**

- Before starting work: `/next` or `/priority` to orient yourself
- Before creating an epic: use it to propose the issue map (step 3 of planning mode) and confirm with the user before creating anything
- After finishing a step: `/commit` to draft a conventional commit message with the right bean reference
- At any time: `/summary` or `/stale` for a workspace health check

**Slash commands:**

| Command           | When to use                                                                                 | What it returns                                              |
| ----------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `/summary`        | Start of session or sprint; workspace health check                                          | Count by status + list of up to 10 in-progress beans         |
| `/priority`       | Before picking up new work; see what matters most                                           | Up to 8 active beans sorted by status then priority          |
| `/stale`          | Triage/cleanup; find forgotten work                                                         | Beans not updated in 21+ days, sorted oldest-first           |
| `/next`           | Deciding what to start; replaces manually scanning the tree                                 | Up to 8 todo/in-progress beans ranked by status + priority   |
| `/create`         | When you want guided prompting for all fields before calling `beans.create`                 | Field checklist (title, type, priority, description, parent) |
| `/search <query>` | Finding a bean by keyword before starting work or linking a parent                          | Up to 20 matching beans with id, title, status, type         |
| `/commit`         | After completing a step; drafts a conventional commit referencing the most relevant bean(s) | Likely bean IDs in context + example commit subject line     |

**Follow-up suggestions** — after any `@beans` response, VS Code surfaces quick-pick follow-ups for `/summary`, `/priority`, `/stale`, `/create`, and `/commit`. Use them to stay in flow without typing commands.

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

Child beans for an epic typically use `task`, `feature`, or `bug` types. `epic` and `milestone` are valid bean types in Beans, but reserve them for higher-level work or nested structures when the user explicitly asks for additional epics or milestones.

Example phases: **Foundation**, **Implementation**, **Validation**, **Documentation**, **Deployment**.

For each child issue include:

- Concise title (action-oriented)
- Type and priority
- One-line rationale
- Dependency chain (what must be done first)

### Step 4 — Get approval

Do not create any beans until the user approves the plan. Present the issue map as a chat reply (this is an `@beans` conversation step, not a mutation). Ask for a quick pass:

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
- Never pass large body text as a shell argument; use GraphQL variables or pipe the query into `beans graphql`.
- One operation at a time; no chained destructive commands.

**Allowed CLI command:**

- `beans graphql --json "<query>" [--variables <json>]` (strictly use the GraphQL API for all data operations)
- `beans archive <id>` — only with explicit user request

## Beans baseline

The following baseline is derived from `beans graphql --schema` and provides comprehensive guidance for working with beans in this project.

{{GRAPHQL_SCHEMA}}
