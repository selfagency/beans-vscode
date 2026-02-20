---
# beans-vscode-k2bx
title: Prompt user to reinitialize Copilot artifacts after extension update
status: todo
type: task
priority: normal
created_at: 2026-02-19T12:04:00Z
updated_at: 2026-02-19T12:04:00Z
---

When a new version of the extension is installed or activated, prompt the user to reinitialize to receive the latest Copilot instructions and skills. The implementation should:

- Detect when extension version has changed since last run (store last-initialized extension version in workspace state).
- Show a non-intrusive notification with actions: "Reinitialize now" and "Remind me later".
- If the user selects "Reinitialize now", run the reinitialization flow (see bean for command palette reinit).

Ensure this respects workspace trust and only writes files when the workspace is trusted.
