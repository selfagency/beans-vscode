---
# beans-vscode-n2u0
title: 'fix: validate webview message payload before passing to service in handleBeanUpdate'
status: completed
type: bug
priority: high
created_at: 2026-02-24T13:49:05Z
updated_at: 2026-02-24T13:49:05Z
---

## Problem

`handleBeanUpdate` in `BeansDetailsViewProvider` receives a message payload from `webviewView.webview.onDidReceiveMessage` — an untrusted source — and passes it directly to the service without shape validation:

```typescript
// src/beans/details/BeansDetailsViewProvider.ts:100-117
private async handleBeanUpdate(updates: any): Promise<void> {
  if (!this._currentBean) return;
  try {
    const updatedBean = await this.service.updateBean(this._currentBean.id, updates);
```

Although the webview runs under the same extension origin and a scripts-only-via-nonce CSP, defence-in-depth requires validating message payloads before they reach the CLI.

A malformed or unexpected `updates` object (with arbitrary field names) reaches the CLI with no sanitisation.

## Affected File

- `src/beans/details/BeansDetailsViewProvider.ts:100-117`

## Recommendation

Apply a Zod schema or explicit type guard before passing `updates` to the service. At minimum:

```typescript
private async handleBeanUpdate(updates: unknown): Promise<void> {
  if (!updates || typeof updates !== 'object') return;
  const allowed = ['status', 'type', 'priority', 'title', 'body'];
  const sanitized = Object.fromEntries(
    Object.entries(updates as Record<string, unknown>).filter(([k]) => allowed.includes(k))
  );
  const updatedBean = await this.service.updateBean(this._currentBean!.id, sanitized);
```
