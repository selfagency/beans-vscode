---
# beans-vscode-2mfl
title: Use git history to recover missing fields in tryRepairMalformedBean
status: ""
type: feature
priority: "3"
created_at: 2026-02-19T19:56:39Z
updated_at: 2026-02-19T19:56:39Z
---

## Overview

`tryRepairMalformedBean()` currently tries to infer missing required fields (`id`, `title`, `status`, `type`) from the filename and workspace config defaults. It should also check git history for the file — if a previous committed version of the bean had those fields set, they can be recovered from there instead of guessing.

## Proposed approach

1. Run `git log --follow -n 1 -- <bean-file-path>` (via `execFile` argument array, no shell interpolation) to get the most recent commit SHA that touched the file.
2. Run `git show <sha>:<relative-path>` to retrieve the file content at that commit.
3. Parse the YAML frontmatter from the historical content and extract any fields that are missing from the current version.
4. Merge recovered fields into the repair payload before falling back to inferred/default values.
5. Fail gracefully if git is unavailable or the file has no history (not all workspaces use git).

## Security

- Use `execFile` with an argument array — never interpolate file paths into a shell string.
- Validate that the recovered values meet the expected types/formats before using them.

## Todo

- [ ] Implement `recoverFieldsFromGitHistory(filePath: string): Promise<Partial<RawBeanFromCLI>>`
- [ ] Call it inside `tryRepairMalformedBean` before falling back to path-derived inference
- [ ] Handle no-git / no-history gracefully (resolve with `{}`)
- [ ] Add unit tests covering: successful recovery, no git repo, file not in history, corrupt historical frontmatter
