---
title: Keyboard shortcuts
---

The extension does not define default shortcuts to avoid conflicts. You can configure custom keybindings:

## Setting Up Custom Keybindings

1. Open Keyboard Shortcuts: `Cmd+K Cmd+S` / `Ctrl+K Ctrl+S`
2. Search for command (e.g., "Beans: Create Bean")
3. Click `+` to add binding

## Recommended Keybindings

Add to your `keybindings.json`:

```json
[
  {
    "key": "cmd+shift+b c",
    "command": "beans.create",
    "when": "beans.initialized"
  },
  {
    "key": "cmd+shift+b v",
    "command": "beans.view",
    "when": "beans.initialized"
  },
  {
    "key": "cmd+shift+b r",
    "command": "beans.refresh",
    "when": "beans.initialized"
  },
  {
    "key": "cmd+shift+b s",
    "command": "beans.search",
    "when": "beans.initialized"
  }
]
```
