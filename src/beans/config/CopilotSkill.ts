import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export const COPILOT_SKILL_RELATIVE_PATH = path.join('.github', 'skills', 'beans', 'SKILL.md');

export function buildBeansCopilotSkill(primeOutput: string): string {
  const normalizedPrime = primeOutput.trim();

  return `---
name: beans
description: Use for Beans issue tracker workflows in this workspace: planning and decomposing epics, listing issues, finding top priority or stale work, drafting create/update actions, and suggesting issue-related commit workflows.
---

# Beans Skill

Follow Beans-first workflows in this repository.

## Use Beans as source of truth

- Read and update issue state through Beans CLI/extension workflows.
- Prefer structured operations over ad-hoc file edits.
- Keep status, type, priority, parent, and blocking links consistent.

## Recommended workflow

1. Read current state before mutating.
2. Propose focused issue updates.
3. Apply updates with explicit user intent.
4. Summarize resulting state and suggested next actions.

## Planning mode: map and create epic issues

When a person asks to plan an epic, use this sequence:

1. Confirm the epic goal, constraints, and definition of done.
2. Propose a short issue map grouped by outcomes (for example: foundation, implementation, validation, docs).
3. For each proposed child issue, include:
  - concise title
  - type (task/feature/bug)
  - status (usually todo)
  - priority
  - rationale and dependencies
4. Ask for a quick approval pass before creating issues.
5. Create approved issues and link them to the epic via parent relationships.
6. Report created issue IDs and suggest the best first issue to start.

### Planning output format

Use a compact checklist for approval before creation:

- [ ] <title> — type=<type>, priority=<priority>, depends_on=<ids or none>

After approval, create issues and reply with:

- Created: \`<issue-id>\` <title>
- Parent: \`<epic-id>\`
- Suggested first issue: \`<issue-id>\`

## VS Code command surface

- \`beans.view\`, \`beans.create\`, \`beans.edit\`
- \`beans.setStatus\`, \`beans.setType\`, \`beans.setPriority\`
- \`beans.setParent\`, \`beans.removeParent\`, \`beans.editBlocking\`
- \`beans.search\`, \`beans.filter\`, \`beans.sort\`, \`beans.refresh\`

## Beans CLI baseline (from \`beans prime\`)

\`\`\`text
${normalizedPrime}
\`\`\`
`;
}

export async function writeBeansCopilotSkill(workspaceRoot: string, content: string): Promise<string> {
  const absolutePath = path.join(workspaceRoot, COPILOT_SKILL_RELATIVE_PATH);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, 'utf8');
  return absolutePath;
}

export async function removeBeansCopilotSkill(workspaceRoot: string): Promise<void> {
  const absolutePath = path.join(workspaceRoot, COPILOT_SKILL_RELATIVE_PATH);
  await fs.rm(absolutePath, { force: true });
}
