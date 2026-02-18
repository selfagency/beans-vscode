#!/usr/bin/env zx

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

$.verbose = false;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
cd(ROOT);

// ---------------------------------------------------------------------------
// Argument validation
// ---------------------------------------------------------------------------

const version = argv._[0];
if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('Usage: pnpm release <version>   (e.g. pnpm release 1.0.5)');
  process.exit(1);
}

const tag = `v${version}`;

// ---------------------------------------------------------------------------
// Rollback state
//   commitLocal  — release commit exists locally but has not been pushed
//   commitPushed — release commit has been pushed to origin/main
//   releaseDone  — tag has been pushed; release is complete, nothing to undo
// ---------------------------------------------------------------------------

let commitLocal = false;
let commitPushed = false;
let releaseDone = false;

async function rollback() {
  if (releaseDone) {return;}
  $.verbose = false;
  try {
    if (commitPushed) {
      console.log('\n⚠️  Release aborted after push. Reverting release commit on origin/main...');
      try {
        await $`git revert --no-edit HEAD`;
        await $`git push origin main`;
        console.log('↩️  Release commit reverted and pushed. Working tree is clean.');
      } catch {
        console.error('❌ Automatic revert failed. Manually run:');
        console.error('   git revert HEAD && git push origin main');
      }
    } else if (commitLocal) {
      console.log('\n⚠️  Release aborted before push. Resetting local release commit...');
      try {
        await $`git reset --hard HEAD~1`;
        console.log('↩️  Local release commit removed. Working tree restored.');
      } catch {
        console.error('❌ Reset failed. Manually run: git reset --hard HEAD~1');
      }
    }
  } catch { /* best effort */ }
}

process.on('SIGINT', async () => { await rollback(); process.exit(130); });
process.on('SIGTERM', async () => { await rollback(); process.exit(143); });

// ---------------------------------------------------------------------------
// Main — wrapped so any unhandled error triggers rollback
// ---------------------------------------------------------------------------

