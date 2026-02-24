---
# beans-vscode-30em
title: bean init still fails
status: in-progress
type: bug
priority: normal
created_at: 2026-02-24T02:08:49Z
updated_at: 2026-02-24T03:03:14Z
---

there is a conflict between "don't load unless there's a beans.yml" and "initialize if there's no beans.yml" -- it should ask to initialize if the yaml doesn't exist and if yes, load the full extension. if not, never bother them again about beans in that project.
