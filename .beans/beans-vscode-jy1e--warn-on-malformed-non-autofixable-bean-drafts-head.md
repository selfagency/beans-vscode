---
# beans-vscode-jy1e
title: Warn on malformed non-autofixable bean + drafts header warning icon
status: completed
type: feature
priority: high
created_at: 2026-02-19T19:12:36Z
updated_at: 2026-02-19T19:19:09Z
---

When a malformed bean cannot be auto-fixed, show a popup warning and add an orange warning icon in the Drafts header linking to the first malformed file. Keep link updated as malformed files are resolved until none remain.

## Todo

- [x] Create and push feature branch
- [x] Find malformed-bean detection and auto-fix flow in extension code
- [x] Implement warning popup for non-autofixable malformed bean
- [x] Add orange warning icon in Drafts header linking to first malformed file
- [x] Keep warning link updated as malformed files are resolved
- [x] Add or update tests
- [x] Run compile and tests

## Summary of Changes

- Added a malformed-bean warning popup when a bean cannot be auto-repaired and is quarantined as `.fixme`.
- Added a Drafts view header warning action (`beans.openFirstMalformedBean`) with warning icon, shown only when malformed `.fixme` files exist.
- Added dynamic context refresh logic so the action always points to the first available malformed file and clears automatically when none remain.
- Added/updated tests and validated with compile + full test run.
