import { describe, expect, it } from 'vitest';
import { buildBeansCopilotInstructions } from '../../../beans/config';

describe('buildBeansCopilotInstructions', () => {
  it('generates extension-first instructions with planning mode and CLI fallback', () => {
    const content = buildBeansCopilotInstructions('beans prime output');

    expect(content).toContain('<EXTREMELY_IMPORTANT>');
    expect(content).toContain('# Beans Task Management Rules');
    expect(content).toContain('# Beans Usage Guide for Agents (Extension-First)');
    expect(content).toContain('## Interface priority (highest → lowest)');
    expect(content).toContain('## Planning mode for epic decomposition');
    expect(content).toContain('## CLI fallback (only when extension/chat/MCP are unavailable)');
    expect(content).toContain('beans prime output');
  });
});
