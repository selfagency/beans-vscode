import * as vscode from 'vscode';
import { BeansOutput } from '../logging';
import type { Bean } from '../model';
import { BeansService } from '../service';
import { buildBeansChatSystemPrompt } from './prompts';

const CHAT_PARTICIPANT_ID = 'beans.chat';

export class BeansChatIntegration {
  private readonly logger = BeansOutput.getInstance();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly service: BeansService
  ) {}

  register(): void {
    if (!vscode.chat?.createChatParticipant) {
      this.logger.warn('Chat participant API is unavailable in this VS Code build');
      return;
    }

    const participant = vscode.chat.createChatParticipant(CHAT_PARTICIPANT_ID, this.handleRequest);
    participant.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'assets', 'icon.svg');
    participant.followupProvider = {
      provideFollowups: () => {
        return [
          {
            prompt: 'Summarize active beans',
            label: 'Summarize active beans',
            participant: CHAT_PARTICIPANT_ID,
            command: 'summary'
          },
          {
            prompt: 'What should I work on next?',
            label: 'Suggest next task',
            participant: CHAT_PARTICIPANT_ID,
            command: 'next'
          },
          {
            prompt: 'Search for beans mentioning MCP',
            label: 'Search beans for MCP',
            participant: CHAT_PARTICIPANT_ID,
            command: 'search'
          }
        ];
      }
    };

    this.context.subscriptions.push(participant);
    this.logger.info('Registered Beans chat participant');
  }

  private handleRequest: vscode.ChatRequestHandler = async (request, _chatContext, stream, token) => {
    try {
      switch (request.command) {
        case 'summary':
          await this.handleSummary(stream);
          return;
        case 'next':
          await this.handleNext(stream);
          return;
        case 'search':
          await this.handleSearch(request.prompt, stream);
          return;
        default:
          await this.handleGeneral(request, stream, token);
          return;
      }
    } catch (error) {
      this.logger.error('Beans chat participant request failed', error as Error);
      stream.markdown(`I ran into an error while handling your Beans request: ${(error as Error).message}`);
    }
  };

  private async handleSummary(stream: vscode.ChatResponseStream): Promise<void> {
    const beans = await this.service.listBeans();
    const counts = this.countByStatus(beans);

    stream.markdown('## Beans summary\n\n');
    stream.markdown(`- In progress: **${counts['in-progress'] ?? 0}**\n`);
    stream.markdown(`- Todo: **${counts.todo ?? 0}**\n`);
    stream.markdown(`- Draft: **${counts.draft ?? 0}**\n`);
    stream.markdown(`- Completed: **${counts.completed ?? 0}**\n`);
    stream.markdown(`- Scrapped: **${counts.scrapped ?? 0}**\n\n`);

    const inProgress = beans.filter((b) => b.status === 'in-progress').slice(0, 10);
    if (inProgress.length > 0) {
      stream.markdown('### In-progress beans\n');
      for (const bean of inProgress) {
        stream.markdown(`- \`${bean.id}\` — ${bean.title}\n`);
      }
    }
  }

  private async handleNext(stream: vscode.ChatResponseStream): Promise<void> {
    const candidates = await this.service.listBeans({ status: ['in-progress', 'todo'] });
    const prioritized = [...candidates].sort((a, b) => {
      const statusRank = (status: string) => (status === 'in-progress' ? 0 : 1);
      const priorityRank: Record<string, number> = {
        critical: 0,
        high: 1,
        normal: 2,
        low: 3,
        deferred: 4
      };

      const statusDiff = statusRank(a.status) - statusRank(b.status);
      if (statusDiff !== 0) {
        return statusDiff;
      }

      const priorityDiff =
        (priorityRank[a.priority ?? 'normal'] ?? 99) - (priorityRank[b.priority ?? 'normal'] ?? 99);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return a.title.localeCompare(b.title);
    });

    stream.markdown('## Suggested next beans\n\n');

    if (prioritized.length === 0) {
      stream.markdown('No todo or in-progress beans found. Try creating a new bean with `beans.create`.');
      return;
    }

    for (const bean of prioritized.slice(0, 8)) {
      stream.markdown(`- \`${bean.id}\` — **${bean.title}** (${bean.status}, ${bean.priority ?? 'normal'})\n`);
    }

    stream.markdown('\nUse Beans commands to update one, for example: set status, set priority, or edit blocking relationships.');
  }

  private async handleSearch(prompt: string, stream: vscode.ChatResponseStream): Promise<void> {
    const query = prompt.trim();
    if (!query) {
      stream.markdown('Please provide search text after `/search`, e.g. `/search mcp`');
      return;
    }

    const results = await this.service.listBeans({ search: query });
    stream.markdown(`## Search results for \`${query}\`\n\n`);

    if (results.length === 0) {
      stream.markdown('No matching beans found.');
      return;
    }

    for (const bean of results.slice(0, 20)) {
      stream.markdown(`- \`${bean.id}\` — ${bean.title} (${bean.status}, ${bean.type})\n`);
    }
  }

  private async handleGeneral(
    request: vscode.ChatRequest,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> {
    if (!request.model?.sendRequest) {
      stream.markdown(
        'This participant is scoped to Beans workflows. Try `/summary`, `/next`, or `/search <term>` for actionable results.'
      );
      return;
    }

    const beans = await this.service.listBeans();
    const systemPrompt = buildBeansChatSystemPrompt(request.command, beans);

    const response = await request.model.sendRequest(
      [
        vscode.LanguageModelChatMessage.User(systemPrompt),
        vscode.LanguageModelChatMessage.User(request.prompt)
      ],
      {},
      token
    );

    for await (const fragment of response.text) {
      stream.markdown(fragment);
    }
  }

  private countByStatus(beans: Bean[]): Record<string, number> {
    return beans.reduce<Record<string, number>>((acc, bean) => {
      acc[bean.status] = (acc[bean.status] ?? 0) + 1;
      return acc;
    }, {});
  }
}
