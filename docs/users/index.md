---
title: User's guide
---

## Core features

### Sidebar Layout

The Beans sidebar contains seven panels:

- **Drafts** - Beans in draft status, needing refinement
- **Open Beans** - Active beans (todo and in-progress)
- **Completed** - Successfully finished beans
- **Scrapped** - Abandoned beans
- **Search** - Full-text search results with context menus
- **Details** - Rich webview showing the selected bean's content, properties, and relationships
- **Help** - Quick access to documentation, output channel, and settings

On first launch, the sidebar defaults are tuned to prioritize active work. After first use, VS Code persists your panel expand/collapse state and sizing, so you can resize panes once and keep your preferred layout.

You can toggle item counts in panel headers via the `beans.view.showCounts` setting.

### Hierarchical Organization

Create structured workflows with parent-child relationships:

```text
Milestone: v1.0 Release
└── Epic: User Authentication
    ├── Feature: Login flow
    │   ├── Task: Design login UI
    │   └── Task: Implement JWT tokens
    └── Feature: Password reset
```

**Drag & Drop**: Drag a child bean onto a parent to create the relationship.

### Status Workflow

Beans flow through statuses:

```text
draft → todo → in-progress → completed
                ↓
            scrapped
```

- **draft**: Needs refinement
- **todo**: Ready to start
- **in-progress**: Being worked on
- **completed**: Done
- **scrapped**: Won't do

### Dependency Tracking

Mark beans as blocking others:

```text
Bean A: "Set up database" (blocking → Bean B)
Bean B: "Implement login" (blocked-by ← Bean A)
```

Use "Edit Blocking Relationships" to manage dependencies.

### Details View

Click any bean in the sidebar to open its Details panel. The Details view provides:

- **Rendered markdown** body with full formatting support
- **Interactive checklists** - Click checkboxes to toggle completion directly in the view; changes persist to the bean file
- **Editable properties** - Status, type, priority displayed as actionable elements
- **Relationship navigation** - Click parent beans, children, or blocking relationships to navigate between beans
- **Browsing history** - Use the back button to return to previously viewed beans
- **Live updates** - File watcher detects external edits and refreshes the view

### Copilot Start Work

From the Details view, click the chat icon to launch a Copilot-assisted workflow for the selected bean. Choose from six templates:

- **Assess current status** - Get Copilot's analysis of the bean's progress
- **Determine remaining steps** - Ask Copilot what work remains
- **Close and commit** - Get guidance on completing and committing the bean
- **Export to GitHub issue** - Draft a GitHub issue from the bean's content
- **Set in-progress** - Mark the bean as in-progress with Copilot assistance
- **Flesh out specs** - Have Copilot help expand the bean's description and requirements

### File Watching

The extension automatically watches the `.beans/` directory for changes and refreshes tree views when files change. This detects edits from the CLI, other editors, or git operations.

The debounce interval is configurable via `beans.fileWatcher.debounceMs` (default: 20 seconds).

### Malformed Bean Detection

If Beans detects malformed files (indicated by `.fixme` files), a warning icon appears in the Drafts pane title bar. Click it to navigate directly to the first malformed bean for correction.

### Filtering and Search

- **Filter by Status**: Show only specific statuses
- **Filter by Type**: Show only bugs, features, etc.
- **Filter by Tag**: Custom tag filtering
- **Full-Text Search**: Search across titles and bodies
- **Sort Modes**: By status, priority, updated date, created date, or ID
