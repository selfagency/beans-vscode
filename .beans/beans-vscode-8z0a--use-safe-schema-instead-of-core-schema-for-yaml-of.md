---
# beans-vscode-8z0a
title: Use SAFE_SCHEMA instead of CORE_SCHEMA for YAML offline mode warning to users -t task -s todo -p normal -d Currently offline mode only logs to output channel, but users should see a VS Code warning notification when extension falls back to cached data.
status: todo
type: task
priority: low
created_at: 2026-02-17T03:49:50Z
updated_at: 2026-02-17T03:49:50Z
---

CORE_SCHEMA is overly restrictive for .beans.yml config file. SAFE_SCHEMA provides better balance of security and YAML feature support (timestamps, integers, floats, anchors, aliases).

Location: src/beans/config/BeansConfigManager.ts line 46-48

## Rationale
- CORE_SCHEMA: only JSON-compatible types
- SAFE_SCHEMA: common YAML types without unsafe features
- DEFAULT_SCHEMA: unsafe (includes  beans create Show
