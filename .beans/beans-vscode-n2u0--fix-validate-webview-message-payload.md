---
id: beans-vscode-n2u0
title: "fix: validate webview message payload before passing to service in handleBeanUpdate"
status: in-progress
type: bug
priority: high
branch: fix/n2u0-validate-webview-payload
files:
  - src/beans/details/BeansDetailsViewProvider.ts
  - src/test/beans/details/handleBeanUpdate.test.ts
pr: https://github.com/selfagency/beans-vscode/pull/84
---

## Todo

- [ ] Create feature branch `fix/n2u0-validate-webview-payload`
- [ ] Add failing unit tests for `handleBeanUpdate` accepting invalid payloads
- [ ] Implement payload validation & sanitization in `handleBeanUpdate`
- [ ] Run unit tests and type-check
- [ ] Commit, push branch, and open draft PR

## Notes

Defence-in-depth: validate `updates` (unknown) before passing to `BeansService.updateBean`.
Allowed fields: status, type, priority, title, body. Use simple whitelist sanitization first; optionally migrate to Zod after.
