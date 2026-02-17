---
# beans-vscode-hh5f
title: Enforce sequential CI/remote/release and fix devcontainer image push
status: completed
type: bug
priority: high
created_at: 2026-02-17T16:00:47Z
updated_at: 2026-02-17T16:02:52Z
---

Make workflows run strictly sequentially (CI -> Remote Compatibility Tests -> Release), prevent release skip, and fix devcontainer action error requiring imageName for push to GHCR.

## Summary of Changes

- Made CI/remote/release execution strictly sequential by triggering Remote Compatibility Tests from successful CI completion.
- Fixed release skip behavior by removing brittle push-event gating and relying on SHA-tag matching after successful upstream workflow completion.
- Fixed Dev Container Test image push requirements by adding GHCR login + explicit imageName/cacheFrom/push configuration for devcontainers/ci.
- Added a dedicated CodeQL workflow to run security-and-quality plus local custom query packs for JavaScript/TypeScript and GitHub Actions.
