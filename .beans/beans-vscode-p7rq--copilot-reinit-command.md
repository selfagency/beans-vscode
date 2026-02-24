---
branch: feat/p7rq-copilot-reinit-command
---

Add a command to the command palette that reinitializes the Copilot instructions and skills artifacts (regenerates/writes the copilot instruction files and skill files into the workspace). The command should:

- Be discoverable via command palette (e.g., "Beans: Reinitialize Copilot Instructions & Skills").
- Ask for confirmation before overwriting existing user-modified instruction/skill files.
- Update the extension telemetry/logs when run and surface success/failure to the user via notification.

## Todo

- [ ] Write failing test for `reinitializeCopilotArtifacts` command handler
- [ ] Register `beans.reinitializeCopilotArtifacts` in `package.json` commands
- [ ] Add command handler in `BeansCommands.ts` (confirm → write → notify)
- [ ] Register command in `extension.ts`
- [ ] Validate: compile passes, test passes
