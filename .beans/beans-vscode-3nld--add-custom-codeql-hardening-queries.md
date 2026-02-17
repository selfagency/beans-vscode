---
# beans-vscode-3nld
title: Add custom CodeQL hardening queries
status: completed
type: task
priority: normal
created_at: 2026-02-17T15:54:04Z
updated_at: 2026-02-17T15:58:19Z
---

Create custom CodeQL queries to harden GitHub Actions workflows and the TypeScript codebase, with actionable detections.

## Summary of Changes

- Added custom GitHub Actions CodeQL queries for stricter action pinning and safer github-script usage review.
- Added custom JavaScript/TypeScript CodeQL queries for shell-based child_process API usage and innerHTML assignment hotspots.
- Added README documentation in both custom query packs describing intent and query coverage.
