---
# beans-vscode-6h2m
title: Deepen BeansMcpServer tool tests
status: todo
type: task
priority: high
created_at: 2026-02-17T03:20:10Z
updated_at: 2026-02-17T03:20:10Z
parent: beans-vscode-mdvp
---

Expand MCP server test depth beyond happy paths and light handler checks:

- Validate zod input boundaries/tool schema behavior with negative cases.
- Add CLI execution failure modes (timeouts, non-zero exits, stderr-only, malformed JSON fragments).
- Assert per-tool CLI argument construction and mutation semantics.
- Cover file/path edge cases and permission failures more thoroughly.
