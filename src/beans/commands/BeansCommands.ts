/**
 * Module: beans/commands
 *
 * Implements the commands surface for the Beans extension. This module maps
 * user-invoked commands (from the palette, tree, or webviews) to business logic
 * implemented by `BeansService` and coordinates UI interactions (quick picks,
 * notifications, and webviews).
 *
 * Key responsibilities:
 * - Register all contributed commands with VS Code
 * - Provide user-friendly error handling via `handleBeansError`
 * - Compose Copilot prompts and handle different VS Code chat command shapes
 *
 * Contributor notes:
 * - Keep command handlers small and delegate CLI work to `BeansService`
 * - When adding commands, update `package.json` contributions and tests
 */
import * as vscode from 'vscode';
import { BeansConfigManager } from '../config';
import { BeansDetailsViewProvider } from '../details';
import { BeansOutput } from '../logging';
import {
  Bean,
  BeansCLINotFoundError,
  BeansConcurrencyError,
  BeansConfigMissingError,
  BeansIntegrityCheckFailedError,
  BeansJSONParseError,
  BeansPermissionError,
  BeansTimeoutError,
} from '../model';
import { BeansPreviewProvider } from '../preview';
import { BeansService } from '../service';
import { BeansFilterManager, BeanTreeItem } from '../tree';

const logger = BeansOutput.getInstance();

type CopilotPromptTemplate = {
  id:
    | 'issue-status'
    | 'remaining-steps'
    | 'close-and-commit'
    | 'export-to-github-issues'
    | 'set-in-progress-and-begin'
    | 'flesh-out-specs-and-todos';
  label: string;
  detail: string;
  prompt: string;
};

/**
 * Handle errors from Beans operations with specific error type handling
 * @param error The error to handle
 * @param context Description of what operation failed
 * @param showToUser Whether to show error message to user
 */
function handleBeansError(error: unknown, context: string, showToUser: boolean = true): void {
  if (error instanceof BeansCLINotFoundError) {
    logger.error(`${context}: Beans CLI not found`, error);
    if (showToUser) {
      vscode.window
        .showErrorMessage('Beans CLI not installed. Please install it first.', 'Install Instructions')
        .then(selection => {
          if (selection === 'Install Instructions') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/hmans/beans#installation'));
          }
        });
    }
  } else if (error instanceof BeansConfigMissingError) {
    logger.error(`${context}: Beans configuration missing`, error);
    if (showToUser) {
      vscode.window
        .showErrorMessage(
          'Beans is not initialized in this workspace. Create a .beans.yml file to get started.',
          'Learn More'
        )
        .then(selection => {
          if (selection === 'Learn More') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/hmans/beans#configuration'));
          }
        });
    }
  } else if (error instanceof BeansPermissionError) {
    logger.error(`${context}: Permission denied`, error);
    if (showToUser) {
      vscode.window.showErrorMessage(`Permission denied: ${error.message}. Check file permissions in your workspace.`);
    }
  } else if (error instanceof BeansConcurrencyError) {
    logger.error(`${context}: Concurrent modification detected`, error);
    if (showToUser) {
      vscode.window
        .showWarningMessage('This bean was modified by another process. Please refresh and try again.', 'Refresh')
        .then(selection => {
          if (selection === 'Refresh') {
            vscode.commands.executeCommand('beans.refresh');
          }
        });
    }
  } else if (error instanceof BeansIntegrityCheckFailedError) {
    logger.error(`${context}: Integrity check failed`, error);
    if (showToUser) {
      vscode.window
        .showErrorMessage('Bean data integrity check failed. The repository may be corrupted.', 'Show Output')
        .then(selection => {
          if (selection === 'Show Output') {
            logger.show();
          }
        });
    }
  } else if (error instanceof BeansTimeoutError) {
    logger.error(`${context}: Operation timed out`, error);
    if (showToUser) {
      vscode.window.showWarningMessage(
        'Beans operation timed out. Please try again or check if the workspace is very large.'
      );
    }
  } else if (error instanceof BeansJSONParseError) {
    logger.error(`${context}: Failed to parse CLI output`, error);
    if (showToUser) {
      vscode.window
        .showErrorMessage(
          `Failed to parse Beans CLI response. The CLI may have returned unexpected output.`,
          'Show Output'
        )
        .then(selection => {
          if (selection === 'Show Output') {
            logger.show();
          }
        });
    }
  } else if (error instanceof Error) {
    const message = `${context}: ${error.message}`;
    logger.error(message, error);
    if (showToUser) {
      vscode.window.showErrorMessage(message);
    }
  } else {
    const message = `${context}: An unexpected error occurred`;
    logger.error(message, new Error(String(error)));
    if (showToUser) {
      vscode.window.showErrorMessage(message);
    }
  }
}

/**
 * Format a raw value (e.g., 'in-progress') to a human-readable label (e.g., 'In Progress')
 */
