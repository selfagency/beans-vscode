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

GH_BIN=""

if command -v gh >/dev/null 2>&1; then
  GH_BIN="$(command -v gh)"
elif command -v gh.exe >/dev/null 2>&1; then
  GH_BIN="$(command -v gh.exe)"
elif [[ "${OS:-}" == "Windows_NT" ]] && command -v where.exe >/dev/null 2>&1; then
  GH_BIN="$(where.exe gh 2>/dev/null | tr -d '\r' | head -n1 || true)"
fi

if [[ -z "$GH_BIN" ]]; then
  echo "❌ GitHub CLI (gh) is required and was not found in this Bash environment PATH."
  echo "   Tip (Windows + Git Bash): ensure GitHub CLI is installed and available to Git Bash PATH, or run from a shell where 'gh' resolves."
  exit 1
fi

# On Windows Git Bash, HOME is often /home/<user> and APPDATA may be unset.
# gh.exe then fails to find existing auth from Windows profile. Bridge GH_CONFIG_DIR.
if [[ -z "${GH_CONFIG_DIR:-}" ]]; then
  APPDATA_WIN="${APPDATA:-}"

  if [[ -n "$APPDATA_WIN" ]]; then
    if command -v cygpath >/dev/null 2>&1; then
      APPDATA_UNIX="$(cygpath -u "$APPDATA_WIN" 2>/dev/null || true)"
      if [[ -n "$APPDATA_UNIX" ]]; then
        export GH_CONFIG_DIR="$APPDATA_UNIX/GitHub CLI"
      fi
    fi

    if [[ -z "${GH_CONFIG_DIR:-}" ]]; then
      export GH_CONFIG_DIR="${APPDATA_WIN}\\GitHub CLI"
    fi
  fi
fi

if [[ -z "${GH_CONFIG_DIR:-}" ]]; then
  for hosts_file in \
    /mnt/c/Users/*/AppData/Roaming/'GitHub CLI'/hosts.yml \
    /c/Users/*/AppData/Roaming/'GitHub CLI'/hosts.yml; do
    if [[ -f "$hosts_file" ]]; then
      export GH_CONFIG_DIR="$(dirname "$hosts_file")"
      break
    fi
  done
fi

GIT_BIN=""

if command -v git >/dev/null 2>&1; then
  GIT_BIN="$(command -v git)"
elif command -v git.exe >/dev/null 2>&1; then
  GIT_BIN="$(command -v git.exe)"
elif [[ "${OS:-}" == "Windows_NT" ]] && command -v where.exe >/dev/null 2>&1; then
  GIT_BIN="$(where.exe git 2>/dev/null | tr -d '\r' | head -n1 || true)"
fi

if [[ -z "$GIT_BIN" ]]; then
  echo "❌ Git CLI is required and was not found in this Bash environment PATH."
  echo "   Tip (Windows + Git Bash): install Git for Windows and ensure git.exe is available to Git Bash PATH."
  exit 1
fi

if ! "$GH_BIN" auth status >/dev/null 2>&1; then
  if [[ -n "${GH_TOKEN:-}" || -n "${GITHUB_TOKEN:-}" ]]; then
    echo "ℹ️ gh auth status failed in this shell, but GH_TOKEN/GITHUB_TOKEN is set; continuing with token auth."
  elif "$GH_BIN" api user --jq '.login' >/dev/null 2>&1; then
    echo "ℹ️ gh auth status failed in this shell, but API auth succeeded; continuing."
  else
    # Windows Git Bash fallback: pull token from PowerShell gh session if available.
    if command -v powershell.exe >/dev/null 2>&1; then
      PS_GH_TOKEN="$(powershell.exe -NoProfile -Command "gh auth token 2>\$null" 2>/dev/null | tr -d '\r' | tail -n1 || true)"
      if [[ -n "$PS_GH_TOKEN" ]]; then
        export GH_TOKEN="$PS_GH_TOKEN"
        if "$GH_BIN" api user --jq '.login' >/dev/null 2>&1; then
          echo "ℹ️ Loaded GH_TOKEN from PowerShell gh auth token; continuing."
        else
          echo "❌ Retrieved token from PowerShell, but GitHub API auth still failed in this Bash environment."
          exit 1
        fi
      else
        echo "❌ GitHub CLI is not authenticated in this Bash environment."
        echo "   Run: gh auth login"
        echo "   Or set GH_TOKEN (or GITHUB_TOKEN) before running release."
        exit 1
      fi
    else
      echo "❌ GitHub CLI is not authenticated in this Bash environment."
      echo "   Run: gh auth login"
      echo "   Or set GH_TOKEN (or GITHUB_TOKEN) before running release."
      exit 1
    fi
  fi
