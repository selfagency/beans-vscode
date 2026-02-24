---
# beans-vscode-hvhr
title: beans failed to initialize
status: completed
type: bug
priority: normal
created_at: 2026-02-23T17:09:08Z
updated_at: 2026-02-24T02:39:37Z
---

2026-02-23 12:08:21.643 [info] [2026-02-23T17:08:21.643Z] [INFO] No .beans marker directory or .beans.yml file found; prompting before initialization 2026-02-23 12:08:24.154 [info] [2026-02-23T17:08:24.154Z] [ERROR] Failed to initialize Beans: Failed to parse beans CLI JSON output 2026-02-23 12:08:24.155 [info]   N: Failed to parse beans CLI JSON output     at /Users/daniel/.vscode/extensions/selfagency.beans-vscode-1.3.4/dist/extension.js:1300:2420     at processTicksAndRejections (node:internal/process/task_queues:105:5)     at t.withRetry (/Users/daniel/.vscode/extensions/selfagency.beans-vscode-1.3.4/dist/extension.js:1300:1200)     at /Users/daniel/.vscode/extensions/selfagency.beans-vscode-1.3.4/dist/extension.js:1300:1982     at t.init (/Users/daniel/.vscode/extensions/selfagency.beans-vscode-1.3.4/dist/extension.js:1324:438)     at cs (/Users/daniel/.vscode/extensions/selfagency.beans-vscode-1.3.4/dist/extension.js:1339:21160)     at os (/Users/daniel/.vscode/extensions/selfagency.beans-vscode-1.3.4/dist/extension.js:1339:17570)     at mA.n (file:///Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/workbench/api/node/extensionHostProcess.js:116:13398)     at mA.m (file:///Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/workbench/api/node/extensionHostProcess.js:116:13361)     at mA.l (file:///Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/workbench/api/node/extensionHostProcess.js:116:12817)
