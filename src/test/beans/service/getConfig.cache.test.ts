import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BeansService } from '../../../../src/beans/service/BeansService';

// Mock the BeansConfigManager so we can observe constructor calls and read calls
const instances: { count: number } = { count: 0 };

vi.mock('../../../../src/beans/config', () => {
  class MockBeansConfigManager {
    constructor(_workspaceRoot: string) {
      instances.count += 1;
    }
    async read() {
      return {
        path: '.beans',
        prefix: 'bean',
        id_length: 4,
        default_status: 'draft',
        default_type: 'task',
        statuses: ['todo'],
        types: ['task'],
        priorities: ['high'],
      };
    }
  }

  return { BeansConfigManager: MockBeansConfigManager };
});

describe('BeansService.getConfig caching', () => {
  beforeEach(() => {
    instances.count = 0;
    vi.clearAllMocks();
  });

  it('constructs BeansConfigManager once and caches parsed config within TTL', async () => {
    const svc = new BeansService('/tmp/workspace');

    // Call getConfig twice in quick succession
    const a = await svc.getConfig();
    const b = await svc.getConfig();

    expect(a.path).toBe('.beans');
    expect(b.path).toBe('.beans');

    // Desired behaviour: only one BeansConfigManager constructed for the service
    expect(instances.count).toBe(1);
  });
});