fi

if [[ -n "$("$GIT_BIN" status --porcelain)" ]]; then
  echo "❌ Working tree is not clean. Commit or stash changes first."
  exit 1
fi

CURRENT_BRANCH="$("$GIT_BIN" rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "❌ This script must run from 'main'. Current branch: $CURRENT_BRANCH"
  exit 1
fi

echo "🔄 Fetching latest refs..."
"$GIT_BIN" fetch origin main

echo "🔄 Fast-forwarding local main..."
"$GIT_BIN" pull --ff-only origin main

if "$GIT_BIN" rev-parse -q --verify "refs/tags/${TAG}" >/dev/null 2>&1; then
  echo "❌ Local tag ${TAG} already exists."
  exit 1
fi

if "$GIT_BIN" ls-remote --exit-code --tags origin "refs/tags/${TAG}" >/dev/null 2>&1; then
  echo "❌ Remote tag ${TAG} already exists."
  exit 1
fi

REPO="$("$GH_BIN" repo view --json nameWithOwner --jq '.nameWithOwner')"
PREVIOUS_TAG="$("$GIT_BIN" ls-remote --tags --refs origin 'refs/tags/v*' \
  | awk '{print $2}' \
  | sed 's#refs/tags/##' \
  | grep -Fxv "$TAG" \
  | sort -V \
  | tail -n1 || true)"

echo "📝 Generating release notes for ${TAG}..."
if [[ -n "$PREVIOUS_TAG" ]]; then
  RELEASE_NOTES="$("$GH_BIN" api \
    --method POST \
    "/repos/${REPO}/releases/generate-notes" \
    -f tag_name="$TAG" \
    -f target_commitish="main" \
    -f previous_tag_name="$PREVIOUS_TAG" \
    --jq '.body // ""')"
else
  RELEASE_NOTES="$("$GH_BIN" api \
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

if "$GIT_BIN" diff --quiet -- package.json CHANGELOG.md; then
  echo "ℹ️ No version/changelog changes detected; nothing to commit."
else
  echo "📦 Committing release metadata changes..."
  "$GIT_BIN" add package.json CHANGELOG.md
  "$GIT_BIN" commit -m "chore(release): update version and changelog for ${TAG} [skip ci]"
fi

echo "🚀 Pushing main..."
"$GIT_BIN" push origin main

HEAD_SHA="$("$GIT_BIN" rev-parse HEAD)"
echo "🔎 Waiting for required workflows on ${HEAD_SHA}..."

