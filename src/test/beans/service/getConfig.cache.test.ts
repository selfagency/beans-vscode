import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BeansService } from '../../../../src/beans/service/BeansService';

// Mock the BeansConfigManager so we can observe constructor calls and read calls
const instances: { count: number } = { count: 0 };
const readCalls: { count: number } = { count: 0 };

// Mutable read implementation so individual tests can override it
let mockReadImpl: () => Promise<object | null> = async () => ({
  path: '.beans',
  prefix: 'bean',
  id_length: 4,
  default_status: 'draft',
  default_type: 'task',
  statuses: ['todo'],
  types: ['task'],
  priorities: ['high'],
});

vi.mock('../../../../src/beans/config', () => {
  class MockBeansConfigManager {
    constructor(_workspaceRoot: string) {
      instances.count += 1;
    }
    async read() {
      readCalls.count += 1;
      return mockReadImpl();
    }
  }

  return { BeansConfigManager: MockBeansConfigManager };
});

describe('BeansService.getConfig caching', () => {
  beforeEach(() => {
    instances.count = 0;
    readCalls.count = 0;
    vi.clearAllMocks();
    // Restore default read implementation
    mockReadImpl = async () => ({
      path: '.beans',
      prefix: 'bean',
      id_length: 4,
      default_status: 'draft',
      default_type: 'task',
      statuses: ['todo'],
      types: ['task'],
      priorities: ['high'],
    });
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
    // read() should only be invoked once; second call returns cached value
    expect(readCalls.count).toBe(1);
  });

  it('deduplicates concurrent getConfig() calls — read() invoked only once for in-flight batch', async () => {
    const svc = new BeansService('/tmp/workspace');

    // Fire three calls simultaneously before any resolves.
    // The first sets configRefreshPromise; the other two share it.
    const [a, b, c] = await Promise.all([svc.getConfig(), svc.getConfig(), svc.getConfig()]);

    expect(a.path).toBe('.beans');
    expect(b.path).toBe('.beans');
    expect(c.path).toBe('.beans');

    // All three callers shared a single I/O round-trip
    expect(readCalls.count).toBe(1);
  });

  it('clears configRefreshPromise after successful read so next expiry triggers a fresh read', async () => {
    vi.useFakeTimers();
    try {
      const svc = new BeansService('/tmp/workspace');

      // Warm the cache
      await svc.getConfig();
      expect(readCalls.count).toBe(1);

      // Advance past the 60 s TTL
      vi.advanceTimersByTime(61_000);

      // Next call should trigger a fresh read (promise was cleared after first batch)
      await svc.getConfig();
      expect(readCalls.count).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears configRefreshPromise after a failed read so the next call retries', async () => {
    const svc = new BeansService('/tmp/workspace');

    // First call: read() rejects → getConfig() rejects
    mockReadImpl = async () => {
      throw new Error('disk error');
    };
    await expect(svc.getConfig()).rejects.toThrow('disk error');
    expect(readCalls.count).toBe(1);

    // Restore healthy read(). Since the failed call never populated the cache,
    // no TTL manipulation is needed — the next call should trigger a fresh read.
    // If configRefreshPromise had NOT been cleared by the finally block, the second
    // call would re-use the already-rejected promise and never call read() again.
    mockReadImpl = async () => ({
      path: '.beans-custom',
      prefix: 'bean',
      id_length: 4,
      default_status: 'draft',
      default_type: 'task',
      statuses: ['todo'],
      types: ['task'],
      priorities: ['high'],
    });

    const second = await svc.getConfig();
    // A second read() was attempted — proves configRefreshPromise was cleared after failure
    expect(readCalls.count).toBe(2);
    expect(second.path).toBe('.beans-custom');
  });
});
