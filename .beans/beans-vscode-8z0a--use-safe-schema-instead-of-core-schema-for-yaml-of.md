---
# beans-vscode-8z0a
title: Use SAFE_SCHEMA instead of CORE_SCHEMA for YAML offline mode warning to users -t task -s todo -p normal -d Currently offline mode only logs to output channel, but users should see a VS Code warning notification when extension falls back to cached data.
status: completed
type: task
priority: low
created_at: 2026-02-17T03:49:50Z
updated_at: 2026-02-17T22:37:50Z
---

CORE_SCHEMA is overly restrictive for .beans.yml config file. SAFE_SCHEMA provides better balance of security and YAML feature support (timestamps, integers, floats, anchors, aliases).

Location: src/beans/config/BeansConfigManager.ts line 46-48

## Rationale
- CORE_SCHEMA: only JSON-compatible types
- SAFE_SCHEMA: common YAML types without unsafe features
- DEFAULT_SCHEMA: unsafe (includes  beans create Show

## Summary of Changes

- Verified against installed `js-yaml@4.1.1` and docs: `SAFE_SCHEMA` is not exported in v4.
- Updated `src/beans/config/BeansConfigManager.ts` to use `yaml.DEFAULT_SCHEMA` instead of `yaml.CORE_SCHEMA`.
- Updated parser comments to reflect v4 behavior (`load` is safe baseline; unsafe JS-specific types require explicit external schema extension).
- Added/updated test coverage in `src/test/beans/config/BeansConfigManager.test.ts` with a behavior-based assertion (`created_at` parses to `Date`) that validates default-schema parsing behavior.
- Validation: targeted config tests passing, compile/typecheck/lint/build passing.
