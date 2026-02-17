import { describe, expect, it } from 'vitest';
import { buildBeansChatSystemPrompt } from '../../../beans/chat/prompts';
import type { Bean } from '../../../beans/model';

describe('Chat Prompt Assembly', () => {
  describe('buildBeansChatSystemPrompt', () => {
    it('should include Beans-only scope guardrails', () => {
      const prompt = buildBeansChatSystemPrompt(undefined, []);

      expect(prompt).toContain('Beans VS Code assistant');
      expect(prompt).toContain('Only help with Beans issue-tracker workflows');
      expect(prompt).toContain('Do not provide guidance unrelated to Beans operations');
    });

    it('should include command context when command is provided', () => {
      const prompt = buildBeansChatSystemPrompt('summary', []);

      expect(prompt).toContain('Requested slash command: summary');
    });

    it('should show "none" when no command is provided', () => {
      const prompt = buildBeansChatSystemPrompt(undefined, []);

      expect(prompt).toContain('Requested slash command: none');
    });

    it('should include bean context in prompt', () => {
      const beans: Bean[] = [
        {
          id: 'bean-1',
          title: 'Test Bean',
          status: 'todo',
          type: 'task',
          priority: 'high',
        } as Bean,
        {
          id: 'bean-2',
          title: 'Another Bean',
          status: 'in-progress',
          type: 'bug',
          priority: 'critical',
        } as Bean,
      ];

      const prompt = buildBeansChatSystemPrompt('summary', beans);

      expect(prompt).toContain('bean-1');
      expect(prompt).toContain('Test Bean');
      expect(prompt).toContain('status=todo');
      expect(prompt).toContain('type=task');
      expect(prompt).toContain('priority=high');

      expect(prompt).toContain('bean-2');
      expect(prompt).toContain('Another Bean');
      expect(prompt).toContain('status=in-progress');
      expect(prompt).toContain('type=bug');
      expect(prompt).toContain('priority=critical');
    });

    it('should handle beans without priority', () => {
      const beans: Bean[] = [
        {
          id: 'bean-1',
          title: 'No Priority Bean',
          status: 'todo',
          type: 'task',
        } as Bean,
      ];

      const prompt = buildBeansChatSystemPrompt(undefined, beans);

      expect(prompt).toContain('bean-1');
      expect(prompt).toContain('priority=normal'); // Should default to normal
    });

    it('should show placeholder when no beans are available', () => {
      const prompt = buildBeansChatSystemPrompt('summary', []);

      expect(prompt).toContain('(no beans available)');
    });

    it('should limit beans to MAX_BEANS_IN_CONTEXT', () => {
      const beans: Bean[] = Array.from({ length: 50 }, (_, i) => ({
        id: `bean-${i}`,
        title: `Bean ${i}`,
        status: 'todo',
        type: 'task',
        priority: 'normal',
      })) as Bean[];

      const prompt = buildBeansChatSystemPrompt(undefined, beans);

      // Should include first 40 beans (MAX_BEANS_IN_CONTEXT)
      expect(prompt).toContain('bean-0');
      expect(prompt).toContain('bean-39');

      // Should not include beans beyond limit
      expect(prompt).not.toContain('bean-40');
      expect(prompt).not.toContain('bean-49');
    });

    it('should list allowed bean operations', () => {
      const prompt = buildBeansChatSystemPrompt(undefined, []);

      expect(prompt).toContain('view/create/edit/status/type/priority/parent/blocking/delete/filter/search/sort');
    });

    it('should guide user to suggest Beans commands for out-of-scope requests', () => {
      const prompt = buildBeansChatSystemPrompt(undefined, []);

      expect(prompt).toContain('If the user asks for actions outside Beans scope');
      expect(prompt).toContain('clearly say this participant is scoped to Beans workflows');
      expect(prompt).toContain('suggest a relevant Beans command');
    });
  });
});