async function main() {
  // --- Prerequisites -------------------------------------------------------

  for (const bin of ['gh', 'git']) {
    try {
      await $`which ${bin}`;
    } catch {
      console.error(`❌ '${bin}' is required but not found in PATH.`);
      process.exit(1);
    }
  }

  try {
    await $`gh auth status`;
  } catch {
    if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) {
      console.log('ℹ️  gh auth status failed but GH_TOKEN/GITHUB_TOKEN is set; continuing.');
    } else {
      console.error('❌ GitHub CLI is not authenticated. Run: gh auth login');
      process.exit(1);
    }
  }

  // --- Precondition checks --------------------------------------------------

  const dirty = (await $`git status --porcelain`).stdout.trim();
  if (dirty) {
    console.error('❌ Working tree is not clean. Commit or stash changes first.');
    process.exit(1);
  }

  const branch = (await $`git rev-parse --abbrev-ref HEAD`).stdout.trim();
  if (branch !== 'main') {
    console.error(`❌ Must run from 'main'. Current branch: ${branch}`);
    process.exit(1);
  }

  console.log('🔄 Fetching latest refs...');
  await $`git fetch origin main`;
  await $`git pull --ff-only origin main`;

  const localTag = (await $`git tag -l ${tag}`).stdout.trim();
  if (localTag) {
    console.error(`❌ Local tag ${tag} already exists.`);
    process.exit(1);
  }

  const remoteTag = (await $`git ls-remote --tags --refs origin refs/tags/${tag}`).stdout.trim();
  if (remoteTag) {
    console.error(`❌ Remote tag ${tag} already exists.`);
    process.exit(1);
  }

  // --- Metadata -------------------------------------------------------------

  const repo = (await $`gh repo view --json nameWithOwner --jq '.nameWithOwner'`).stdout.trim();

  const previousTag = (
    await $`git ls-remote --tags --refs origin 'refs/tags/v*'`
  ).stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t')[1]?.replace('refs/tags/', ''))
    .filter((t) => t && t !== tag)
    .sort((a, b) => {
      // Semantic version sort
      const parse = (v) => v.replace(/^v/, '').split('.').map(Number);
      const [aMaj, aMin, aPatch] = parse(a);
      const [bMaj, bMin, bPatch] = parse(b);
      return aMaj - bMaj || aMin - bMin || aPatch - bPatch;
    })
    .at(-1) ?? '';

  // --- Release notes --------------------------------------------------------

  console.log(`📝 Generating release notes for ${tag}...`);

  const generateNotesArgs = [
    'api',
    '--method', 'POST',
    `/repos/${repo}/releases/generate-notes`,
    '-f', `tag_name=${tag}`,
    '-f', 'target_commitish=main',
    ...(previousTag ? ['-f', `previous_tag_name=${previousTag}`] : []),
    '--jq', '.body // ""',
  ];
  const releaseNotesOut = await $`gh ${generateNotesArgs}`;

  const releaseNotes = releaseNotesOut.stdout.trim() || '- No notable changes.';

  // --- Update package.json --------------------------------------------------

  console.log(`🧩 Updating package.json to ${version}...`);
  const pkgPath = resolve(ROOT, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.version = version;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  // --- Update CHANGELOG.md --------------------------------------------------

  console.log('🧩 Updating CHANGELOG.md...');
  const changelogPath = resolve(ROOT, 'CHANGELOG.md');
  const date = new Date().toISOString().slice(0, 10);
  const heading = `## [${version}] - ${date}`;
  const sourceLine = previousTag ? `\n\n_Source: changes from ${previousTag} to ${tag}._` : '';
  const section = `\n${heading}\n\n${releaseNotes}${sourceLine}\n`;

  const original = existsSync(changelogPath)
    ? readFileSync(changelogPath, 'utf8')
    : '# Change Log\n\n## [Unreleased]\n';

  if (!original.includes(heading)) {
    const marker = '## [Unreleased]';
    const idx = original.indexOf(marker);
    const updated =
      idx >= 0
        ? `${original.slice(0, idx + marker.length)}\n${section}${original.slice(idx + marker.length)}`
        : `${original}\n${section}`;
    writeFileSync(changelogPath, updated);
  } else {
    console.log('ℹ️  CHANGELOG already contains this release heading; skipping.');
  }

  // --- Commit + push --------------------------------------------------------

  const hasChanges = (await $`git diff --name-only -- package.json CHANGELOG.md`).stdout.trim();
  if (hasChanges) {
    console.log('📦 Committing release metadata changes...');
    await $`git add package.json CHANGELOG.md`;
    await $`git commit -m ${'chore(release): update version and changelog for ' + tag + ' [skip ci]'}`;
    commitLocal = true;
  } else {
    console.log('ℹ️  No version/changelog changes detected; nothing to commit.');
  }

  console.log('🚀 Pushing main...');
  await $`git push origin main`;
  commitPushed = true;
  commitLocal = false;

  const headSha = (await $`git rev-parse HEAD`).stdout.trim();

  // --- Wait for required workflows (parallel) -------------------------------

  console.log(`🔎 Waiting for required workflows on ${headSha}...`);

  await Promise.all([
    waitForWorkflow('CI', repo, headSha),
    waitForWorkflow('Remote Compatibility Tests', repo, headSha),
  ]);

  // --- Tag + publish --------------------------------------------------------

  console.log(`🏷️  Creating annotated tag ${tag} at ${headSha}...`);

  const tagMessage = [
    `Release ${tag}`,
    releaseNotes,
    previousTag ? `Source: changes from ${previousTag} to ${tag}.` : '',
    `Target commit: ${headSha}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  await $`git tag -a ${tag} ${headSha} -m ${tagMessage}`;

  console.log(`🚀 Pushing tag ${tag}...`);
  await $`git push origin ${tag}`;

  releaseDone = true;
  console.log(`✅ Release complete: ${tag} → ${headSha}`);
}

// ---------------------------------------------------------------------------
// Workflow polling
// ---------------------------------------------------------------------------

async function waitForWorkflow(name, repo, headSha, { timeoutMs = 3_600_000, pollMs = 15_000 } = {}) {
  const log = (msg) => console.log(`[${name}] ${msg}`);

  const workflowsOut = await $`gh api ${[`/repos/${repo}/actions/workflows`, '--jq', `.workflows[] | select(.name == "${name}") | .id`]}`;
  const workflowId = workflowsOut.stdout.trim().split('\n')[0];

  if (!workflowId) {
    throw new Error(`[${name}] workflow not found in ${repo}`);
  }

  const deadline = Date.now() + timeoutMs;
  let triggered = false;

  while (Date.now() < deadline) {
    const runOut = await $`gh api ${[
      `/repos/${repo}/actions/workflows/${workflowId}/runs?branch=main&head_sha=${headSha}&per_page=5`,
      '--jq',
      '.workflow_runs[0] | "\(.status // "") \(.conclusion // "") \(.html_url // "")"',
    ]}`;
    const [status, conclusion, ...urlParts] = runOut.stdout.trim().split(' ');
    const runUrl = urlParts.join(' ');

    if (!status) {
      if (!triggered) {
        const remoteMain = (await $`git ls-remote --heads origin main`).stdout.trim().split(/\s+/)[0];
        if (remoteMain !== headSha) {
          throw new Error(
            `[${name}] HEAD_SHA (${headSha}) is no longer latest on main (remote is ${remoteMain}). Re-run release.`,
          );
        }
        log(`no run for ${headSha}; triggering via workflow_dispatch...`);
        await $`gh api --method POST /repos/${repo}/actions/workflows/${workflowId}/dispatches -f ref=main`;
        triggered = true;
        log('workflow_dispatch triggered; waiting for run to appear...');
      } else {
        log('no run yet; waiting...');
      }
    } else if (status !== 'completed') {
      log(`status=${status}; waiting...`);
    } else if (conclusion === 'success') {
      log('✅ passed');
      return;
    } else {
      const urlNote = runUrl ? `\n   Run: ${runUrl}` : '';
      throw new Error(`[${name}] conclusion=${conclusion}${urlNote}`);
    }

    await sleep(pollMs);
  }

  throw new Error(`[${name}] timed out after ${timeoutMs / 1000}s`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

main().catch(async (err) => {
  const msg = err?.message ?? String(err);
  // ProcessOutput errors from zx already printed the command output; only
  // print extra context for our own thrown errors.
  if (!(err instanceof ProcessOutput)) {
    console.error(`❌ ${msg}`);
  }
  await rollback();
  process.exit(err?.exitCode ?? 1);
});
