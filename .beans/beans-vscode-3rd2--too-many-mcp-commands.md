---
# beans-vscode-3rd2
title: too many mcp commands
status: in-progress
type: feature
created_at: 2026-02-24T02:56:47Z
updated_at: 2026-02-24T03:00:00Z
branch: feature/3rd2-too-many-mcp-commands
---

hew down the number of mcp commands but provide a wider array of internal function for mcp commands  so that you don't really lose anything

## Todo

- [x] Create branch `feature/3rd2-too-many-mcp-commands`
- [ ] Add failing unit test(s) that demonstrate current MCP command surface is excessive
- [ ] Implement internal function library and refactor MCP commands to use it (reduce exposed commands)
- [ ] Run tests and adjust implementation until tests pass
- [ ] Update MCP docs and extension command registry to reflect the new, smaller MCP surface
- [ ] Add unit/integration tests covering new internal functions

## Notes

- Initial work started and bean moved to `in-progress`. First steps: create branch and add this checklist. Next actionable change will be writing failing tests to drive the refactor.
