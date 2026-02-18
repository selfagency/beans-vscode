import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { BeansChatIntegration } from '../../../beans/chat/BeansChatIntegration';
import type { Bean } from '../../../beans/model';
import { BeansService } from '../../../beans/service/BeansService';

describe('Chat Integration', () => {
  let mockContext: vscode.ExtensionContext;
  let mockService: BeansService;
  let chatIntegration: BeansChatIntegration;
  let registeredParticipants: vscode.ChatParticipant[];

  beforeEach(() => {
    registeredParticipants = [];

    mockContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.file('/mock/extension/path'),
    } as any;

    mockService = {
      listBeans: vi.fn(),
    } as any;

    // Mock vscode.chat API
    (vscode.chat as any) = {
      createChatParticipant: vi.fn((id: string, handler: any) => {
        const participant: vscode.ChatParticipant = {
          id,
          onDidPerformAction: new vscode.EventEmitter<any>().event,
          iconPath: undefined,
          followupProvider: undefined,
          requestHandler: handler,
        } as any;
        registeredParticipants.push(participant);
        return participant;
      }),
    };

    chatIntegration = new BeansChatIntegration(mockContext, mockService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Participant Registration', () => {
    it('should register chat participant when chat API is available', () => {
      chatIntegration.register();

      expect(vscode.chat.createChatParticipant).toHaveBeenCalledWith('beans.chat', expect.any(Function));
      expect(registeredParticipants.length).toBe(1);
      expect(registeredParticipants[0].id).toBe('beans.chat');
      expect(mockContext.subscriptions.length).toBe(1);
    });

    it('should not register when chat API is unavailable', () => {
      (vscode.chat as any) = undefined;

      chatIntegration.register();

      expect(registeredParticipants.length).toBe(0);
    });

    it('should configure icon path', () => {
      chatIntegration.register();

      const participant = registeredParticipants[0];
      expect(participant.iconPath).toBeDefined();
    });

    it('should provide follow-up suggestions', () => {
      chatIntegration.register();

      const participant = registeredParticipants[0];
      expect(participant.followupProvider).toBeDefined();

      const mockResult = {} as any;
      const mockToken = {} as vscode.CancellationToken;
      const followups = participant.followupProvider!.provideFollowups(
        mockResult,
        {} as any,
        mockToken
      ) as vscode.ChatFollowup[];

      expect(followups).toBeDefined();
      expect(followups.length).toBeGreaterThan(0);

      const commands = followups.map((f: vscode.ChatFollowup) => f.command);
      expect(commands).toContain('summary');
      expect(commands).toContain('priority');
      expect(commands).toContain('stale');
      expect(commands).toContain('create');
      expect(commands).toContain('commit');
    });
  });

  describe('Request Handling - Summary Command', () => {
    let mockStream: {
      markdown: ReturnType<typeof vi.fn>;
      progress: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockStream = {
        markdown: vi.fn(),
        progress: vi.fn(),
      };

      chatIntegration.register();
    });

    it('should handle /summary command with bean counts', async () => {
      const testBeans: Bean[] = [
        {
          id: 'bean-1',
          title: 'Test Bean 1',
          status: 'in-progress',
          type: 'task',
          priority: 'normal',
        } as Bean,
        {
          id: 'bean-2',
          title: 'Test Bean 2',
          status: 'todo',
          type: 'feature',
          priority: 'high',
        } as Bean,
        {
          id: 'bean-3',
          title: 'Test Bean 3',
          status: 'completed',
          type: 'bug',
          priority: 'normal',
        } as Bean,
      ];

      vi.mocked(mockService.listBeans).mockResolvedValue(testBeans);

      const participant = registeredParticipants[0];
      const request: vscode.ChatRequest = {
        command: 'summary',
        prompt: '',
        location: 1,
        references: [],
        isPartialQuery: false,
        attempt: 0,
        enableCommandDetection: false,
      } as any;

      await participant.requestHandler(request, {} as any, mockStream as any, {} as any);

      // Check that summary was rendered
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('Beans summary'));
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('In progress'));
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('Todo'));
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('Completed'));
    });

    it('should list in-progress beans in summary', async () => {
      const testBeans: Bean[] = [
        {
          id: 'bean-1',
          title: 'Active Bean',
          status: 'in-progress',
          type: 'task',
          priority: 'normal',
        } as Bean,
      ];

      vi.mocked(mockService.listBeans).mockResolvedValue(testBeans);

      const participant = registeredParticipants[0];
      const request: vscode.ChatRequest = {
        command: 'summary',
        prompt: '',
        location: 1,
        references: [],
        isPartialQuery: false,
        attempt: 0,
        enableCommandDetection: false,
      } as any;

      await participant.requestHandler(request, {} as any, mockStream as any, {} as any);

      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('In-progress beans'));
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('bean-1'));
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('Active Bean'));
    });
  });

  describe('Request Handling - Priority Command', () => {
    let mockStream: {
      markdown: ReturnType<typeof vi.fn>;
      progress: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockStream = {
        markdown: vi.fn(),
        progress: vi.fn(),
      };

      chatIntegration.register();
    });

    it('should handle /priority command and sort by priority', async () => {
      const testBeans: Bean[] = [
        {
          id: 'bean-1',
          title: 'Normal Priority',
          status: 'todo',
          type: 'task',
          priority: 'normal',
        } as Bean,
        {
          id: 'bean-2',
          title: 'High Priority',
          status: 'todo',
          type: 'feature',
          priority: 'high',
        } as Bean,
        {
          id: 'bean-3',
          title: 'Critical Priority',
          status: 'in-progress',
          type: 'bug',
          priority: 'critical',
        } as Bean,
      ];

      vi.mocked(mockService.listBeans).mockResolvedValue(testBeans);

      const participant = registeredParticipants[0];
      const request: vscode.ChatRequest = {
        command: 'priority',
        prompt: '',
        location: 1,
        references: [],
        isPartialQuery: false,
        attempt: 0,
        enableCommandDetection: false,
      } as any;

      await participant.requestHandler(request, {} as any, mockStream as any, {} as any);

      expect(mockStream.markdown).toHaveBeenCalled();
      // First call should mention critical priority
      const markdownCalls = mockStream.markdown.mock.calls.map(call => call[0] as string);
      const beansSection = markdownCalls.join('');
      expect(beansSection).toContain('bean-3'); // Critical should appear
      expect(beansSection).toContain('critical');
    });

    it('should report when there are no active issues for /priority', async () => {
      vi.mocked(mockService.listBeans).mockResolvedValue([]);

      const participant = registeredParticipants[0];
      const request: vscode.ChatRequest = {
        command: 'priority',
        prompt: '',
        location: 1,
        references: [],
        isPartialQuery: false,
        attempt: 0,
        enableCommandDetection: false,
      } as any;

      await participant.requestHandler(request, {} as any, mockStream as any, {} as any);

      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('No active issues found'));
    });

    it('should use title as tiebreaker for /priority sorting', async () => {
      const testBeans: Bean[] = [
        {
          id: 'bean-b',
          title: 'B issue',
          status: 'todo',
          type: 'task',
          priority: 'high',
        } as Bean,
        {
          id: 'bean-a',
          title: 'A issue',
          status: 'todo',
          type: 'task',
          priority: 'high',
        } as Bean,
      ];

      vi.mocked(mockService.listBeans).mockResolvedValue(testBeans);

      const participant = registeredParticipants[0];
      const request: vscode.ChatRequest = {
        command: 'priority',
        prompt: '',
        location: 1,
        references: [],
        isPartialQuery: false,
        attempt: 0,
        enableCommandDetection: false,
      } as any;

      await participant.requestHandler(request, {} as any, mockStream as any, {} as any);

      const rendered = mockStream.markdown.mock.calls.map(call => call[0] as string).join('');
      expect(rendered.indexOf('bean-a')).toBeLessThan(rendered.indexOf('bean-b'));
    });
  });

  describe('Request Handling - Search Command', () => {
    let mockStream: {
      markdown: ReturnType<typeof vi.fn>;
      progress: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockStream = {
        markdown: vi.fn(),
        progress: vi.fn(),
      };

      chatIntegration.register();
    });

    it('should handle /search command with query', async () => {
      const testBeans: Bean[] = [
        {
          id: 'bean-1',
          title: 'Authentication Bug',
          status: 'todo',
          type: 'bug',
          priority: 'high',
        } as Bean,
      ];

      vi.mocked(mockService.listBeans).mockResolvedValue(testBeans);

      const participant = registeredParticipants[0];
      const request: vscode.ChatRequest = {
        command: 'search',
        prompt: 'authentication',
        location: 1,
        references: [],
        isPartialQuery: false,
        attempt: 0,
        enableCommandDetection: false,
      } as any;

      await participant.requestHandler(request, {} as any, mockStream as any, {} as any);

      expect(mockService.listBeans).toHaveBeenCalledWith({ search: 'authentication' });
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('Search results'));
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('authentication'));
    });

    it('should handle empty search results', async () => {
      vi.mocked(mockService.listBeans).mockResolvedValue([]);

      const participant = registeredParticipants[0];
      const request: vscode.ChatRequest = {
        command: 'search',
        prompt: 'nonexistent',
        location: 1,
        references: [],
        isPartialQuery: false,
        attempt: 0,
        enableCommandDetection: false,
      } as any;

      await participant.requestHandler(request, {} as any, mockStream as any, {} as any);

      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('No matching beans'));
    });

    it('should prompt for search term when query is empty', async () => {
      const participant = registeredParticipants[0];
      const request: vscode.ChatRequest = {
        command: 'search',
        prompt: '   ',
        location: 1,
        references: [],
        isPartialQuery: false,
        attempt: 0,
        enableCommandDetection: false,
      } as any;

      await participant.requestHandler(request, {} as any, mockStream as any, {} as any);

      expect(mockService.listBeans).not.toHaveBeenCalled();
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('What would you like to search for?'));
    });
  });

  describe('Request Handling - Next Command', () => {
    let mockStream: {
      markdown: ReturnType<typeof vi.fn>;
      progress: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockStream = {
        markdown: vi.fn(),
        progress: vi.fn(),
      };

      chatIntegration.register();
    });

    it('should handle /next command and request active statuses', async () => {
      const now = new Date('2026-01-01T00:00:00.000Z');
      const testBeans: Bean[] = [
        {
          id: 'bean-1',
          title: 'Important active issue',
          status: 'in-progress',
          type: 'task',
          priority: 'high',
          updatedAt: now,
        } as Bean,
      ];

      vi.mocked(mockService.listBeans).mockResolvedValue(testBeans);

      const participant = registeredParticipants[0];
      const request: vscode.ChatRequest = {
        command: 'next',
        prompt: '',
        location: 1,
        references: [],
        isPartialQuery: false,
        attempt: 0,
        enableCommandDetection: false,
      } as any;

      await participant.requestHandler(request, {} as any, mockStream as any, {} as any);

      expect(mockService.listBeans).toHaveBeenCalledWith({ status: ['in-progress', 'todo'] });
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('Suggested next beans'));
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('bean-1'));
    });

    it('should report empty /next result set', async () => {
      vi.mocked(mockService.listBeans).mockResolvedValue([]);

      const participant = registeredParticipants[0];
      const request: vscode.ChatRequest = {
        command: 'next',
        prompt: '',
        location: 1,
        references: [],
        isPartialQuery: false,
        attempt: 0,
        enableCommandDetection: false,
      } as any;

      await participant.requestHandler(request, {} as any, mockStream as any, {} as any);

      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('No todo or in-progress beans found'));
    });

    it('should sort /next suggestions by status, priority, then title', async () => {
      const testBeans: Bean[] = [
        {
          id: 'bean-todo-high-z',
          title: 'Z title',
          status: 'todo',
          type: 'task',
          priority: 'high',
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        } as Bean,
        {
          id: 'bean-progress-low',
          title: 'Middle',
          status: 'in-progress',
          type: 'bug',
          priority: 'low',
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        } as Bean,
        {
          id: 'bean-todo-high-a',
          title: 'A title',
          status: 'todo',
          type: 'feature',
          priority: 'high',
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        } as Bean,
      ];

      vi.mocked(mockService.listBeans).mockResolvedValue(testBeans);

      const participant = registeredParticipants[0];
      const request: vscode.ChatRequest = {
        command: 'next',
        prompt: '',
        location: 1,
        references: [],
        isPartialQuery: false,
        attempt: 0,
        enableCommandDetection: false,
      } as any;

      await participant.requestHandler(request, {} as any, mockStream as any, {} as any);

      const rendered = mockStream.markdown.mock.calls.map(call => call[0] as string).join('');
      expect(rendered.indexOf('bean-progress-low')).toBeLessThan(rendered.indexOf('bean-todo-high-a'));
      expect(rendered.indexOf('bean-todo-high-a')).toBeLessThan(rendered.indexOf('bean-todo-high-z'));
    });
  });

  describe('Request Handling - Stale Command', () => {
    let mockStream: {
      markdown: ReturnType<typeof vi.fn>;
      progress: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockStream = {
        markdown: vi.fn(),
        progress: vi.fn(),
      };

      chatIntegration.register();
    });

    it('should handle /stale command and show stale beans', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-01T00:00:00.000Z'));

      const staleDate = new Date('2025-12-20T00:00:00.000Z');
      const freshDate = new Date('2026-01-20T00:00:00.000Z');
      const olderStaleDate = new Date('2025-12-10T00:00:00.000Z');
      const testBeans: Bean[] = [
        {
          id: 'bean-staler',
          title: 'Older stale issue',
          status: 'draft',
          type: 'feature',
          updatedAt: olderStaleDate,
        } as Bean,
        {
          id: 'bean-stale',
          title: 'Stale issue',
          status: 'todo',
          type: 'bug',
          updatedAt: staleDate,
        } as Bean,
        {
          id: 'bean-fresh',
          title: 'Fresh issue',
          status: 'in-progress',
          type: 'task',
          updatedAt: freshDate,
        } as Bean,
      ];

      vi.mocked(mockService.listBeans).mockResolvedValue(testBeans);

      const participant = registeredParticipants[0];
      const request: vscode.ChatRequest = {
        command: 'stale',
        prompt: '',
        location: 1,
        references: [],
        isPartialQuery: false,
        attempt: 0,
        enableCommandDetection: false,
      } as any;

      await participant.requestHandler(request, {} as any, mockStream as any, {} as any);

      expect(mockService.listBeans).toHaveBeenCalledWith({ status: ['in-progress', 'todo', 'draft'] });
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('Stale issues'));
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('bean-stale'));
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('bean-staler'));
      expect(mockStream.markdown).not.toHaveBeenCalledWith(expect.stringContaining('bean-fresh'));

      vi.useRealTimers();
    });

    it('should report when there are no stale beans', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-01T00:00:00.000Z'));

      const testBeans: Bean[] = [
        {
          id: 'bean-fresh',
          title: 'Fresh issue',
          status: 'todo',
          type: 'bug',
          updatedAt: new Date('2026-01-20T00:00:00.000Z'),
        } as Bean,
      ];

      vi.mocked(mockService.listBeans).mockResolvedValue(testBeans);

      const participant = registeredParticipants[0];
      const request: vscode.ChatRequest = {
        command: 'stale',
        prompt: '',
        location: 1,
        references: [],
        isPartialQuery: false,
        attempt: 0,
        enableCommandDetection: false,
      } as any;

      await participant.requestHandler(request, {} as any, mockStream as any, {} as any);

      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('no stale issues'));

      vi.useRealTimers();
    });
  });

  describe('Request Handling - Create and Commit Commands', () => {
    let mockStream: {
      markdown: ReturnType<typeof vi.fn>;
      progress: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockStream = {
        markdown: vi.fn(),
        progress: vi.fn(),
      };

      chatIntegration.register();
    });

    it('should provide create issue instructions for /create', async () => {
      const participant = registeredParticipants[0];
      const request: vscode.ChatRequest = {
        command: 'create',
        prompt: '',
        location: 1,
        references: [],
        isPartialQuery: false,
        attempt: 0,
        enableCommandDetection: false,
      } as any;

      await participant.requestHandler(request, {} as any, mockStream as any, {} as any);

      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('Create a new issue'));
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('**Title**'));
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('`beans.create`'));
    });

    it('should provide issue-related commit workflow for /commit', async () => {
      const now = new Date('2026-02-01T00:00:00.000Z');
      const testBeans: Bean[] = [
        {
          id: 'bean-todo',
          title: 'Todo issue',
          status: 'todo',
          type: 'task',
          updatedAt: new Date('2026-01-20T00:00:00.000Z'),
        } as Bean,
        {
          id: 'bean-commit',
          title: 'Commit-ready issue',
          status: 'in-progress',
          type: 'feature',
          updatedAt: now,
        } as Bean,
        {
          id: 'bean-commit-older',
          title: 'Older in-progress issue',
          status: 'in-progress',
          type: 'bug',
          updatedAt: new Date('2026-01-15T00:00:00.000Z'),
        } as Bean,
      ];

      vi.mocked(mockService.listBeans).mockResolvedValue(testBeans);

      const participant = registeredParticipants[0];
      const request: vscode.ChatRequest = {
        command: 'commit',
        prompt: '',
        location: 1,
        references: [],
        isPartialQuery: false,
        attempt: 0,
        enableCommandDetection: false,
      } as any;

      await participant.requestHandler(request, {} as any, mockStream as any, {} as any);

      expect(mockService.listBeans).toHaveBeenCalledWith({ status: ['in-progress', 'todo'] });
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('Create an issue-related commit'));
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('bean-commit'));
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('feat(auth)'));
    });
  });

  describe('Request Handling - Default/General Command', () => {
    let mockStream: {
      markdown: ReturnType<typeof vi.fn>;
      progress: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockStream = {
        markdown: vi.fn(),
        progress: vi.fn(),
      };

      chatIntegration.register();
    });

    it('should provide scoped fallback when model API is unavailable', async () => {
      const participant = registeredParticipants[0];
      const request: vscode.ChatRequest = {
        command: undefined,
        prompt: 'help',
        model: undefined,
        location: 1,
        references: [],
        isPartialQuery: false,
        attempt: 0,
        enableCommandDetection: false,
      } as any;

      await participant.requestHandler(request, {} as any, mockStream as any, {} as any);

      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('scoped to Beans workflows'));
    });

    it('should stream model response fragments for general requests', async () => {
      (vscode as any).LanguageModelChatMessage = {
        User: vi.fn((content: string) => ({ role: 'user', content })),
      };

      vi.mocked(mockService.listBeans).mockResolvedValue([
        {
          id: 'bean-1',
          title: 'General helper context',
          status: 'todo',
          type: 'task',
        } as Bean,
      ]);

      const sendRequest = vi.fn(async () => ({
        text: (async function* () {
          yield 'hello ';
          yield 'world';
        })(),
      }));

      const participant = registeredParticipants[0];
      const request: vscode.ChatRequest = {
        command: undefined,
        prompt: 'what should I work on',
        model: {
          sendRequest,
        } as any,
        location: 1,
        references: [],
        isPartialQuery: false,
        attempt: 0,
        enableCommandDetection: false,
      } as any;
      const token = {} as vscode.CancellationToken;

      await participant.requestHandler(request, {} as any, mockStream as any, token);

      expect(mockService.listBeans).toHaveBeenCalledWith();
      expect(vscode.LanguageModelChatMessage.User).toHaveBeenCalledTimes(2);
      expect(sendRequest).toHaveBeenCalledTimes(1);
      expect(mockStream.markdown).toHaveBeenCalledWith('hello ');
      expect(mockStream.markdown).toHaveBeenCalledWith('world');
    });
  });

  describe('Request Handling - Error Cases', () => {
    let mockStream: {
      markdown: ReturnType<typeof vi.fn>;
      progress: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockStream = {
        markdown: vi.fn(),
        progress: vi.fn(),
      };

      chatIntegration.register();
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(mockService.listBeans).mockRejectedValue(new Error('Service unavailable'));

      const participant = registeredParticipants[0];
      const request: vscode.ChatRequest = {
        command: 'summary',
        prompt: '',
        location: 1,
        references: [],
        isPartialQuery: false,
        attempt: 0,
        enableCommandDetection: false,
      } as any;

      await participant.requestHandler(request, {} as any, mockStream as any, {} as any);

      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('error'));
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('Service unavailable'));
    });
  });
});
