import { describe, expect, it } from 'vitest';
import { buildBeansCopilotSkill } from '../../../beans/config';

describe('buildBeansCopilotSkill', () => {
  it('creates compact skill content with required frontmatter fields and planning guidance', () => {
    const content = buildBeansCopilotSkill('beans prime output');

    expect(content).toContain('name: beans');
    expect(content).toContain('description: Use for Beans issue tracker workflows');
    expect(content).toContain('# Beans Skill');
    expect(content).toContain('## Planning mode: map and create epic issues');
    expect(content).toContain('### Planning output format');
    expect(content).toContain('beans prime output');
  });
});
