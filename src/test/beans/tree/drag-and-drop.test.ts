import { describe, it, expect } from 'vitest';
import { BeansDragAndDropController } from '../../../../src/beans/tree/BeansDragAndDropController';
import type { Bean } from '../../../../src/beans/model/Bean';

describe('BeansDragAndDropController.isDescendantOf (cycle protection)', () => {
  it('returns true when potential ancestor is in parent chain', async () => {
    const beanA: Bean = {
      id: 'a',
      code: 'a',
      slug: 'a',
      path: '',
      title: 'A',
      body: '',
      status: 'todo',
      type: 'task',
      tags: [],
      blocking: [],
      blockedBy: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      etag: '1',
      parent: 'b',
    };
    const beanB: Bean = {
      id: 'b',
      code: 'b',
      slug: 'b',
      path: '',
      title: 'B',
      body: '',
      status: 'todo',
      type: 'task',
      tags: [],
      blocking: [],
      blockedBy: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      etag: '2',
    };

    // Mock service that returns parent bean by id
    const mockService: any = {
      showBean: async (id: string) => {
        if (id === 'b') {
          return beanB;
        }
        throw new Error('not found');
      },
    };

    const controller = new BeansDragAndDropController(mockService as any);

    const result = await (controller as any).isDescendantOf(beanA, beanB);
    expect(result).toBe(true);
  });

  it('returns false and does not hang on cycles (depth-limited)', async () => {
    // Build a small cycle: p1 -> p2 -> p3 -> p2 ... and start from startBean whose chain enters the cycle
    const chain: Record<string, Bean> = {};
    const chainLength = 10; // small but will cycle
    for (let i = 0; i < chainLength; i++) {
      chain[`n${i}`] = {
        id: `n${i}`,
        code: `n${i}`,
        slug: `n${i}`,
        path: '',
        title: `node ${i}`,
        body: '',
        status: 'todo',
        type: 'task',
        tags: [],
        blocking: [],
        blockedBy: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        etag: `${i}`,
        parent: `n${(i + 1) % chainLength}`,
      } as Bean;
    }

    // Create a cycle by pointing last node back to n1 (already achieved by modulo above)

    const startBean = chain['n0'];

    const mockService: any = {
      showBean: async (id: string) => {
        const found = chain[id];
        if (found) {
          return found;
        }
        throw new Error('not found');
      },
    };

    const controller = new BeansDragAndDropController(mockService as any);

    const potentialAncestor: Bean = {
      id: 'not-in-chain',
      code: 'x',
      slug: 'x',
      path: '',
      title: 'X',
      body: '',
      status: 'todo',
      type: 'task',
      tags: [],
      blocking: [],
      blockedBy: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      etag: 'z',
    };

    const result = await (controller as any).isDescendantOf(startBean, potentialAncestor);

    // Should be false and, importantly, should not hang thanks to depth protection
    expect(result).toBe(false);
  });
});
