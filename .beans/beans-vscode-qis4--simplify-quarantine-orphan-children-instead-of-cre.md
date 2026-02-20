---
# beans-vscode-qis4
title: 'Simplify quarantine: orphan children instead of creating placeholders'
status: completed
type: feature
priority: normal
created_at: 2026-02-19T23:44:57Z
updated_at: 2026-02-20T00:09:19Z
---

Replace `createPlaceholdersForQuarantinedBeans` (and its helpers `inferPlaceholderType`, `buildRecoveredBeanBody`) with a simpler `orphanChildrenOfQuarantinedBeans` method that just clears the parent field on affected children. Also add child-awareness to the `deleteBean` command (ask to delete children or just orphan them).

## Summary of Changes

- **Removed** `inferPlaceholderType`, `buildRecoveredBeanBody`, `createPlaceholdersForQuarantinedBeans` (~140 lines)
- **Added** `orphanChildrenOfQuarantinedBeans` (~50 lines): clears `parent` via `UPDATE_BEAN_MUTATION` for each child of a quarantined parent; shows one warning per quarantined parent
- **Updated** `listBeans` call site: removed the `quarantinedPaths.size > 0` guard; new method handles empty map with an early return
- **Updated** `deleteBean` command: detects children via `listBeans()` and shows a 3-button modal ("Delete All" / "Delete Parent Only" / "Cancel") when children exist; falls back to original single-confirm dialog when the bean has no children
- **Updated** `BeansService.test.ts`: replaced placeholder-creation test with orphan-children test verifying `UPDATE_BEAN_MUTATION` is called, no `CREATE_BEAN_MUTATION` is called, and `showWarningMessage` mentions the child code

Branch: `feature/92i0-priority-icons`
Commit: `2bf24cb`
