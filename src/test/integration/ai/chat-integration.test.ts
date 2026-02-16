import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { BeansChatIntegration } from '../../../beans/chat/BeansChatIntegration';
import { BeansService } from '../../../beans/service/BeansService';
import type { Bean } from '../../../beans/model';

describe('Chat Integration', () => {
  let mockContext: vscode.ExtensionContext;
  let mockService: BeansService;
  let chatIntegration: BeansChatIntegration;
  let registeredParticipants: vscode.ChatParticipant[];

  beforeEach(() => {
    registeredParticipants = [];

    mockContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.file('/mock/extension/path')
    } as any;

    mockService = {
      listBeans: vi.fn()
    } as any;

    // Mock vscode.chat API
    (vscode.chat as any) = {
      createChatParticipant: vi.fn((id: string, handler: any) => {
        const participant: vscode.ChatParticipant = {
          id,
          onDidPerformAction: new vscode.EventEmitter<any>().event,
          iconPath: undefined,
          followupProvider: undefined,
          requestHandler: handler
        } as any;
        registeredParticipants.push(participant);
        return participant;
      })
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
        progress: vi.fn()
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
          priority: 'normal'
        } as Bean,
        {
          id: 'bean-2',
          title: 'Test Bean 2',
          status: 'todo',
          type: 'feature',
          priority: 'high'
        } as Bean,
        {
          id: 'bean-3',
          title: 'Test Bean 3',
          status: 'completed',
          type: 'bug',
          priority: 'normal'
        } as Bean
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
        enableCommandDetection: false
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
          priority: 'normal'
        } as Bean
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
        enableCommandDetection: false
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
        progress: vi.fn()
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
          priority: 'normal'
        } as Bean,
        {
          id: 'bean-2',
          title: 'High Priority',
          status: 'todo',
          type: 'feature',
          priority: 'high'
        } as Bean,
        {
          id: 'bean-3',
          title: 'Critical Priority',
          status: 'in-progress',
          type: 'bug',
          priority: 'critical'
        } as Bean
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
        enableCommandDetection: false
      } as any;

      await participant.requestHandler(request, {} as any, mockStream as any, {} as any);

      expect(mockStream.markdown).toHaveBeenCalled();
      // First call should mention critical priority
      const markdownCalls = mockStream.markdown.mock.calls.map(call => call[0] as string);
      const beansSection = markdownCalls.join('');
      expect(beansSection).toContain('bean-3'); // Critical should appear
      expect(beansSection).toContain('critical');
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
        progress: vi.fn()
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
          priority: 'high'
        } as Bean
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
        enableCommandDetection: false
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
        enableCommandDetection: false
      } as any;

      await participant.requestHandler(request, {} as any, mockStream as any, {} as any);

      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('No matching beans'));
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
        progress: vi.fn()
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
        enableCommandDetection: false
      } as any;

      await participant.requestHandler(request, {} as any, mockStream as any, {} as any);

      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('error'));
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('Service unavailable'));
    });
  });
});
