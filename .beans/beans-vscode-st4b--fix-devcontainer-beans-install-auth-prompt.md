---
# beans-vscode-st4b
title: Fix devcontainer Beans install auth prompt
status: completed
type: bug
priority: high
created_at: 2026-02-17T16:19:45Z
updated_at: 2026-02-17T16:33:55Z
---

Devcontainer test on macOS fails with 'could not read Username for https://github.com: terminal prompts disabled'. Make Beans installation non-interactive and proxy-first.

## Summary of Changes

- Removed expression-based  value in devcontainers/ci step to avoid malformed value parsing.
- Split devcontainer execution into two explicit steps:
  - non-PR path with 
  - PR path with 
- Kept non-interactive, proxy-first Beans CLI install fallback inside runCmd.
