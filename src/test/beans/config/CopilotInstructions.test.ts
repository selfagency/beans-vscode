import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildBeansCopilotInstructions,
  COPILOT_INSTRUCTIONS_RELATIVE_PATH,
  writeBeansCopilotInstructions,
} from '../../../beans/config';

vi.mock('node:fs/promises');

describe('buildBeansCopilotInstructions', () => {
  it('generates extension-first instructions with planning mode and CLI fallback', () => {
    const content = buildBeansCopilotInstructions('');

    expect(content).toContain('<CRITICALLY_IMPORTANT>');
    expect(content).toContain('# Beans Task Management Rules');
    expect(content).toContain('# Beans Usage Guide for Agents (Extension-First)');
    expect(content).toContain('## Interface priority (highest → lowest)');
    expect(content).toContain('## Planning mode for epic decomposition');
    expect(content).toContain('## CLI fallback (only when extension, chat, and MCP are all unavailable)');
    expect(content).toContain('If the issue does not already have a branch, create one when you begin work');
    expect(content).toContain('If you are resuming work, checkout the existing branch for that issue first');
    expect(content).toContain('Branch names must follow: `[type]/[issue-number-without-prefix]-[short-title]`');
    expect(content).toContain('Examples: `feat/1234-add-search`, `fix/987-crash-on-init`');
    expect(content).toContain('Push the branch and record it in the bean frontmatter as soon as it exists');
  });
});

describe('writeBeansCopilotInstructions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes instructions to the expected location', async () => {
    const mkdirSpy = vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue();

    const result = await writeBeansCopilotInstructions('/workspace', 'instructions');
    const expectedPath = path.join('/workspace', COPILOT_INSTRUCTIONS_RELATIVE_PATH);

    expect(result).toBe(expectedPath);
    expect(mkdirSpy).toHaveBeenCalledWith(path.dirname(expectedPath), { recursive: true });
    expect(writeFileSpy).toHaveBeenCalledWith(expectedPath, 'instructions', 'utf8');
  });
});
