import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bean } from '../../../beans/model';
import { BeansSearchTreeProvider } from '../../../beans/search/BeansSearchTreeProvider';
import { BeansService } from '../../../beans/service/BeansService';

// Mock vscode
vi.mock('vscode');

// Mock BeansService
vi.mock('../../../beans/service/BeansService');

// Mock BeansOutput
vi.mock('../../../beans/logging/BeansOutput', () => ({
  BeansOutput: {
    getInstance: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

function makeBean(id: string, title: string, status: string = 'todo'): Bean {
  return {
    id,
    code: id.toUpperCase(),
    slug: id,
    path: `.beans/${id}.md`,
    title,
    body: '',
    status: status as Bean['status'],
    type: 'task' as Bean['type'],
    priority: 'normal',
    tags: [],
    blocking: [],
    blockedBy: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    etag: `${id}-etag`,
    parent: undefined,
  };
}

describe('BeansSearchTreeProvider', () => {
  let service: BeansService;
  let provider: BeansSearchTreeProvider;
  let mockBeans: Bean[];

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BeansService('/mock/workspace');
    mockBeans = [];
    (service.listBeans as ReturnType<typeof vi.fn>) = vi.fn(async () => mockBeans);
    provider = new BeansSearchTreeProvider(service);
  });

  describe('refreshCount()', () => {
    it('returns 0 when no beans exist', async () => {
      mockBeans = [];
      const count = await provider.refreshCount();
      expect(count).toBe(0);
    });

    it('returns the correct count of fetched beans', async () => {
      mockBeans = [makeBean('a', 'Alpha'), makeBean('b', 'Beta'), makeBean('c', 'Gamma')];
      const count = await provider.refreshCount();
      expect(count).toBe(3);
    });

    it('updates internal state so getVisibleCount reflects the fetched count', async () => {
      mockBeans = [makeBean('x', 'X'), makeBean('y', 'Y')];
      expect(provider.getVisibleCount()).toBe(0);
      await provider.refreshCount();
      expect(provider.getVisibleCount()).toBe(2);
    });

    it('does not fire onDidChangeTreeData (no tree rebuild)', async () => {
      // Spy on the private emitter's fire method
      const emitter = (provider as any)._onDidChangeTreeData;
      const fireSpy = vi.spyOn(emitter, 'fire');
      mockBeans = [makeBean('z', 'Zeta')];
      await provider.refreshCount();
      expect(fireSpy).not.toHaveBeenCalled();
    });
  });
});
