---
# beans-vscode-jml4
title: test reset beansoutput singleton between tests to
status: todo
type: task
priority: normal
created_at: 2026-02-24T13:49:22Z
updated_at: 2026-02-24T13:49:22Z
id: beans-vscode-jml4
---
## Problem

`BeansOutput.test.ts` calls `BeansOutput.getInstance()`, which returns the module-level singleton. Tests that modify the instance's state (log level, mirror path) mutate shared global state. The test file does not reset the static instance between tests.

This causes test ordering sensitivity: a test that sets the log level to `'error'` will affect subsequent tests that expect `'info'` level.

## Affected File

- `src/test/beans/logging/BeansOutput.test.ts`

## Recommendation

Expose a `BeansOutput.resetInstance()` method gated on `process.env.NODE_ENV === 'test'` (or similar guard), so tests can start with a clean instance. Call it in `beforeEach` / `afterEach`.

Alternatively, refactor `BeansOutput` to accept its dependencies via constructor injection so tests can instantiate isolated instances directly.
