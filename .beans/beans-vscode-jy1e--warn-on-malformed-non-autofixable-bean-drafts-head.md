---
# beans-vscode-jy1e
title: Warn on malformed non-autofixable bean + drafts header warning icon
status: in-progress
type: feature
priority: high
branch: feature/beans-vscode-jy1e-malformed-warning-icon
created_at: 2026-02-19T19:12:36Z
updated_at: 2026-02-19T19:15:00Z
---

When a malformed bean cannot be auto-fixed, show a popup warning and add an orange warning icon in the Drafts header linking to the first malformed file. Keep link updated as malformed files are resolved until none remain.

## Todo

- [x] Create and push feature branch
- [ ] Find malformed-bean detection and auto-fix flow in extension code
- [ ] Implement warning popup for non-autofixable malformed bean
- [ ] Add orange warning icon in Drafts header linking to first malformed file
- [ ] Keep warning link updated as malformed files are resolved
- [ ] Add or update tests
- [ ] Run compile and tests
