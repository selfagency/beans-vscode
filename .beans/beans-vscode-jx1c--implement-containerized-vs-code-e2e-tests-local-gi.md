---
# beans-vscode-jx1c
title: Implement containerized VS Code E2E tests (local + GitHub Actions)
status: draft
type: task
priority: high
created_at: 2026-02-17T22:51:13Z
updated_at: 2026-02-17T22:51:13Z
---

## Why

The repo has strong unit/integration and remote-compat coverage, but it does not yet have dedicated containerized VS Code extension-host E2E coverage that validates real extension behavior end-to-end in CI and locally.

## Goal

Add deterministic, containerized VS Code E2E tests for this extension that can be run:

1. Locally by contributors
2. In GitHub Actions on PR/push

## Existing context to use

- docs/plans/gh-actions-vscode-e2e-plan.md
- docs/testing.md
- docs/remote-compatibility-testing.md
- scripts/test-remote.sh
- .github/workflows/remote-test.yml

## Scope

### In scope

- Introduce dedicated E2E harness/config separate from current integration harness
- Add initial E2E tests for critical user flows (activation + core command path + tree/details visibility)
- Add containerized local run path
- Add dedicated GitHub Actions workflow for containerized E2E
- Publish useful artifacts (logs/test output) on failure
- Document local + CI usage and boundaries between test layers

### Out of scope (initial pass)

- Large cross-platform matrix as required gate on day one
- Broad flaky UI scenarios without deterministic fixtures

## Implementation instructions

1. **Create dedicated E2E harness**
   - Add a separate VS Code test config (do not replace existing integration config), e.g. `.vscode-test.e2e.mjs`.
   - Ensure it launches extension tests from `src/test/e2e/**` only.

2. **Add E2E test structure + fixtures**
   - Add `src/test/e2e/` with clear setup/teardown utilities.
   - Add deterministic fixture workspace data under `src/test/fixtures/e2e/` (including `.beans` and config where needed).
   - Avoid network-dependent assertions and fragile timing assumptions.

3. **Add local scripts**
   - Add package scripts for E2E lifecycle (example naming):
     - `test:e2e`
     - `test:e2e:ci`
     - optional `test:e2e:container`
   - Keep current `test` and `test:integration` behavior unchanged.

4. **Add containerized local execution path**
   - Reuse existing remote/container testing patterns as reference, but make this extension-host E2E focused.
   - Provide a documented one-command local entrypoint for contributors.

5. **Add GitHub Actions workflow**
   - Create dedicated workflow (e.g. `.github/workflows/e2e-container.yml`) separate from `ci.yml` initially.
   - Run in Linux containerized environment with pinned/stable setup.
   - Include clear timeout and artifact upload on failure.
   - Do not break existing CI/remote-test gating while introducing this workflow.

6. **Documentation updates**
   - Update `docs/testing.md` with:
     - Test layer boundaries (unit vs integration vs remote-compat vs e2e)
     - Local E2E commands
     - CI E2E workflow behavior
     - Troubleshooting notes

## Initial E2E coverage (P0)

- Extension activation succeeds in test workspace
- Core Beans views become available when initialized
- At least one command path executes end-to-end (view/create/update flow)
- Tree/details render expected state for deterministic fixtures

## Reliability requirements

- Tests must be deterministic and stable in CI
- No sleep-based assertions without polling/backoff strategy
- Failures should emit actionable logs/artifacts

## Acceptance criteria

- [ ] Dedicated E2E harness exists and is isolated from existing integration harness
- [ ] `src/test/e2e/**` and `src/test/fixtures/e2e/**` are added with at least one robust suite
- [ ] Local containerized E2E run path works from docs
- [ ] New GitHub Actions E2E container workflow runs on PR/push
- [ ] Failure artifacts are uploaded in CI
- [ ] `docs/testing.md` updated with clear instructions and boundaries
- [ ] Existing test workflows remain green and unaffected

## Deliverables

- New/updated test harness files
- New E2E tests + fixtures
- New workflow file for containerized E2E
- Docs updates in testing documentation
- Follow-up note on whether/when to promote workflow to required gate

## Definition of done

All acceptance criteria checked, CI passing, and local run instructions verified end-to-end by execution.
