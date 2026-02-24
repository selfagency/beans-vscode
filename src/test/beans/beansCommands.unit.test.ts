import { beforeEach, describe, expect, it } from 'vitest';
import { BeansCommands } from '../../beans/commands/BeansCommands';

class MockService {
  async listBeans() {
    return [
      { id: '1', code: 'B-1', title: 'One', status: 'todo', type: 'feature', updatedAt: new Date().toISOString() },
      { id: '2', code: 'B-2', title: 'Two', status: 'in-progress', type: 'bug', updatedAt: new Date().toISOString() },
    ];
  }
  async getConfig() {
    return { statuses: ['todo', 'in-progress', 'completed', 'scrapped', 'draft'], types: ['feature', 'bug'] };
  }
  async showBean(id: string) {
    return { id, code: 'B-1', title: 'One', status: 'todo', type: 'feature' };
  }
  async updateBean() {}
  async createBean(payload: any) {
    return { id: '3', code: 'B-3', title: payload.title };
  }
  async deleteBean() {}
  async graphqlSchema() {
    return 'schema {}';
  }
}

describe('BeansCommands basic helpers', () => {
  let commands: BeansCommands;
  const mockContext: any = { subscriptions: [] };

  beforeEach(() => {
    const svc = new MockService() as any;
    const cfgMgr: any = { open: async () => {} };
    const fm: any = { getFilter: () => ({}), setFilter: () => {}, showFilterUI: async () => undefined };
    commands = new BeansCommands(svc, mockContext, fm, cfgMgr, undefined);
  });

  it('typeIcon returns expected codicons', () => {
    const fn = (commands as any).typeIcon.bind(commands);
    expect(fn('milestone')).toBe('$(milestone)');
    expect(fn('epic')).toBe('$(zap)');
    expect(fn('feature')).toBe('$(lightbulb)');
    expect(fn('bug')).toBe('$(bug)');
    expect(fn('task')).toBe('$(list-unordered)');
  });

  it('beanPickerIcon prefers play-circle when in-progress', () => {
    const bean = { status: 'in-progress', type: 'feature' };
    const fn = (commands as any).beanPickerIcon.bind(commands);
    expect(fn(bean)).toBe('$(play-circle)');
    const bean2 = { status: 'todo', type: 'bug' };
    expect(fn(bean2)).toBe('$(bug)');
  });

  it('buildCopilotBeanContext contains expected lines', () => {
    const bean = {
      id: 'x',
      code: 'C-1',
      title: 'T',
      status: 'todo',
      type: 'feature',
      priority: 'normal',
      parent: undefined,
      tags: ['a'],
      blocking: [],
      blockedBy: [],
      body: 'desc',
    };
    const ctx = (commands as any).buildCopilotBeanContext(bean);
    expect(ctx).toContain('Bean ID: x');
    expect(ctx).toContain('Code: C-1');
    expect(ctx).toContain('Description / notes:');
  });

  it('buildCopilotPromptTemplates returns templates', () => {
    const bean = {
      id: 'x',
      code: 'C-1',
      title: 'T',
      status: 'todo',
      type: 'feature',
      priority: 'normal',
      parent: undefined,
      tags: [],
      blocking: [],
      blockedBy: [],
      body: '',
    };
    const templates = (commands as any).buildCopilotPromptTemplates(bean);
    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBeGreaterThan(0);
    expect(templates[0]).toHaveProperty('prompt');
  });
});