wait_for_workflow_success() {
  local workflow_name="$1"
  local timeout_seconds="${2:-3600}"
  local poll_seconds="${3:-15}"
  local start
  start="$(date +%s)"

  local workflow_id
  workflow_id="$("$GH_BIN" api "/repos/${REPO}/actions/workflows" --jq ".workflows[] | select(.name == \"${workflow_name}\") | .id" | head -n1)"

  if [[ -z "$workflow_id" ]]; then
    echo "❌ Required workflow '${workflow_name}' not found in ${REPO}."
    exit 1
  fi

  local triggered=false

  while true; do
    local status conclusion run_url run_info

    run_info="$("$GH_BIN" api "/repos/${REPO}/actions/workflows/${workflow_id}/runs?branch=main&head_sha=${HEAD_SHA}&per_page=5" --jq '.workflow_runs[0] | "\(.status // "") \(.conclusion // "") \(.html_url // "")"')"
    read -r status conclusion run_url <<<"$run_info"

    if [[ -z "$status" ]]; then
      if [[ "$triggered" == "false" ]]; then
        local remote_main_sha
        remote_main_sha="$("$GIT_BIN" ls-remote --heads origin main 2>/dev/null | awk '{print $1}' | head -n1 || true)"
        if [[ -z "$remote_main_sha" ]]; then
          echo "❌ Unable to determine remote HEAD for origin/main."
          exit 1
        fi
        if [[ "$remote_main_sha" != "$HEAD_SHA" ]]; then
          echo "❌ ${workflow_name}: HEAD_SHA (${HEAD_SHA}) is no longer the latest commit on main (remote is ${remote_main_sha})."
          echo "   Aborting to avoid triggering workflow_dispatch against the wrong commit. Please re-run release against the latest main."
          exit 1
        fi
        echo "⚡ ${workflow_name}: no run found for ${HEAD_SHA}; triggering via workflow_dispatch on main..."
        local dispatch_output
        if ! dispatch_output="$("$GH_BIN" api --method POST "/repos/${REPO}/actions/workflows/${workflow_id}/dispatches" \
          -f ref="main" 2>&1)"; then
          echo "⚠️  ${workflow_name}: failed to trigger workflow_dispatch on main:"
          echo "    $dispatch_output"
          return 1
        else
          echo "ℹ️  ${workflow_name}: workflow_dispatch triggered successfully."
          triggered=true
          echo "⏳ ${workflow_name}: triggered; waiting for run to appear..."
        fi
      else
        echo "⏳ ${workflow_name}: no run yet for ${HEAD_SHA}; waiting..."
      fi
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

# Run both workflow checks in parallel so we don't wait for CI to finish
# before starting to poll Remote Compatibility Tests.
ci_log="$(mktemp -t beans-ci.XXXXXX)"
compat_log="$(mktemp -t beans-compat.XXXXXX)"
trap 'rm -f "$ci_log" "$compat_log"' EXIT

echo "🔎 Waiting for required workflows in parallel..."

wait_for_workflow_success "CI" >"$ci_log" 2>&1 &
ci_pid=$!
wait_for_workflow_success "Remote Compatibility Tests" >"$compat_log" 2>&1 &
compat_pid=$!

# Stream prefixed output while both workers run (portable; works on Linux and macOS).
tail -n +1 -f "$ci_log"     | sed "s/^/[CI] /" &
ci_tail=$!
tail -n +1 -f "$compat_log" | sed "s/^/[Remote Compat] /" &
compat_tail=$!

ci_exit=0
compat_exit=0
wait "$ci_pid"     || ci_exit=$?
wait "$compat_pid" || compat_exit=$?

# Give tail a moment to flush remaining output, then stop it.
sleep 0.5
kill "$ci_tail" "$compat_tail" 2>/dev/null || true
wait "$ci_tail" "$compat_tail" 2>/dev/null || true

if (( ci_exit != 0 )) || (( compat_exit != 0 )); then
  echo "❌ One or more required workflows failed."
  exit 1
fi

echo "🏷️ Pushing tag ${TAG}..."
TAG_SUBJECT="Release ${TAG}"
TAG_BODY="${RELEASE_NOTES}"

if [[ -n "$PREVIOUS_TAG" ]]; then
  TAG_BODY+=$'\n\n'
  TAG_BODY+="Source: changes from ${PREVIOUS_TAG} to ${TAG}."
fi

TAG_BODY+=$'\n\n'
TAG_BODY+="Target commit: ${HEAD_SHA}"

"$GIT_BIN" tag -a "$TAG" "$HEAD_SHA" -m "$TAG_SUBJECT" -m "$TAG_BODY"
"$GIT_BIN" push origin "$TAG"

echo "✅ Deploy complete: ${TAG} -> ${HEAD_SHA}"
