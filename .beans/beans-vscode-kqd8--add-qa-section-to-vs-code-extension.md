---
# beans-vscode-kqd8
title: Add Q&A section to VS Code extension
status: ""
type: feature
priority: "3"
created_at: 2026-02-19T19:31:42Z
updated_at: 2026-02-19T19:31:42Z
---

## Overview

Add a Q&A / FAQ section to the Beans VS Code extension to help users quickly find answers to common questions about using the extension, the `@beans` chat participant, MCP tools, and related workflows.

## Goals

- Provide a discoverable help surface for common questions
- Reduce friction for new users onboarding to Beans in VS Code
- Cover the most frequently asked topics: installation, commands, configuration, chat participant usage, MCP setup, and troubleshooting

## Proposed approach

- Add a Q&A panel to the existing Help view (`BeansHelpViewProvider`) or create a dedicated webview panel
- Source questions from a curated Markdown file (e.g. `docs/faq.md`) that is inlined by esbuild (like the Copilot template files)
- Render with expandable accordion items so the UI stays compact
- Include a search/filter input to surface relevant Q&A entries quickly
- Ensure the view is accessible (keyboard-navigable, proper ARIA roles)

## Todo

- [ ] Audit existing `BeansHelpViewProvider` to understand current structure
- [ ] Draft `docs/faq.md` with initial Q&A content
- [ ] Update/extend `BeansHelpViewProvider` to render Q&A accordion
- [ ] Wire up search/filter input
- [ ] Add unit tests for the view provider
- [ ] Update `README.md` and `docs/user-guide.md` with a note about the Q&A section
- [ ] Register any new commands in `package.json` and `BeansCommands.ts`
