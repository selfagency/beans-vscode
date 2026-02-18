---
# beans-vscode-aiw2
title: 'test: Add unit tests for BeansChatIntegration handlers'
status: todo
type: task
created_at: 2026-02-18T19:11:43Z
updated_at: 2026-02-18T19:11:43Z
---

Add tests for chat handlers (`summary`, `next`, `priority`, `stale`, `create`, `commit`, `search`), mocking `BeansService.listBeans` and verifying output formatting over the chat stream, including cancellation and LLM general path. Document test harness pattern in README.
