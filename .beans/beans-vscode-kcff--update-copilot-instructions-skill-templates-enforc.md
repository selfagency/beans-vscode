---
# beans-vscode-kcff
title: update copilot instructions skill templates enforc
status: completed
type: task
priority: normal
created_at: 2026-02-24T16:02:13Z
updated_at: 2026-02-24T16:03:17Z
---

```markdown
---
# beans-vscode-kcff
title: 'Update Copilot instructions & skill templates: enforce branch + bean usage'
status: todo
type: task
created_at: 2026-02-24T15:50:43Z
updated_at: 2026-02-24T15:50:43Z
id: beans-vscode-kcff
branch: feature/beans-vscode-kcff-update-copilot-templates
pr: 92
---
Update the Copilot instruction and skill templates so the agent must:

- always create a new branch before starting work on a bean OR switch to that bean's existing branch if present
- never use an internal agent todo list — instead update the bean file's markdown `## Todo` checklist and keep it in sync
- never create beans from scratch; always use the MCP to open/modify beans and never add custom fields except `pr` (PR number) and `branch`

Notes: the templates to edit live in `src/beans/config/templates/` (Copilot instructions and skill). This change is intended to guide the agent's behavior when interacting with beans.

```
