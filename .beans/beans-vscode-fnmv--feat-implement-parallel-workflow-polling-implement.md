---
# beans-vscode-fnmv
title: 'feat: Implement parallel workflow polling (implementation epic)'
status: todo
type: epic
created_at: 2026-02-18T19:11:45Z
updated_at: 2026-02-18T19:11:45Z
---

Epic to implement the parallel workflow polling feature (branch: feat/parallel-workflow-polling). Break into tasks: (1) design polling architecture with concurrency limits and backoff, (2) integrate with file watcher and MCP definitions to avoid duplicate polling across workspaces, (3) add tests and documentation, (4) expose configuration (beans.fileWatcher.pollingConcurrency). This epic should reference unit and integration tests that must be TDD-first.
