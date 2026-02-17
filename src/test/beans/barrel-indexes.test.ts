import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', async () => {
  return await import('../mocks/vscode.js');
});

describe('Beans barrel exports', () => {
  it('exports chat module symbols', async () => {
    const mod = await import('../../beans/chat/index.js');
    expect(mod.BeansChatIntegration).toBeDefined();
    expect(mod.buildBeansChatSystemPrompt).toBeTypeOf('function');
  });

  it('exports config module symbols', async () => {
    const mod = await import('../../beans/config/index.js');
    expect(mod.BeansConfigManager).toBeDefined();
    expect(mod.buildBeansCopilotInstructions).toBeTypeOf('function');
    expect(mod.buildBeansCopilotSkill).toBeTypeOf('function');
  });

  it('exports commands module symbols', async () => {
    const mod = await import('../../beans/commands/index.js');
    expect(mod.BeansCommands).toBeDefined();
  });

  it('exports details/preview/search symbols', async () => {
    const details = await import('../../beans/details/index.js');
    const preview = await import('../../beans/preview/index.js');
    const search = await import('../../beans/search/index.js');

    expect(details.BeansDetailsViewProvider).toBeDefined();
    expect(preview.BeansPreviewProvider).toBeDefined();
    expect(search.BeansSearchViewProvider).toBeDefined();
  });

  it('exports logging/service/mcp symbols', async () => {
    const logging = await import('../../beans/logging/index.js');
    const service = await import('../../beans/service/index.js');
    const mcp = await import('../../beans/mcp/index.js');

    expect(logging.BeansOutput).toBeDefined();
    expect(service.BeansService).toBeDefined();
    expect(mcp.BeansMcpIntegration).toBeDefined();
  });

  it('exports tree and providers symbols', async () => {
    const tree = await import('../../beans/tree/index.js');
    const providers = await import('../../beans/tree/providers/index.js');

    expect(tree.BeanTreeItem).toBeDefined();
    expect(tree.BeansTreeDataProvider).toBeDefined();
    expect(tree.BeansDragAndDropController).toBeDefined();
    expect(tree.BeansFilterManager).toBeDefined();
    expect(providers.ActiveBeansProvider).toBeDefined();
    expect(providers.CompletedBeansProvider).toBeDefined();
    expect(providers.DraftBeansProvider).toBeDefined();
    expect(providers.ScrappedBeansProvider).toBeDefined();
  });

  it('exports model symbols', async () => {
    const model = await import('../../beans/model/index.js');
    const modelConfig = await import('../../beans/model/config.js');

    expect(model.BEAN_STATUSES).toBeDefined();
    expect(model.BEAN_TYPES).toBeDefined();
    expect(model.BEAN_PRIORITIES).toBeDefined();
    expect(model.isBeansError).toBeTypeOf('function');
    expect(model.getUserMessage).toBeTypeOf('function');
    expect(modelConfig).toBeDefined();
  });
});
