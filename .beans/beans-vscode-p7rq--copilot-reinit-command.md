---
# beans-vscode-p7rq
title: 'Command palette: Reinitialize Copilot instructions & skills'
status: completed
type: task
priority: normal
created_at: 2026-02-19T12:02:00Z
updated_at: 2026-02-24T02:39:27Z
---

Add a command to the command palette that reinitializes the Copilot instructions and skills artifacts (regenerates/writes the copilot instruction files and skill files into the workspace). The command should:

- Be discoverable via command palette (e.g., "Beans: Reinitialize Copilot Instructions & Skills").
- Ask for confirmation before overwriting existing user-modified instruction/skill files.
- Update the extension telemetry/logs when run and surface success/failure to the user via notification.
