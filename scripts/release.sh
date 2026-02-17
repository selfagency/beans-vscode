#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <version>"
  echo "Example: $0 1.0.5"
}

if [[ $# -ne 1 ]]; then
  usage
  exit 1
fi

VERSION="$1"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
  echo "❌ Invalid version: '$VERSION'"
  usage
  exit 1
fi

TAG="v${VERSION}"

if ! command -v gh >/dev/null 2>&1; then
  echo "❌ GitHub CLI (gh) is required."
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "❌ GitHub CLI is not authenticated. Run: gh auth login"
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "❌ Working tree is not clean. Commit or stash changes first."
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "❌ This script must run from 'main'. Current branch: $CURRENT_BRANCH"
  exit 1
fi

echo "🔄 Fetching latest refs..."
git fetch origin main --tags

echo "🔄 Fast-forwarding local main..."
git pull --ff-only origin main

if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null 2>&1; then
  echo "❌ Local tag ${TAG} already exists."
  exit 1
fi

if git ls-remote --exit-code --tags origin "refs/tags/${TAG}" >/dev/null 2>&1; then
  echo "❌ Remote tag ${TAG} already exists."
  exit 1
fi

REPO="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
PREVIOUS_TAG="$(git tag --list 'v*' --sort=-version:refname | grep -Fxv "$TAG" | head -n1 || true)"

echo "📝 Generating release notes for ${TAG}..."
if [[ -n "$PREVIOUS_TAG" ]]; then
  RELEASE_NOTES="$(gh api \
    --method POST \
    "/repos/${REPO}/releases/generate-notes" \
    -f tag_name="$TAG" \
    -f target_commitish="main" \
    -f previous_tag_name="$PREVIOUS_TAG" \
    --jq '.body // ""')"
else
  RELEASE_NOTES="$(gh api \
    --method POST \
    "/repos/${REPO}/releases/generate-notes" \
    -f tag_name="$TAG" \
    -f target_commitish="main" \
    --jq '.body // ""')"
fi

if [[ -z "${RELEASE_NOTES}" ]]; then
  RELEASE_NOTES='- No notable changes.'
fi

echo "🧩 Updating package.json version to ${VERSION}..."
VERSION="$VERSION" node <<'NODE'
const fs = require('fs');
const pkgPath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = process.env.VERSION;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
NODE

echo "🧩 Updating CHANGELOG.md..."
RELEASE_TAG="$TAG" PREVIOUS_TAG="$PREVIOUS_TAG" RELEASE_NOTES="$RELEASE_NOTES" node <<'NODE'
const fs = require('fs');

const changelogPath = 'CHANGELOG.md';
const releaseTag = (process.env.RELEASE_TAG || '').trim();
const version = releaseTag.replace(/^v/, '');
const previousTag = (process.env.PREVIOUS_TAG || '').trim();
const date = new Date().toISOString().slice(0, 10);
const heading = `## [${version}] - ${date}`;
const sourceLine = previousTag
  ? `\n\n_Source: changes from ${previousTag} to ${releaseTag}._`
  : '';
const notesRaw = (process.env.RELEASE_NOTES || '').trim();
const notes = notesRaw || '- No notable changes.';
const section = `\n${heading}\n\n${notes}${sourceLine}\n`;

const original = fs.existsSync(changelogPath)
  ? fs.readFileSync(changelogPath, 'utf8')
  : '# Change Log\n\n## [Unreleased]\n';

if (original.includes(heading)) {
  console.log('CHANGELOG already contains this release heading; skipping update.');
  process.exit(0);
}

const marker = '## [Unreleased]';
const idx = original.indexOf(marker);
const updated =
  idx >= 0
    ? `${original.slice(0, idx + marker.length)}\n${section}${original.slice(idx + marker.length)}`
    : `${original}\n${section}`;

fs.writeFileSync(changelogPath, updated);
console.log(`Updated ${changelogPath} with ${heading}`);
NODE

if git diff --quiet -- package.json CHANGELOG.md; then
  echo "ℹ️ No version/changelog changes detected; nothing to commit."
else
  echo "📦 Committing release metadata changes..."
  git add package.json CHANGELOG.md
  git commit -m "chore(release): update version and changelog for ${TAG} [skip ci]"
fi

echo "🚀 Pushing main..."
git push origin main

HEAD_SHA="$(git rev-parse HEAD)"
echo "🔎 Waiting for required workflows on ${HEAD_SHA}..."

wait_for_workflow_success() {
  local workflow_name="$1"
  local timeout_seconds="${2:-3600}"
  local poll_seconds="${3:-15}"
  local start
  start="$(date +%s)"

  local workflow_id
  workflow_id="$(gh api "/repos/${REPO}/actions/workflows" --jq ".workflows[] | select(.name == \"${workflow_name}\") | .id" | head -n1)"

  if [[ -z "$workflow_id" ]]; then
    echo "❌ Required workflow '${workflow_name}' not found in ${REPO}."
    exit 1
  fi

  while true; do
    local status
    local conclusion
    local run_url

    status="$(gh api "/repos/${REPO}/actions/workflows/${workflow_id}/runs?branch=main&head_sha=${HEAD_SHA}&per_page=1" --jq '.workflow_runs[0].status // ""')"
    conclusion="$(gh api "/repos/${REPO}/actions/workflows/${workflow_id}/runs?branch=main&head_sha=${HEAD_SHA}&per_page=1" --jq '.workflow_runs[0].conclusion // ""')"
    run_url="$(gh api "/repos/${REPO}/actions/workflows/${workflow_id}/runs?branch=main&head_sha=${HEAD_SHA}&per_page=1" --jq '.workflow_runs[0].html_url // ""')"

    if [[ -z "$status" ]]; then
      echo "⏳ ${workflow_name}: no run yet for ${HEAD_SHA}; waiting..."
    elif [[ "$status" != "completed" ]]; then
      echo "⏳ ${workflow_name}: status=${status}; waiting..."
    else
      if [[ "$conclusion" == "success" ]]; then
        echo "✅ ${workflow_name}: passed"
        return 0
      fi
      echo "❌ ${workflow_name}: conclusion=${conclusion}"
      if [[ -n "$run_url" ]]; then
        echo "   Run: $run_url"
      fi
      return 1
    fi

    local now
    now="$(date +%s)"
    if (( now - start > timeout_seconds )); then
      echo "❌ Timed out waiting for '${workflow_name}' (${timeout_seconds}s)."
      return 1
    fi

    sleep "$poll_seconds"
  done
}

wait_for_workflow_success "CI"
wait_for_workflow_success "Remote Compatibility Tests"

echo "🏷️ Pushing tag ${TAG}..."
git tag "$TAG" "$HEAD_SHA"
git push origin "$TAG"

echo "✅ Deploy complete: ${TAG} -> ${HEAD_SHA}"
