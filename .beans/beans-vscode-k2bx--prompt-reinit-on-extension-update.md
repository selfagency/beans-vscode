---
# beans-vscode-k2bx
title: Prompt user to reinitialize Copilot artifacts after extension update
status: in-progress
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

## Todo

- [x] Mark bean in-progress and record initial plan
- [ ] Add extension version check on activation (only prompt when a previously-saved version exists and differs)
- [ ] Show non-intrusive reinit prompt with actions:
	- 'Reinitialize now (regenerates instructions & skill)'
	- 'Remind me later'
- [ ] If user selects reinitialize: call `beans.reinitializeCopilotArtifacts` and, on success, update workspaceState `beans.lastInitializedExtensionVersion` to the current extension version
- [ ] Respect workspace trust: if workspace is not trusted, prompt user to trust and do not write files until trusted
- [ ] Add tests and validate via `pnpm run compile` and `pnpm run test`
 - [x] Add tests and validate via `pnpm run compile` and `pnpm run test`

