import { describe, it, expect } from 'vitest';
import { BeansTreeDataProvider } from '../../../../src/beans/tree/BeansTreeDataProvider';
import { BeansSearchTreeProvider } from '../../../../src/beans/search/BeansSearchTreeProvider';

const fakeService = {
  listBeans: async () => [],
} as any;

describe('Tree provider dispose safety', () => {
  it('does not throw when EventEmitter.dispose throws in BeansTreeDataProvider', () => {
    const provider = new BeansTreeDataProvider(fakeService, undefined, true);
    // replace private emitter with one that throws
    (provider as any)._onDidChangeTreeData = {
      dispose: () => {
        throw new Error('boom');
      },
    };
    expect(() => provider.dispose()).not.toThrow();
  });

  it('does not throw when EventEmitter.dispose throws in BeansSearchTreeProvider', () => {
    const searchProvider = new BeansSearchTreeProvider(fakeService);
    (searchProvider as any)._onDidChangeTreeData = {
      dispose: () => {
        throw new Error('boom');
      },
    };
    expect(() => searchProvider.dispose()).not.toThrow();
  });
});
