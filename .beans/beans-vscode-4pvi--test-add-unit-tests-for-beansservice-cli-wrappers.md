---
# beans-vscode-4pvi
title: 'test: Add unit tests for BeansService (CLI wrappers, retry, dedupe, offline cache)'
status: todo
type: task
priority: normal
created_at: 2026-02-18T19:11:41Z
updated_at: 2026-02-18T19:44:01Z
parent: beans-vscode-tkaj
---

Write unit tests for `BeansService` covering: successful JSON parse path, JSON parse error handling, execFile ENOENT -> BeansCLINotFoundError, retry/backoff for transient errors, request deduplication (concurrent identical calls), and offline cache fallback behavior. Use mocking for child_process.execFile and ensure tests are TDD-first (create failing tests before implementation).
