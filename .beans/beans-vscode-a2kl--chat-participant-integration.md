---
# beans-vscode-a2kl
title: Chat participant integration
status: completed
type: task
priority: normal
created_at: 2026-02-16T04:04:52Z
updated_at: 2026-02-16T16:29:19Z
parent: beans-vscode-03yk
---

Create BeansChatIntegration with Beans-focused chat participant, slash commands, prompt-tsx templates, and scoped tool usage guardrails

## Summary of Changes

- Added BeansChatIntegration and registered a Beans-scoped chat participant (beans.chat).
- Added chat slash commands: /summary, /next, and /search with deterministic handlers tied to Beans service data.
- Added follow-up suggestions and guardrailed general prompt handling via buildBeansChatSystemPrompt.
- Added package contributions for chatParticipants and activation event onChatParticipant:beans.chat.
- Wired chat registration behind beans.ai.enabled in extension activation.
- Updated README to document chat participant and AI setting.
- Verified compile and tests pass (44 passing).
