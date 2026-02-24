chore(beans): enforce branch+bean usage for agents in copilot templates

This change updates the Copilot instruction and skill templates to require that agents:

- create or switch to the issue branch before making edits
- maintain progress in the bean's `## Todo` checklist (no internal agent todo)
- always use the MCP or extension APIs for bean creation/edits and only set `branch` and `pr` frontmatter keys

Files changed:
- src/beans/config/templates/copilot-instructions.template.md
- src/beans/config/templates/copilot-skill.template.md

Bean: beans-vscode-kcff

