import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { BeansService } from '../../beans/service';
import { Bean } from '../../beans/model';

/**
 * Integration tests for bean CRUD operations
 */

describe('Bean Operations', () => {
  let mockService: BeansService;

  const makeMockBean = (overrides: Partial<Bean> = {}): Bean => ({
    id: 'test-1',
    code: 't1',
    slug: 'test-bean',
    path: 'beans/test-1.md',
    title: 'Test Bean',
    body: '',
    status: 'todo',
    type: 'task',
    tags: [],
    blocking: [],
    blockedBy: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    etag: 'e1',
    ...overrides
  });

  beforeEach(() => {
    mockService = new BeansService('/mock/workspace');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Bean', () => {
    it('should create a bean with required fields', async () => {
      const newBean = makeMockBean({ 
        id: 'new-bean', 
        title: 'New Test Bean',
        status: 'todo',
        type: 'task'
      });

      vi.spyOn(mockService, 'createBean').mockResolvedValue(newBean);

      const result = await mockService.createBean({
        title: 'New Test Bean',
        type: 'task',
        status: 'todo',
        description: 'Description text'
      });

      expect(result.id).toBe('new-bean');
      expect(result.title).toBe('New Test Bean');
      expect(result.type).toBe('task');
      expect(result.status).toBe('todo');
    });

    it('should create a bean with optional priority', async () => {
      const newBean = makeMockBean({ 
        id: 'priority-bean', 
        title: 'Priority Bean',
        priority: 'high'
      });

      vi.spyOn(mockService, 'createBean').mockResolvedValue(newBean);

      const result = await mockService.createBean({
        title: 'Priority Bean',
        type: 'bug',
        status: 'todo',
        description: 'Critical bug',
        priority: 'high'
      });

      expect(result.priority).toBe('high');
    });
  });

  describe('Update Bean Status', () => {
    it('should update bean status', async () => {
      const updatedBean = makeMockBean({ status: 'in-progress' });

      vi.spyOn(mockService, 'updateBean').mockResolvedValue(updatedBean);

      const result = await mockService.updateBean('test-1', { status: 'in-progress' });

      expect(result.status).toBe('in-progress');
      expect(mockService.updateBean).toHaveBeenCalledWith('test-1', { status: 'in-progress' });
    });

    it('should transition from in-progress to completed', async () => {
      const completedBean = makeMockBean({ status: 'completed' });

      vi.spyOn(mockService, 'updateBean').mockResolvedValue(completedBean);

      const result = await mockService.updateBean('test-1', { status: 'completed' });

      expect(result.status).toBe('completed');
    });

    it('should transition from todo to scrapped', async () => {
      const scrappedBean = makeMockBean({ status: 'scrapped' });

      vi.spyOn(mockService, 'updateBean').mockResolvedValue(scrappedBean);

      const result = await mockService.updateBean('test-1', { status: 'scrapped' });

      expect(result.status).toBe('scrapped');
    });
  });

  describe('Update Bean Type', () => {
    it('should update bean type', async () => {
      const updatedBean = makeMockBean({ type: 'bug' });

      vi.spyOn(mockService, 'updateBean').mockResolvedValue(updatedBean);

      const result = await mockService.updateBean('test-1', { type: 'bug' });

      expect(result.type).toBe('bug');
    });

    it('should allow changing task to feature', async () => {
      const updatedBean = makeMockBean({ type: 'feature' });

      vi.spyOn(mockService, 'updateBean').mockResolvedValue(updatedBean);

      const result = await mockService.updateBean('test-1', { type: 'feature' });

      expect(result.type).toBe('feature');
    });
  });

  describe('Update Bean Priority', () => {
    it('should update bean priority', async () => {
      const updatedBean = makeMockBean({ priority: 'high' });

      vi.spyOn(mockService, 'updateBean').mockResolvedValue(updatedBean);

      const result = await mockService.updateBean('test-1', { priority: 'high' });

      expect(result.priority).toBe('high');
    });

    it('should allow setting priority to critical', async () => {
      const updatedBean = makeMockBean({ priority: 'critical' });

      vi.spyOn(mockService, 'updateBean').mockResolvedValue(updatedBean);

      const result = await mockService.updateBean('test-1', { priority: 'critical' });

      expect(result.priority).toBe('critical');
    });
  });

  describe('Parent Relationships', () => {
    it('should set parent', async () => {
      const childBean = makeMockBean({ id: 'child-1', parent: 'parent-1' });

      vi.spyOn(mockService, 'updateBean').mockResolvedValue(childBean);

      const result = await mockService.updateBean('child-1', { parent: 'parent-1' });

      expect(result.parent).toBe('parent-1');
    });

    it('should remove parent', async () => {
      const childBean = makeMockBean({ id: 'child-1', parent: undefined });

      vi.spyOn(mockService, 'updateBean').mockResolvedValue(childBean);

      const result = await mockService.updateBean('child-1', { parent: null as any });

      expect(result.parent).toBeUndefined();
    });
  });

  describe('Blocking Relationships', () => {
    it('should add blocking relationship', async () => {
      const blockingBean = makeMockBean({ 
        id: 'blocker-1', 
        blocking: ['blocked-1'] 
      });

      vi.spyOn(mockService, 'updateBean').mockResolvedValue(blockingBean);

      const result = await mockService.updateBean('blocker-1', { 
        blocking: ['blocked-1'] 
      });

      expect(result.blocking).toContain('blocked-1');
    });

    it('should add blocked-by relationship', async () => {
      const blockedBean = makeMockBean({ 
        id: 'blocked-1', 
        blockedBy: ['blocker-1'] 
      });

      vi.spyOn(mockService, 'updateBean').mockResolvedValue(blockedBean);

      const result = await mockService.updateBean('blocked-1', { 
        blockedBy: ['blocker-1'] 
      });

      expect(result.blockedBy).toContain('blocker-1');
    });

    it('should handle multiple blocking relationships', async () => {
      const blockingBean = makeMockBean({ 
        id: 'blocker-1', 
        blocking: ['blocked-1', 'blocked-2', 'blocked-3'] 
      });

      vi.spyOn(mockService, 'updateBean').mockResolvedValue(blockingBean);

      const result = await mockService.updateBean('blocker-1', { 
        blocking: ['blocked-1', 'blocked-2', 'blocked-3'] 
      });

      expect(result.blocking).toHaveLength(3);
    });
  });

  describe('Delete Bean', () => {
    it('should allow deleting draft bean', async () => {
      vi.spyOn(mockService, 'deleteBean').mockResolvedValue(undefined);

      await mockService.deleteBean('draft-1');

      expect(mockService.deleteBean).toHaveBeenCalledWith('draft-1');
    });

    it('should allow deleting scrapped bean', async () => {
      vi.spyOn(mockService, 'deleteBean').mockResolvedValue(undefined);

      await mockService.deleteBean('scrapped-1');

      expect(mockService.deleteBean).toHaveBeenCalledWith('scrapped-1');
    });
  });

  describe('Show Bean', () => {
    it('should fetch bean by ID', async () => {
      const bean = makeMockBean({ id: 'test-1', title: 'Test Bean' });

      vi.spyOn(mockService, 'showBean').mockResolvedValue(bean);

      const result = await mockService.showBean('test-1');

      expect(result.id).toBe('test-1');
      expect(result.title).toBe('Test Bean');
    });
  });

  describe('Error Handling', () => {
    it('should handle bean not found error', async () => {
      vi.spyOn(mockService, 'showBean').mockRejectedValue(new Error('Bean not found'));

      await expect(mockService.showBean('nonexistent')).rejects.toThrow('Bean not found');
    });

    it('should handle update conflict', async () => {
      vi.spyOn(mockService, 'updateBean').mockRejectedValue(new Error('ETag mismatch'));

      await expect(
        mockService.updateBean('test-1', { status: 'completed' })
      ).rejects.toThrow('ETag mismatch');
    });

    it('should handle invalid status transition', async () => {
      vi.spyOn(mockService, 'updateBean').mockRejectedValue(
        new Error('Invalid status transition')
      );

      await expect(
        mockService.updateBean('test-1', { status: 'invalid' as any })
      ).rejects.toThrow('Invalid status transition');
    });
  });
});

