---
# beans-vscode-pn5z
title: Plan extension update for Beans >=0.4.0 + beans-mcp compatibility
status: completed
type: task
priority: high
created_at: 2026-03-13T19:56:15Z
updated_at: 2026-03-13T19:58:43Z
---

Review beans release changes from 0.4.0 onward, assess latest beans-mcp updates, and draft a migration plan for beans-vscode to align commands, generated instructions/skills, and prime-first workflows.

## Todo

- [x] Audit current extension functionality and generated artifacts
- [x] Compile beans release changes from 0.4.0 onward
- [x] Compile latest beans-mcp changes and compatibility impacts
- [x] Build gap matrix (current vs required behavior)
- [x] Draft phased implementation plan with validation strategy

## Summary of Changes

Completed a full compatibility review across:
- Current `beans-vscode` command/config/template/docs surfaces
- Upstream Beans releases from `v0.4.0` through `v0.4.2`
- `@selfagency/beans-mcp` `v0.4.2` release and diff from `v0.1.4`

Identified concrete gaps (tool operation parity, prime-based instruction generation, docs/tool naming drift, package version lag, and test coverage updates) and produced a phased migration plan with validation checkpoints.
