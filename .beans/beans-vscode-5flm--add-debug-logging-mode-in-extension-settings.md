---
# beans-vscode-5flm
title: Add debug logging mode in extension settings
status: in-progress
type: feature
priority: normal
created_at: 2026-02-19T19:12:43Z
updated_at: 2026-02-20T04:09:05Z
---

Add an extension setting to enable debug logging that includes fuller diagnostics such as GraphQL queries and CLI responses.

## Todo

- [ ] Add failing tests for diagnostics-gated logging in `BeansOutput` and `BeansService`
- [ ] Add `beans.logging.diagnostics.enabled` contribution in `package.json`
- [ ] Implement diagnostics-only logging path in `src/beans/logging/BeansOutput.ts`
- [ ] Route GraphQL query/variables and CLI stdout/stderr diagnostics through the new logger method
- [ ] Run focused tests, then full compile/test/lint validation
