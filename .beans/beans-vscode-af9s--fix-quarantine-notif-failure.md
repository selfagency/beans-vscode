---
id: beans-vscode-af9s
title: "fix: quarantine notifcation failure"
status: in-progress
type: bug
priority: normal
branch: fix/af9s-quarantine-notif-failure
files:
  - src/beans/service/BeansService.ts
  - src/extension.ts
  - src/beans/mcp/BeansMcpIntegration.ts
pr: 
---

## Todo

- [ ] Create feature branch `fix/af9s-quarantine-notif-failure` (done)
- [ ] Add focused unit test reproducing quarantine notification formatting
- [ ] Implement notification formatting fix (show filename only + user-friendly message)
- [ ] Run tests and verify behavior manually (open quarantine flow)
- [ ] Commit, push, open draft PR

## Notes

Observed behavior: when parsing of a quarantined bean file fails during `beans` CLI load, the error message shown to the user contains the raw CLI error and stack/trace, including file path and YAML parser details. We should instead show a concise, actionable notification that includes only the quarantined filename and instructions to fix or recover (move file out of .beans/.quarantine).

Potential areas to change:
- `BeansService` quarantine logic: when moving malformed files to `.beans/.quarantine`, ensure message formatting is stable and only exposes filename.
- `extension.ts` or MCP integration where the error notification is shown: format the message shown to the user.
