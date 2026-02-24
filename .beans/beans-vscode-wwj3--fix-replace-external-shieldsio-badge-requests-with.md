---
# beans-vscode-wwj3
title: 'fix: replace external shields.io badge requests with local inline badges in BeansPreviewProvider'
status: completed
type: task
priority: normal
created_at: 2026-02-24T13:49:26Z
updated_at: 2026-02-24T13:49:26Z
---

## Problem

`BeansPreviewProvider` embeds badge images using external URLs:

```typescript
// src/beans/preview/BeansPreviewProvider.ts:70-84
https://img.shields.io/badge/...
```

These fire outbound network requests on every bean preview, causing two issues:

1. **Privacy**: shields.io learns which badge values are viewed and from which IP address.
2. **Offline/air-gapped environments**: badges fail to render, degrading the preview UI.

Status, type, and priority are all bounded enumerations — their display values are fully known at build time.

## Affected File

- `src/beans/preview/BeansPreviewProvider.ts:70-84`

## Recommendation

Render badges locally using either:

- VS Code codicons (already a dependency)
- Simple inline SVG generated from the enum values
- Styled `<span>` elements with CSS (coloured chips)

This eliminates the network dependency entirely.

## Comment

This shouldn't even exist anymore after we eliminated the preview view to use the details pane instead.
