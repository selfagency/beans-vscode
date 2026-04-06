---
# beans-vscode-wqss
title: Fix Windows MCP provider registration failure
status: completed
type: bug
priority: high
created_at: 2026-03-16T17:52:21Z
updated_at: 2026-03-16T17:53:55Z
---

Windows users hit an activation error from vscode.lm.registerMcpServerDefinitionProvider: package.json contribution for beans.mcpServers is reported missing. Investigate manifest/release skew and harden activation so outdated VS Code or mismatched packaged manifests do not break extension startup.

## Todo

- [x] Reproduce and inspect provider registration assumptions in source and tests
- [x] Implement a guard so MCP registration failures do not break activation
- [x] Add regression coverage for thrown provider registration errors
- [x] Run focused tests and compile
- [x] Summarize root cause and fix

## Summary of Changes

- Added a manifest preflight check before registering the MCP server definition provider.
- Wrapped provider registration in a try/catch so provider registration failures only disable MCP discovery instead of breaking extension activation.
- Added regression tests for both missing manifest contribution and thrown provider registration errors.
- Verified the focused MCP integration test file and a full compile pass.