function formatLabel(value: string): string {
  return value
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const STATUS_PICK_LABELS: Record<string, string> = {
  todo: '$(issues) Todo',
  'in-progress': '$(play-circle) In Progress',
  completed: '$(issue-closed) Completed',
  draft: '$(issue-draft) Draft',
  scrapped: '$(stop) Scrapped',
};

const TYPE_PICK_LABELS: Record<string, string> = {
  milestone: '$(milestone) Milestone',
  epic: '$(zap) Epic',
  feature: '$(lightbulb) Feature',
  bug: '$(bug) Bug',
  task: '$(list-unordered) Task',
};

const PRIORITY_PICK_LABELS: Record<string, string> = {
  critical: '① Critical',
  high: '② High',
  normal: '③ Normal',
  low: '④ Low',
  deferred: '⑤ Deferred',
};

type ValuePickKind = 'plain' | 'status' | 'type' | 'priority';

function getPickLabel(value: string, kind: ValuePickKind): string {
  if (kind === 'status') {
    return STATUS_PICK_LABELS[value] ?? formatLabel(value);
  }
  if (kind === 'type') {
    return TYPE_PICK_LABELS[value] ?? formatLabel(value);
  }
  if (kind === 'priority') {
    return PRIORITY_PICK_LABELS[value] ?? formatLabel(value);
  }
  return formatLabel(value);
}

/**
 * Create QuickPickItems from raw values with human-readable labels.
 * Returns the selected raw value or undefined if cancelled.
 */
async function pickFromValues(
  values: string[],
  options: vscode.QuickPickOptions,
  kind: ValuePickKind = 'plain'
): Promise<string | undefined> {
  const items: vscode.QuickPickItem[] = values.map(v => ({
    label: getPickLabel(v, kind),
    description: v,
  }));
  const picked = await vscode.window.showQuickPick(items, options);
  return picked?.description;
}

/**
 * Core commands for Beans extension matching TUI parity
 */
export class BeansCommands {
  constructor(
    private readonly service: BeansService,
    private readonly context: vscode.ExtensionContext,
    private readonly previewProvider: BeansPreviewProvider,
    private readonly filterManager: BeansFilterManager,
    private readonly configManager: BeansConfigManager,
    private readonly detailsProvider?: BeansDetailsViewProvider
  ) {}

  /**
   * Register all commands with VS Code
   */
  public registerAll(): void {
    // View and navigation commands
    this.registerCommand('beans.view', this.viewBean.bind(this));
    this.registerCommand('beans.create', this.createBean.bind(this));
    this.registerCommand('beans.edit', this.editBean.bind(this));
    this.registerCommand('beans.copilotStartWork', this.copilotStartWork.bind(this));

    // Status management
    this.registerCommand('beans.setStatus', this.setStatus.bind(this));
    this.registerCommand('beans.reopenCompleted', this.reopenCompleted.bind(this));
    this.registerCommand('beans.reopenScrapped', this.reopenScrapped.bind(this));

    // Type management
    this.registerCommand('beans.setType', this.setType.bind(this));

    // Priority management
    this.registerCommand('beans.setPriority', this.setPriority.bind(this));

    // Parent/relationship management
    this.registerCommand('beans.setParent', this.setParent.bind(this));
    this.registerCommand('beans.removeParent', this.removeParent.bind(this));
    this.registerCommand('beans.editBlocking', this.editBlocking.bind(this));

    // Utility commands
    this.registerCommand('beans.copyId', this.copyId.bind(this));
    this.registerCommand('beans.delete', this.deleteBean.bind(this));

    // Tree refresh and filtering
    this.registerCommand('beans.refresh', () => {
      vscode.commands.executeCommand('beans.refreshAll');
    });
    this.registerCommand('beans.filter', this.filter.bind(this));
    this.registerCommand('beans.search', this.search.bind(this));
    this.registerCommand('beans.sort', this.sort.bind(this));

    // Configuration
    this.registerCommand('beans.openConfig', this.openConfig.bind(this));
    this.registerCommand('beans.openExtensionSettings', this.openExtensionSettings.bind(this));

    // Documentation
    this.registerCommand('beans.openUserGuide', this.openUserGuide.bind(this));
    this.registerCommand('beans.openAiFeaturesGuide', this.openAiFeaturesGuide.bind(this));

    logger.info('All Beans commands registered');
  }

  /**
   * Open Copilot Chat with a focused prompt to assess and start work on a bean.
   */
  private async copilotStartWork(arg?: Bean | BeanTreeItem): Promise<void> {
    try {
      let bean = await this.resolveBeanAsync(arg);
      if (!bean) {
        bean = this.detailsProvider?.currentBean;
      }
      if (!bean) {
        bean = await this.pickBean('Select bean to start work with Copilot');
        if (!bean) {
          return;
        }
      }

      // Prefer full details (body, relationships) when composing prompt.
      const fullBean = await this.service.showBean(bean.id).catch(() => bean!);
      const prompt = await this.pickCopilotPrompt(fullBean);
      if (!prompt) {
        return;
      }

      // Best-effort open Copilot Chat with prompt. Command signatures vary across VS Code builds.
      const attempts: Array<() => PromiseLike<unknown>> = [
        () => vscode.commands.executeCommand('workbench.action.chat.open', { query: prompt }),
        () => vscode.commands.executeCommand('workbench.action.chat.open', prompt),
        () => vscode.commands.executeCommand('workbench.action.chat.new', { query: prompt }),
        () => vscode.commands.executeCommand('workbench.action.chat.openToSide', { query: prompt }),
      ];

      let opened = false;
      for (const attempt of attempts) {
        try {
          await attempt();
          opened = true;
          break;
        } catch {
          // Try next known command shape.
        }
      }

      if (!opened) {
        await vscode.env.clipboard.writeText(prompt);
        const choice = await vscode.window.showInformationMessage(
          'Copilot Chat was not opened automatically. Prompt copied to clipboard.',
          'Open Chat'
        );
        if (choice === 'Open Chat') {
          try {
            await vscode.commands.executeCommand('workbench.action.chat.open');
          } catch {
            // No-op fallback.
          }
        }
      }

      logger.info(`Sent bean ${fullBean.code} to Copilot for start-work guidance`);
    } catch (error) {
      const message = `Failed to open Copilot start-work prompt: ${(error as Error).message}`;
      logger.error(message, error as Error);
      vscode.window.showErrorMessage(message);
    }
  }

  private buildCopilotBeanContext(bean: Bean): string {
    const tags = bean.tags && bean.tags.length > 0 ? bean.tags.join(', ') : 'none';
    const blocking = bean.blocking && bean.blocking.length > 0 ? bean.blocking.join(', ') : 'none';
    const blockedBy = bean.blockedBy && bean.blockedBy.length > 0 ? bean.blockedBy.join(', ') : 'none';
    const body = bean.body?.trim() ? bean.body.trim() : '(no description)';

    return [
      `Bean ID: ${bean.id}`,
      `Code: ${bean.code}`,
      `Title: ${bean.title}`,
      `Status: ${bean.status}`,
      `Type: ${bean.type}`,
      `Priority: ${bean.priority ?? 'none'}`,
      `Parent: ${bean.parent ?? 'none'}`,
      `Tags: ${tags}`,
      `Blocking: ${blocking}`,
      `Blocked by: ${blockedBy}`,
      '',
      'Description / notes:',
      body,
    ].join('\n');
  }

  private buildCopilotPromptTemplates(bean: Bean): CopilotPromptTemplate[] {
    const context = this.buildCopilotBeanContext(bean);

    return [
      {
        id: 'issue-status',
        label: "What's the status of this issue?",
        detail: 'Summarize current state and progress at a glance',
        prompt: [
          'What is the current status of this issue?',
          'Summarize what appears done, what is uncertain, and what should be verified next.',
          '',
          context,
        ].join('\n'),
      },
      {
        id: 'remaining-steps',
        label: 'What steps remain to complete this issue?',
        detail: 'Identify remaining work and the best execution order',
        prompt: [
          'List the remaining steps needed to complete this issue.',
          'Prioritize them and call out blockers, dependencies, and acceptance criteria gaps.',
          '',
          context,
        ].join('\n'),
      },
      {
        id: 'close-and-commit',
        label: 'Close this issue and create a related commit',
        detail: 'Prepare close-out guidance and commit plan from current working copy',
        prompt: [
          'Close this issue and create a related commit from the current working copy.',
          'First confirm whether close criteria are met, then propose commit message(s), staged file grouping, and any final checks.',
          '',
          context,
        ].join('\n'),
      },
      {
        id: 'export-to-github-issues',
        label: 'Export this issue to GitHub Issues',
        detail: 'Generate a GitHub issue draft with mapped fields and metadata',
        prompt: [
          'Export this issue to GitHub Issues.',
          'Draft the GitHub issue title/body/labels/assignees/milestone mapping and identify missing information before publishing.',
          '',
          context,
        ].join('\n'),
      },
      {
        id: 'set-in-progress-and-begin',
        label: 'Set to in-progress and begin work',
        detail: 'Transition state and start with concrete first implementation actions',
        prompt: [
          'Set this issue to in-progress and begin work on it.',
          'Provide the exact first implementation steps to execute now, including safe validation checkpoints.',
          '',
          context,
        ].join('\n'),
      },
      {
        id: 'flesh-out-specs-and-todos',
        label: 'Flesh out specs and todos for this issue',
        detail: 'Expand requirements into clearer specs, tasks, and acceptance criteria',
        prompt: [
          "Help me flesh out more detailed specs and todos for this issue's tasks.",
          'Break the work into actionable checklist items with assumptions, edge cases, and test expectations.',
          '',
          context,
        ].join('\n'),
      },
    ];
  }

  private async pickCopilotPrompt(bean: Bean): Promise<string | undefined> {
    const templates = this.buildCopilotPromptTemplates(bean);
    const selected = await vscode.window.showQuickPick(
      templates.map(template => ({
        label: template.label,
        detail: template.detail,
        template,
      })),
      {
        placeHolder: `Choose a Copilot prompt for ${bean.code}`,
        title: 'Copilot Prompt',
        matchOnDetail: true,
      }
    );

    return selected?.template.prompt;
  }

  /**
   * Helper to register command with disposable tracking
   */
  private registerCommand(command: string, callback: (...args: any[]) => any): void {
    const disposable = vscode.commands.registerCommand(command, callback);
    this.context.subscriptions.push(disposable);
  }

  /**
   * Resolve a command argument to a Bean.
   *
   * When invoked from a tree-item context menu VS Code passes the
   * BeanTreeItem instance, not the inner Bean model.  When invoked
   * from the command palette the argument is already a Bean (or
   * undefined).  This helper normalises both cases.
   *
   * Uses duck-typing rather than `instanceof` because esbuild
   * bundling can break prototype-chain checks.
   */
  private resolveBean(arg?: any): Bean | undefined {
    if (!arg) {
      return undefined;
    }
    // BeanTreeItem: has a nested .bean property with an .id string
    if (arg.bean && typeof arg.bean === 'object' && typeof arg.bean.id === 'string') {
      return arg.bean as Bean;
    }
    // Already a Bean (has .id and .status directly)
    if (typeof arg.id === 'string' && typeof arg.status === 'string') {
      return arg as Bean;
    }
    return undefined;
  }

  /**
   * Resolve a command argument to a Bean, with async fallback for
   * webview context menu arguments that only carry a beanId.
   *
   * VS Code's webview/context menu passes the `data-vscode-context`
   * object as the command argument.  Our search results set
   * `{ webviewSection, beanId }`, so we fetch the full Bean from
   * the CLI when we see that shape.
   */
  private async resolveBeanAsync(arg?: any): Promise<Bean | undefined> {
    const bean = this.resolveBean(arg);
    if (bean) {
      return bean;
    }

    // Webview context: has beanId but not the full Bean shape
    if (arg && typeof arg.beanId === 'string') {
      try {
        return await this.service.showBean(arg.beanId);
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  /**
   * View bean in markdown preview
   */
  private async viewBean(arg?: Bean | BeanTreeItem): Promise<void> {
    try {
      let bean = await this.resolveBeanAsync(arg);
      if (!bean) {
        bean = await this.pickBean('Select bean to view');
        if (!bean) {
          return;
        }
      }

      // Open bean in preview
      const previewUri = this.previewProvider.getBeanPreviewUri(bean.id);
      const doc = await vscode.workspace.openTextDocument(previewUri);
      await vscode.window.showTextDocument(doc, {
        preview: true,
        preserveFocus: false,
      });

      logger.info(`Viewed bean ${bean.code} in preview`);
    } catch (error) {
      handleBeansError(error, 'Failed to view bean');
    }
  }

  /**
   * Create new bean
   */
  private async createBean(): Promise<void> {
    try {
      // Get bean title
      const title = await vscode.window.showInputBox({
        prompt: 'Bean title',
        placeHolder: 'Enter bean title',
        validateInput: value => {
          if (!value || value.trim().length === 0) {
            return 'Title is required';
          }
          return undefined;
        },
      });

      if (!title) {
        return;
      }

      // Get bean type
      const type = await pickFromValues(
        ['milestone', 'epic', 'feature', 'bug', 'task'],
        {
          placeHolder: 'Select type',
          title: 'Bean Type',
        },
        'type'
      );

      if (!type) {
        return;
      }

      // Get bean description (optional)
      const description = await vscode.window.showInputBox({
        prompt: 'Bean description (optional)',
        placeHolder: 'Enter description',
      });

      // Create bean
      const config = await this.service.getConfig();
      const defaultStatus = config.statuses?.includes('draft') ? 'draft' : (config.default_status ?? 'draft');
      const bean = await this.service.createBean({
        title: title.trim(),
        type: type as any,
        status: defaultStatus,
        description: description || undefined,
      });

      vscode.window.showInformationMessage(`Created bean: ${bean.code}`);
      logger.info(`Created bean ${bean.code}: ${bean.title}`);

      // Refresh trees
      await vscode.commands.executeCommand('beans.refreshAll');
    } catch (error) {
      const message = `Failed to create bean: ${(error as Error).message}`;
      logger.error(message, error as Error);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Edit bean (open in editor)
   */
  private async editBean(arg?: Bean | BeanTreeItem): Promise<void> {
    try {
      let bean = await this.resolveBeanAsync(arg);
      if (!bean) {
        // Fallback to the bean currently shown in the details pane (e.g. view/title button)
        bean = this.detailsProvider?.currentBean;
      }
      if (!bean) {
        bean = await this.pickBean('Select bean to edit');
        if (!bean) {
          return;
        }
      }

      // Open bean markdown file in editor
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        throw new Error('No workspace folder open');
      }

      const beanPath = vscode.Uri.joinPath(workspaceFolders[0].uri, '.beans', bean.path);
      const document = await vscode.workspace.openTextDocument(beanPath);
      await vscode.window.showTextDocument(document);

      logger.info(`Opened bean ${bean.code} for editing`);
    } catch (error) {
      const message = `Failed to edit bean: ${(error as Error).message}`;
      logger.error(message, error as Error);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Set bean status
   */
  private async setStatus(arg?: Bean | BeanTreeItem): Promise<void> {
    try {
      let bean = await this.resolveBeanAsync(arg);
      if (!bean) {
        bean = await this.pickBean('Select bean to update status');
        if (!bean) {
          return;
        }
      }

      const config = await this.service.getConfig();
      const statuses = config.statuses || ['todo', 'in-progress', 'completed', 'scrapped', 'draft'];

      const status = await pickFromValues(
        statuses,
        {
          placeHolder: `Current: ${formatLabel(bean.status)}`,
          title: `Set Status for ${bean.code}`,
        },
        'status'
      );

      if (!status || status === bean.status) {
        return;
      }

      await this.service.updateBean(bean.id, { status: status as any });
      vscode.window.showInformationMessage(`Updated ${bean.code} status to ${formatLabel(status)}`);
      logger.info(`Updated bean ${bean.code} status to ${status}`);

      // Refresh trees
      await vscode.commands.executeCommand('beans.refreshAll');
    } catch (error) {
      const message = `Failed to set status: ${(error as Error).message}`;
      logger.error(message, error as Error);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Reopen a completed bean (explicit access to completed beans)
   */
  private async reopenCompleted(): Promise<void> {
    try {
      const bean = await this.pickBean('Select completed bean to reopen', ['completed'], true);
      if (!bean) {
        return;
      }

      const config = await this.service.getConfig();
      const statuses = config.statuses || ['todo', 'in-progress', 'completed', 'scrapped', 'draft'];
      const nonClosedStatuses = statuses.filter(s => s !== 'completed' && s !== 'scrapped');

      const newStatus = await pickFromValues(
        nonClosedStatuses,
        {
          placeHolder: 'Select new status',
          title: `Reopen ${bean.code}`,
        },
        'status'
      );

      if (!newStatus) {
        return;
      }

      await this.service.updateBean(bean.id, { status: newStatus as any });
      vscode.window.showInformationMessage(`Reopened ${bean.code} as ${formatLabel(newStatus)}`);
      logger.info(`Reopened bean ${bean.code} from completed to ${newStatus}`);

      // Refresh trees
      await vscode.commands.executeCommand('beans.refreshAll');
    } catch (error) {
      const message = `Failed to reopen bean: ${(error as Error).message}`;
      logger.error(message, error as Error);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Reopen a scrapped bean (explicit access to scrapped beans)
   */
  private async reopenScrapped(): Promise<void> {
    try {
      const bean = await this.pickBean('Select scrapped bean to reopen', ['scrapped'], true);
      if (!bean) {
        return;
      }

      const config = await this.service.getConfig();
      const statuses = config.statuses || ['todo', 'in-progress', 'completed', 'scrapped', 'draft'];
      const nonClosedStatuses = statuses.filter(s => s !== 'completed' && s !== 'scrapped');

      const newStatus = await pickFromValues(
        nonClosedStatuses,
        {
          placeHolder: 'Select new status',
          title: `Reopen ${bean.code}`,
        },
        'status'
      );

      if (!newStatus) {
        return;
      }

      await this.service.updateBean(bean.id, { status: newStatus as any });
      vscode.window.showInformationMessage(`Reopened ${bean.code} as ${formatLabel(newStatus)}`);
      logger.info(`Reopened bean ${bean.code} from scrapped to ${newStatus}`);

      // Refresh trees
      await vscode.commands.executeCommand('beans.refreshAll');
    } catch (error) {
      const message = `Failed to reopen bean: ${(error as Error).message}`;
      logger.error(message, error as Error);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Set bean type
   */
  private async setType(arg?: Bean | BeanTreeItem): Promise<void> {
    try {
      let bean = await this.resolveBeanAsync(arg);
      if (!bean) {
        bean = await this.pickBean('Select bean to update type');
        if (!bean) {
          return;
        }
      }

      const config = await this.service.getConfig();
      const types = config.types || ['milestone', 'epic', 'feature', 'bug', 'task'];

      const type = await pickFromValues(
        types,
        {
          placeHolder: `Current: ${formatLabel(bean.type)}`,
          title: `Set Type for ${bean.code}`,
        },
        'type'
      );

      if (!type || type === bean.type) {
        return;
      }

      await this.service.updateBean(bean.id, { type: type as any });
      vscode.window.showInformationMessage(`Updated ${bean.code} type to ${formatLabel(type)}`);
      logger.info(`Updated bean ${bean.code} type to ${type}`);

      // Refresh trees
      await vscode.commands.executeCommand('beans.refreshAll');
    } catch (error) {
      const message = `Failed to set type: ${(error as Error).message}`;
      logger.error(message, error as Error);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Set bean priority
   */
  private async setPriority(arg?: Bean | BeanTreeItem): Promise<void> {
    try {
      let bean = await this.resolveBeanAsync(arg);
      if (!bean) {
        bean = await this.pickBean('Select bean to update priority');
        if (!bean) {
          return;
        }
      }

      const config = await this.service.getConfig();
      const priorities = config.priorities || ['critical', 'high', 'normal', 'low', 'deferred'];

      const priority = await pickFromValues(
        priorities,
        {
          placeHolder: bean.priority ? `Current: ${formatLabel(bean.priority)}` : 'No priority set',
          title: `Set Priority for ${bean.code}`,
        },
        'priority'
      );

      if (!priority || priority === bean.priority) {
        return;
      }

      await this.service.updateBean(bean.id, { priority: priority as any });
      vscode.window.showInformationMessage(`Updated ${bean.code} priority to ${formatLabel(priority)}`);
      logger.info(`Updated bean ${bean.code} priority to ${priority}`);

      // Refresh trees
      await vscode.commands.executeCommand('beans.refreshAll');
    } catch (error) {
      const message = `Failed to set priority: ${(error as Error).message}`;
      logger.error(message, error as Error);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Codicon name for a bean type (used in QuickPick labels).
   */
  private typeIcon(type: string): string {
    switch (type) {
      case 'milestone':
        return '$(milestone)';
      case 'epic':
        return '$(zap)';
      case 'feature':
        return '$(lightbulb)';
      case 'bug':
        return '$(bug)';
      case 'task':
      default:
        return '$(list-unordered)';
    }
  }

  /**
   * Icon to display in bean quick-pick labels.
   * In-progress beans always use play-circle, otherwise use type icon.
   */
  private beanPickerIcon(bean: Bean): string {
    if (bean.status === 'in-progress') {
      return '$(play-circle)';
    }
    return this.typeIcon(bean.type);
  }

  /**
   * Set bean parent.
   *
   * By default shows only milestones and epics (natural parent types).
   * A toggle button lets the user include all issue types.
   * Items are sorted by most recently updated, and scrapped/completed
   * beans are excluded.
   */
  private async setParent(arg?: Bean | BeanTreeItem): Promise<void> {
    try {
      let bean = await this.resolveBeanAsync(arg);
      if (!bean) {
        bean = await this.pickBean('Select bean to set parent');
        if (!bean) {
          return;
        }
      }

      // Get all beans, filter out self, descendants, scrapped, completed
      const allBeans = await this.service.listBeans();
      const potentialParents = allBeans
        .filter(b => {
          if (b.id === bean!.id) {
            return false;
          }
          if (b.parent === bean!.id) {
            return false;
          }
          if (b.status === 'completed' || b.status === 'scrapped') {
            return false;
          }
          return true;
        })
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      const parentOnlyTypes = potentialParents.filter(b => b.type === 'milestone' || b.type === 'epic');

      interface ParentPickItem extends vscode.QuickPickItem {
        bean?: Bean;
      }

      const toItems = (beans: Bean[]): ParentPickItem[] =>
        beans.map(b => ({
          label: `${this.typeIcon(b.type)} ${b.title}`,
          description: `${b.code} · ${formatLabel(b.status)}${b.priority ? ` · ${formatLabel(b.priority)}` : ''}`,
          bean: b,
        }));

      const qp = vscode.window.createQuickPick<ParentPickItem>();
      qp.title = `Set Parent for ${bean.code}`;
      qp.placeholder = bean.parent ? `Current parent: ${bean.parent}` : 'Select a parent (milestones & epics)';
      qp.matchOnDescription = true;

      let showAllTypes = false;
      qp.items = toItems(parentOnlyTypes);

      const toggleButton: vscode.QuickInputButton = {
        iconPath: new vscode.ThemeIcon('list-unordered'),
        tooltip: 'Show all issue types',
      };
      qp.buttons = [toggleButton];

      qp.onDidTriggerButton(() => {
        showAllTypes = !showAllTypes;
        if (showAllTypes) {
          qp.items = toItems(potentialParents);
          qp.placeholder = bean!.parent ? `Current parent: ${bean!.parent}` : 'Select a parent (all types)';
        } else {
          qp.items = toItems(parentOnlyTypes);
          qp.placeholder = bean!.parent ? `Current parent: ${bean!.parent}` : 'Select a parent (milestones & epics)';
        }
      });

      const selected = await new Promise<ParentPickItem | undefined>(resolve => {
        qp.onDidAccept(() => {
          resolve(qp.selectedItems[0]);
          qp.dispose();
        });
        qp.onDidHide(() => {
          resolve(undefined);
          qp.dispose();
        });
        qp.show();
      });

      if (!selected?.bean) {
        return;
      }

      await this.service.updateBean(bean.id, { parent: selected.bean.id });
      vscode.window.showInformationMessage(`Set ${bean.code} parent to ${selected.bean.code}`);
      logger.info(`Set bean ${bean.code} parent to ${selected.bean.code}`);

      // Refresh trees
      await vscode.commands.executeCommand('beans.refreshAll');
    } catch (error) {
      const message = `Failed to set parent: ${(error as Error).message}`;
      logger.error(message, error as Error);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Remove bean parent
   */
  private async removeParent(arg?: Bean | BeanTreeItem): Promise<void> {
    try {
      let bean = await this.resolveBeanAsync(arg);
      if (!bean) {
        bean = await this.pickBean('Select bean to remove parent');
        if (!bean) {
          return;
        }
      }

      if (!bean.parent) {
        vscode.window.showInformationMessage(`${bean.code} has no parent`);
        return;
      }

      const result = await vscode.window.showInformationMessage(
        `Remove parent from ${bean.code}?`,
        { modal: true },
        'Yes',
        'No'
      );

      if (result !== 'Yes') {
        return;
      }

      await this.service.updateBean(bean.id, { clearParent: true });
      vscode.window.showInformationMessage(`Removed parent from ${bean.code}`);
      logger.info(`Removed parent from bean ${bean.code}`);

      // Refresh trees
      await vscode.commands.executeCommand('beans.refreshAll');
    } catch (error) {
      const message = `Failed to remove parent: ${(error as Error).message}`;
      logger.error(message, error as Error);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Edit blocking relationships
   */
  private async editBlocking(arg?: Bean | BeanTreeItem): Promise<void> {
    try {
      let bean = await this.resolveBeanAsync(arg);
      if (!bean) {
        bean = await this.pickBean('Select bean to edit blocking');
        if (!bean) {
          return;
        }
      }

      // Show action menu
      const action = await vscode.window.showQuickPick(
        [
          { label: 'Add Blocking', description: 'This bean blocks other beans', value: 'add-blocking' },
          { label: 'Remove Blocking', description: 'Remove beans this bean blocks', value: 'remove-blocking' },
          { label: 'Add Blocked By', description: 'This bean is blocked by other beans', value: 'add-blocked-by' },
          { label: 'Remove Blocked By', description: 'Remove beans blocking this bean', value: 'remove-blocked-by' },
        ],
        {
          placeHolder: `Manage blocking relationships for ${bean.code}`,
          title: 'Edit Blocking Relationships',
        }
      );

      if (!action) {
        return;
      }

      if (action.value === 'add-blocking') {
        await this.addBlocking(bean);
      } else if (action.value === 'remove-blocking') {
        await this.removeBlocking(bean);
      } else if (action.value === 'add-blocked-by') {
        await this.addBlockedBy(bean);
      } else if (action.value === 'remove-blocked-by') {
        await this.removeBlockedBy(bean);
      }
    } catch (error) {
      const message = `Failed to edit blocking: ${(error as Error).message}`;
      logger.error(message, error as Error);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Add beans that this bean blocks
   */
  private async addBlocking(bean: Bean): Promise<void> {
    const allBeans = await this.service.listBeans();
    const potentialBlocking = allBeans
      .filter(b => {
        if (b.id === bean.id) {
          return false;
        }
        if (bean.blocking?.includes(b.id)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const items = potentialBlocking.map(b => ({
      label: `${this.typeIcon(b.type)} ${b.title}`,
      description: `${b.code} · ${formatLabel(b.type)} · ${formatLabel(b.status)}`,
      bean: b,
      picked: false,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      canPickMany: true,
      placeHolder: `Select beans that ${bean.code} blocks`,
      title: 'Add Blocking',
    });

    if (!selected || selected.length === 0) {
      return;
    }

    const newBlocking = [...(bean.blocking || []), ...selected.map(s => s.bean.id)];
    await this.service.updateBean(bean.id, { blocking: newBlocking });
    vscode.window.showInformationMessage(`Updated blocking relationships for ${bean.code}`);
    logger.info(`Added ${selected.length} blocking relationships to ${bean.code}`);
    await vscode.commands.executeCommand('beans.refreshAll');
  }

  /**
   * Remove beans that this bean blocks
   */
  private async removeBlocking(bean: Bean): Promise<void> {
    if (!bean.blocking || bean.blocking.length === 0) {
      vscode.window.showInformationMessage(`${bean.code} doesn't block any beans`);
      return;
    }

    const allBeans = await this.service.listBeans();
    const blockingBeans = allBeans
      .filter(b => bean.blocking?.includes(b.id))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const items = blockingBeans.map(b => ({
      label: `${this.typeIcon(b.type)} ${b.title}`,
      description: `${b.code} · ${formatLabel(b.type)} · ${formatLabel(b.status)}`,
      bean: b,
      picked: false,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      canPickMany: true,
      placeHolder: `Select beans to remove from blocking`,
      title: 'Remove Blocking',
    });

    if (!selected || selected.length === 0) {
      return;
    }

    const idsToRemove = selected.map(s => s.bean.id);
    const newBlocking = bean.blocking.filter(id => !idsToRemove.includes(id));
    await this.service.updateBean(bean.id, { blocking: newBlocking });
    vscode.window.showInformationMessage(`Removed ${selected.length} blocking relationships from ${bean.code}`);
    logger.info(`Removed ${selected.length} blocking relationships from ${bean.code}`);
    await vscode.commands.executeCommand('beans.refreshAll');
  }

  /**
   * Add beans that block this bean
   */
  private async addBlockedBy(bean: Bean): Promise<void> {
    const allBeans = await this.service.listBeans();
    const potentialBlockedBy = allBeans
      .filter(b => {
        if (b.id === bean.id) {
          return false;
        }
        if (bean.blockedBy?.includes(b.id)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const items = potentialBlockedBy.map(b => ({
      label: `${this.typeIcon(b.type)} ${b.title}`,
      description: `${b.code} · ${formatLabel(b.type)} · ${formatLabel(b.status)}`,
      bean: b,
      picked: false,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      canPickMany: true,
      placeHolder: `Select beans that block ${bean.code}`,
      title: 'Add Blocked By',
    });

    if (!selected || selected.length === 0) {
      return;
    }

    const newBlockedBy = [...(bean.blockedBy || []), ...selected.map(s => s.bean.id)];
    await this.service.updateBean(bean.id, { blockedBy: newBlockedBy });
    vscode.window.showInformationMessage(`Updated blocked-by relationships for ${bean.code}`);
    logger.info(`Added ${selected.length} blocked-by relationships to ${bean.code}`);
    await vscode.commands.executeCommand('beans.refreshAll');
  }

  /**
   * Remove beans that block this bean
   */
  private async removeBlockedBy(bean: Bean): Promise<void> {
    if (!bean.blockedBy || bean.blockedBy.length === 0) {
      vscode.window.showInformationMessage(`${bean.code} isn't blocked by any beans`);
      return;
    }

    const allBeans = await this.service.listBeans();
    const blockedByBeans = allBeans
      .filter(b => bean.blockedBy?.includes(b.id))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const items = blockedByBeans.map(b => ({
      label: `${this.typeIcon(b.type)} ${b.title}`,
      description: `${b.code} · ${formatLabel(b.type)} · ${formatLabel(b.status)}`,
      bean: b,
      picked: false,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      canPickMany: true,
      placeHolder: `Select beans to remove from blocked-by`,
      title: 'Remove Blocked By',
    });

    if (!selected || selected.length === 0) {
      return;
    }

    const idsToRemove = selected.map(s => s.bean.id);
    const newBlockedBy = bean.blockedBy.filter(id => !idsToRemove.includes(id));
    await this.service.updateBean(bean.id, { blockedBy: newBlockedBy });
    vscode.window.showInformationMessage(`Removed ${selected.length} blocked-by relationships from ${bean.code}`);
    logger.info(`Removed ${selected.length} blocked-by relationships from ${bean.code}`);
    await vscode.commands.executeCommand('beans.refreshAll');
  }

  /**
   * Copy bean ID to clipboard
   */
  private async copyId(arg?: Bean | BeanTreeItem): Promise<void> {
    try {
      let bean = await this.resolveBeanAsync(arg);
      if (!bean) {
        bean = await this.pickBean('Select bean to copy ID');
        if (!bean) {
          return;
        }
      }

      await vscode.env.clipboard.writeText(bean.id);
      vscode.window.showInformationMessage(`Copied ${bean.code} ID to clipboard`);
      logger.info(`Copied bean ${bean.code} ID to clipboard`);
    } catch (error) {
      const message = `Failed to copy ID: ${(error as Error).message}`;
      logger.error(message, error as Error);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Delete bean (only for scrapped and draft)
   */
  private async deleteBean(arg?: Bean | BeanTreeItem): Promise<void> {
    try {
      let bean = await this.resolveBeanAsync(arg);
      if (!bean) {
        bean = await this.pickBean('Select bean to delete', ['scrapped', 'draft']);
        if (!bean) {
          return;
        }
      }

      // Verify bean can be deleted
      if (bean.status !== 'scrapped' && bean.status !== 'draft') {
        vscode.window.showWarningMessage(
          `Only scrapped and draft beans can be deleted. ${bean.code} is ${bean.status}.`
        );
        return;
      }

      // Check whether this bean has children
      const allBeans = await this.service.listBeans();
      const children = allBeans.filter(b => b.parent === bean!.id);

      let deleteChildren = false;
      if (children.length > 0) {
        const result = await vscode.window.showWarningMessage(
          `${bean.code} has ${children.length} child bean${children.length === 1 ? '' : 's'}. What should happen to them?`,
          { modal: true },
          'Delete All',
          'Delete Parent Only',
          'Cancel'
        );
        if (!result || result === 'Cancel') {
          return;
        }
        deleteChildren = result === 'Delete All';
      } else {
        const result = await vscode.window.showWarningMessage(
          `Delete bean ${bean.code}: ${bean.title}?`,
          { modal: true },
          'Delete',
          'Cancel'
        );
        if (result !== 'Delete') {
          return;
        }
      }

      if (deleteChildren) {
        const failed: { id: string; code: string; message: string }[] = [];
        for (const child of children) {
          try {
            await this.service.deleteBean(child.id);
            logger.info(`Deleted child bean ${child.code}`);
          } catch (error) {
            const msg = (error as Error).message || String(error);
            logger.warn(`Failed to delete child bean ${child.code}: ${msg}`);
            failed.push({ id: child.id, code: child.code, message: msg });
          }
        }

        if (failed.length > 0) {
          // Abort parent delete if any child deletions failed to avoid leaving an inconsistent state.
          const codes = failed.map(f => f.code).join(', ');
          const detail = failed.map(f => `${f.code}: ${f.message}`).join('; ');
          logger.error(`Aborting parent delete because ${failed.length} child deletions failed: ${detail}`);
          vscode.window
            .showErrorMessage(
              `Failed to delete child beans (${codes}). Parent delete aborted. See output for details.`,
              'Show Output'
            )
            ?.then(selection => {
              if (selection === 'Show Output') {
                logger.show();
              }
            });
          return;
        }
      } else if (children.length > 0) {
        // Orphan children by clearing their parent. Abort if any orphaning fails.
        const failed: { id: string; code: string; message: string }[] = [];
        for (const child of children) {
          try {
            await this.service.updateBean(child.id, { clearParent: true });
            logger.info(`Orphaned child bean ${child.code}`);
          } catch (error) {
            const msg = (error as Error).message || String(error);
            logger.warn(`Failed to orphan child bean ${child.code}: ${msg}`);
            failed.push({ id: child.id, code: child.code, message: msg });
          }
        }

        if (failed.length > 0) {
          const codes = failed.map(f => f.code).join(', ');
          const detail = failed.map(f => `${f.code}: ${f.message}`).join('; ');
          logger.error(`Aborting parent delete because ${failed.length} child orphaning operations failed: ${detail}`);
          vscode.window
            .showErrorMessage(
              `Failed to orphan child beans (${codes}). Parent delete aborted. See output for details.`,
              'Show Output'
            )
            ?.then(selection => {
              if (selection === 'Show Output') {
                logger.show();
              }
            });
          return;
        }
      }

      await this.service.deleteBean(bean.id);
      vscode.window.showInformationMessage(`Deleted bean ${bean.code}`);
      logger.info(`Deleted bean ${bean.code}`);

      // Refresh trees
      await vscode.commands.executeCommand('beans.refreshAll');
    } catch (error) {
      const message = `Failed to delete bean: ${(error as Error).message}`;
      logger.error(message, error as Error);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Filter beans
   */
  private async filter(): Promise<void> {
    try {
      // Get the active tree view ID from the currently focused view
      // Note: We'll apply filter to all views for now
      const viewId = 'beans.active'; // Default to active view

      const currentFilter = this.filterManager.getFilter(viewId);
      const newFilter = await this.filterManager.showFilterUI(currentFilter);

      if (newFilter) {
        this.filterManager.setFilter(viewId, newFilter);
      }
    } catch (error) {
      const message = `Failed to apply filter: ${(error as Error).message}`;
      logger.error(message, error as Error);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Search beans in the Search pane.
   * The Search pane performs full-field matching via BeansSearchTreeProvider.
   */
  private async search(): Promise<void> {
    try {
      const searchText = await vscode.window.showInputBox({
        prompt: 'Search beans across all fields',
        placeHolder: 'Enter search text',
        title: 'Search Beans',
      });

      if (searchText === undefined) {
        return; // User cancelled
      }

      // Focus Beans activity bar and route search to the dedicated Search pane.
      await vscode.commands.executeCommand('workbench.view.extension.beans');

      const viewId = 'beans.search';
      const currentFilter = this.filterManager.getFilter(viewId) || {};

      if (!searchText) {
        const updatedFilter = { ...currentFilter };
        delete updatedFilter.text;
        this.filterManager.setFilter(viewId, updatedFilter);
        vscode.window.showInformationMessage('Search cleared');
      } else {
        this.filterManager.setFilter(viewId, {
          ...currentFilter,
          text: searchText,
        });
        vscode.window.showInformationMessage(`Searching for: "${searchText}"`);
      }

      logger.info(`Search applied in Search pane: ${searchText || '(cleared)'}`);
    } catch (error) {
      const message = `Failed to search: ${(error as Error).message}`;
      logger.error(message, error as Error);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Sort beans
   */
  private async sort(): Promise<void> {
    try {
      const sortMode = await vscode.window.showQuickPick(
        [
          { label: 'Status → Priority → Type → Title', value: 'status-priority-type-title' },
          { label: 'Recently Updated', value: 'updated' },
          { label: 'Recently Created', value: 'created' },
          { label: 'Bean ID', value: 'id' },
        ],
        {
          placeHolder: 'Select sort mode',
          title: 'Sort Beans',
        }
      );

      if (sortMode) {
        // Update configuration
        await vscode.workspace
          .getConfiguration('beans')
          .update('defaultSortMode', sortMode.value, vscode.ConfigurationTarget.Workspace);

        vscode.window.showInformationMessage(`Sort mode changed to: ${sortMode.label}`);
        logger.info(`Sort mode changed to ${sortMode.value}`);

        // Refresh all trees to apply sort
        await vscode.commands.executeCommand('beans.refreshAll');
      }
    } catch (error) {
      const message = `Failed to change sort mode: ${(error as Error).message}`;
      logger.error(message, error as Error);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Helper to pick a bean from quick pick
   */
  private async pickBean(
    prompt: string,
    statusFilter?: string[],
    includeClosedBeans = false
  ): Promise<Bean | undefined> {
    const beans = await this.service.listBeans();

    // Apply status filter if provided
    let filteredBeans = statusFilter ? beans.filter(b => statusFilter.includes(b.status)) : beans;

    // Hide completed and scrapped beans unless explicitly included
    if (!includeClosedBeans) {
      const hideClosedInQuickPick = vscode.workspace
        .getConfiguration('beans')
        .get<boolean>('hideClosedInQuickPick', true);

      if (hideClosedInQuickPick && !statusFilter) {
        filteredBeans = filteredBeans.filter(b => b.status !== 'completed' && b.status !== 'scrapped');
      }
    }

    if (filteredBeans.length === 0) {
      vscode.window.showInformationMessage('No beans available');
      return undefined;
    }

    const items = filteredBeans.map(bean => ({
      label: `${this.beanPickerIcon(bean)} ${bean.title}`,
      description: bean.code,
      bean,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: prompt,
      matchOnDescription: true,
    });

    return selected?.bean;
  }

  /**
   * Open .beans.yml configuration file
   */
  private async openConfig(): Promise<void> {
    try {
      await this.configManager.open();
    } catch (error) {
      const message = `Failed to open config: ${(error as Error).message}`;
      logger.error(message, error as Error);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Open VS Code settings filtered to this extension.
   */
  private async openExtensionSettings(): Promise<void> {
    try {
      await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:selfagency.beans-vscode');
    } catch (error) {
      const message = `Failed to open extension settings: ${(error as Error).message}`;
      logger.error(message, error as Error);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Open user guide documentation
   */
  private async openUserGuide(): Promise<void> {
    // Try to find user-guide.md in the extension's docs folder
    const extensionPath = this.context.extensionUri;
    const docPath = vscode.Uri.joinPath(extensionPath, 'docs', 'user-guide.md');

    try {
      // Open in markdown preview
      await vscode.commands.executeCommand('markdown.showPreview', docPath);
    } catch (error) {
      // Fallback: open as text document
      try {
        await vscode.window.showTextDocument(docPath);
      } catch (openError) {
        logger.error('Failed to open user guide', openError as Error);
        vscode.window.showErrorMessage(
          'Failed to open user guide. The documentation may be missing from the extension.'
        );
      }
    }
  }

  /**
   * Open AI features documentation
   */
  private async openAiFeaturesGuide(): Promise<void> {
    const extensionPath = this.context.extensionUri;
    const docPath = vscode.Uri.joinPath(extensionPath, 'docs', 'ai-features.md');

    try {
      await vscode.commands.executeCommand('markdown.showPreview', docPath);
    } catch {
      try {
        await vscode.window.showTextDocument(docPath);
      } catch (openError) {
        logger.error('Failed to open AI features guide', openError as Error);
        vscode.window.showErrorMessage(
          'Failed to open AI features guide. The documentation may be missing from the extension.'
        );
      }
    }
  }
}
