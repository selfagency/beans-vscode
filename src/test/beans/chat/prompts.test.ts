import { describe, expect, it } from 'vitest';
import { buildBeansChatSystemPrompt } from '../../../beans/chat/prompts';

describe('buildBeansChatSystemPrompt', () => {
  it('includes beans-only scope guardrails and command context', () => {
    const prompt = buildBeansChatSystemPrompt('summary', [
      {
        id: 'bean-1234',
        title: 'Implement chat integration',
        status: 'in-progress',
        type: 'task',
        priority: 'high',
      } as any,
    ]);

    expect(prompt).toContain('Only help with Beans issue-tracker workflows');
    expect(prompt).toContain('Requested slash command: summary');
    expect(prompt).toContain('bean-1234');
    expect(prompt).toContain('Implement chat integration');
  });
});
