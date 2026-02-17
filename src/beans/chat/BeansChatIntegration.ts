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
            command: 'summary',
          },
          {
            prompt: 'Show the top-priority issues for this workspace',
            label: 'Top-priority issues',
            participant: CHAT_PARTICIPANT_ID,
            command: 'priority',
          },
          {
            prompt: 'Which issues are stale in this workspace?',
            label: 'Stale issues',
            participant: CHAT_PARTICIPANT_ID,
            command: 'stale',
          },
          {
            prompt: 'Help me create a new issue',
            label: 'Create a new issue',
            participant: CHAT_PARTICIPANT_ID,
            command: 'create',
          },
          {
            prompt: 'Help me create an issue-related commit for the current workspace',
            label: 'Issue-related commit',
            participant: CHAT_PARTICIPANT_ID,
            command: 'commit',
          },
        ];
      },
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
        case 'priority':
          await this.handleTopPriority(stream);
          return;
        case 'stale':
          await this.handleStale(stream);
          return;
        case 'create':
          await this.handleCreateIssue(stream);
          return;
        case 'search':
          await this.handleSearch(request.prompt, stream);
          return;
        case 'commit':
          await this.handleIssueRelatedCommit(stream);
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

    const inProgress = beans.filter(b => b.status === 'in-progress').slice(0, 10);
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
        deferred: 4,
      };

      const statusDiff = statusRank(a.status) - statusRank(b.status);
      if (statusDiff !== 0) {
        return statusDiff;
      }

      const priorityDiff = (priorityRank[a.priority ?? 'normal'] ?? 99) - (priorityRank[b.priority ?? 'normal'] ?? 99);
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

    stream.markdown(
      '\nUse Beans commands to update one, for example: set status, set priority, or edit blocking relationships.'
    );
  }

  private async handleSearch(prompt: string, stream: vscode.ChatResponseStream): Promise<void> {
    const query = prompt.trim();
    if (!query) {
      stream.markdown('What would you like to search for? Enter `/search <term>` and I will find matching beans.');
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

  private async handleTopPriority(stream: vscode.ChatResponseStream): Promise<void> {
    const beans = await this.service.listBeans({ status: ['in-progress', 'todo'] });
    const priorityRank: Record<string, number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3,
      deferred: 4,
    };

    const prioritized = [...beans].sort((a, b) => {
      const aStatusRank = a.status === 'in-progress' ? 0 : 1;
      const bStatusRank = b.status === 'in-progress' ? 0 : 1;
      const statusDiff = aStatusRank - bStatusRank;
      if (statusDiff !== 0) {
        return statusDiff;
      }

      const priorityDiff = (priorityRank[a.priority ?? 'normal'] ?? 99) - (priorityRank[b.priority ?? 'normal'] ?? 99);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return a.title.localeCompare(b.title);
    });

    stream.markdown('## Top-priority issues\n\n');
    if (prioritized.length === 0) {
      stream.markdown('No active issues found. Try creating one with `beans.create`.');
      return;
    }

    for (const bean of prioritized.slice(0, 8)) {
      stream.markdown(`- \`${bean.id}\` — **${bean.title}** (${bean.status}, ${bean.priority ?? 'normal'})\n`);
    }
  }

  private async handleStale(stream: vscode.ChatResponseStream): Promise<void> {
    const beans = await this.service.listBeans({ status: ['in-progress', 'todo', 'draft'] });
    const nowMs = Date.now();
    const staleDaysThreshold = 21;
    const staleMsThreshold = staleDaysThreshold * 24 * 60 * 60 * 1000;

    const stale = beans
      .filter(bean => nowMs - bean.updatedAt.getTime() >= staleMsThreshold)
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());

    stream.markdown(`## Stale issues (${staleDaysThreshold}+ days without updates)\n\n`);
    if (stale.length === 0) {
      stream.markdown('Nice — no stale issues found.');
      return;
    }

    for (const bean of stale.slice(0, 12)) {
      const ageDays = Math.floor((nowMs - bean.updatedAt.getTime()) / (24 * 60 * 60 * 1000));
      stream.markdown(`- \`${bean.id}\` — ${bean.title} (${bean.status}, updated ${ageDays}d ago)\n`);
    }
  }

  private async handleCreateIssue(stream: vscode.ChatResponseStream): Promise<void> {
    stream.markdown('## Create a new issue\n\n');
    stream.markdown('Tell me these fields and I will draft it:\n');
    stream.markdown('- **Title**\n');
    stream.markdown('- **Type** (`task`, `bug`, `feature`, `epic`, `milestone`)\n');
    stream.markdown('- **Priority** (`critical`, `high`, `normal`, `low`, `deferred`)\n');
    stream.markdown('- **Description**\n');
    stream.markdown('- **Parent** (optional bean id)\n\n');
    stream.markdown('You can also create directly in VS Code using the `beans.create` command.');
  }

  private async handleIssueRelatedCommit(stream: vscode.ChatResponseStream): Promise<void> {
    const beans = await this.service.listBeans({ status: ['in-progress', 'todo'] });
    const likely = [...beans]
      .sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'in-progress' ? -1 : 1;
        }
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      })
      .slice(0, 5);

    stream.markdown('## Create an issue-related commit\n\n');
    stream.markdown('Suggested workflow:\n');
    stream.markdown('1. Confirm which bean(s) this change belongs to.\n');
    stream.markdown('2. Stage only the relevant files.\n');
    stream.markdown('3. Use a conventional commit message and include bean id(s).\n\n');

    if (likely.length > 0) {
      stream.markdown('Likely beans for this workspace context:\n');
      for (const bean of likely) {
        stream.markdown(`- \`${bean.id}\` — ${bean.title} (${bean.status})\n`);
      }
      stream.markdown('\n');
    }

    stream.markdown('Example commit subject:\n');
    stream.markdown('- `feat(scope): concise description (bean-id)`\n');
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
      [vscode.LanguageModelChatMessage.User(systemPrompt), vscode.LanguageModelChatMessage.User(request.prompt)],
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
