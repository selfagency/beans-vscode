---
# beans-vscode-qis4
title: 'Simplify quarantine: orphan children instead of creating placeholders'
status: in-progress
type: feature
created_at: 2026-02-19T23:44:57Z
updated_at: 2026-02-19T23:44:57Z
---

Replace `createPlaceholdersForQuarantinedBeans` (and its helpers `inferPlaceholderType`, `buildRecoveredBeanBody`) with a simpler `orphanChildrenOfQuarantinedBeans` method that just clears the parent field on affected children. Also add child-awareness to the `deleteBean` command (ask to delete children or just orphan them).
