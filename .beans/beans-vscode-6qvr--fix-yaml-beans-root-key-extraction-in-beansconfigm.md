---
# beans-vscode-6qvr
title: 'Fix YAML beans: root key extraction in BeansConfigManager'
status: completed
type: bug
priority: high
created_at: 2026-02-17T03:49:36Z
updated_at: 2026-02-17T03:51:11Z
parent: beans-vscode-3y36
---

.beans.yml has 'beans:' root key but code casts parsed YAML directly to BeansConfig without extracting nested structure. This results in { beans: { path: '...' } } instead of { path: '...' }.

Location: src/beans/config/BeansConfigManager.ts lines 58-59

## Fix
Extract 'beans' key before casting to BeansConfig

## Summary
Fixed critical bug where .beans.yml 'beans:' root key was not being extracted before casting to BeansConfig. Added proper validation and extraction logic.

Commit: 352a229
