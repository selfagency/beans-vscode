## Plan: Containerized VS Code E2E Rollout

Add a dedicated GitHub Actions workflow that runs extension-host E2E tests in a containerized Linux environment first, without destabilizing existing CI gates. Keep current unit/integration/remote-compat flows intact, then phase in stricter E2E enforcement after stability targets are met.

**Steps**
1. Baseline current gates and boundaries in `.github/workflows/ci.yml`, `.github/workflows/remote-test.yml`, `docs/testing.md`, and `docs/remote-compatibility-testing.md`.
2. Create an isolated E2E harness using `.vscode-test.e2e.mjs` (do not replace `.vscode-test.mjs`).
3. Add E2E structure at `src/test/e2e/**` with deterministic fixtures in `src/test/fixtures/e2e/**`.
4. Add `package.json` scripts for E2E lifecycle (local and CI variants), preserving existing `test` and `test:integration`.
5. Add `.github/workflows/e2e-container.yml` to run containerized VS Code E2E on 5. Add `.github/workflows/e2e-container.yml` E2E workflow separate from `ci.yml` initially; promote to required only after reliability thresholds are reached.
7. Expand from P0 critical flows to P1/P2 gradually.
8. Update docs with run instructions, boundaries, and triage playbook.

**Verification**
- Confirm `ci.yml` still runs the existing core gate (`pnpm test`).
- Confirm remote compatibility workflow remains compatibility-focused, not extension-host E2E.
- Confirm `.vscode-test.e2e.mjs` isolates E2E from existing integration runs.
- Confirm `package.json` includes explicit E2E scripts.
- Validate local sequence: compile, unit tests, integration tests, then E2E.
- Validate CI E2E workflow uploads useful artifacts (logs/traces/output) on failure.
- Validate docs clearly separate unit/integration/remote-compat/E2E responsibilities.

**Decisions**
- Start with a dedicated E2E workflow instead of immediate `ci.yml` coupling.
- Use fixture-driven deterministic tests for stability.
- Keep remote compatibility checks and E2E correctness checks separate.
- Promote to stricter gating only after measuring flake rate and runtime.

**Phased scope**
- P0: Activation, initialized/missing-workspace behavior, core command path (create/view/update), refresh/tree correctness.
- P1: Parent/blocking workflows, delete safety flows, filter/sort/search behavior.
- P2: MCP/chat end-to-end, broader image matrix, release-tag stronger gating.

**Risks & mitigations**
- Flake risk: use deterministic fixtures, explicit polling, and minimal timing assumptions.
- Cost/runtime risk: keep required lane narrow (single Linux container), run matrix expansion as optional/nightly.
- Debuggability risk: always publish E2E artifacts on failure.
- Scope confusion risk: document strict boundaries across test layers.

**Exit criteria**
- Dedicated E2E workflow exists and runs on PR/push.
- E2E tests are organized under `src/test/e2e/**` with fixtures under `src/test/fixtures/e2e/**`.
- E2E harness config is isolated via `.vscode-test.e2e.mjs`.
- E2E scripts are documented and runnable locally and in CI.
- Team agrees on objective promotion criteria for making E2E a required gate.
