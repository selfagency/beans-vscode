import * as vscode from 'vscode';
import { BeansDetailsViewProvider } from '../details';
import { BeansOutput } from '../logging';
import { Bean, BeanType } from '../model';
import { BeansSearchTreeProvider } from '../search/BeansSearchTreeProvider';
import { showSearchFilterUI } from '../search/SearchFilterUI';
import { BeansService } from '../service';
import { BeanTreeItem } from './BeanTreeItem';
import { BeansDragAndDropController } from './BeansDragAndDropController';
import { BeansFilterManager } from './BeansFilterManager';
import { ActiveBeansProvider, CompletedBeansProvider, DraftBeansProvider } from './providers';

export interface RegisteredBeanProviders {
  activeProvider: ActiveBeansProvider;
  completedProvider: CompletedBeansProvider;
  draftProvider: DraftBeansProvider;
}

export function registerBeansTreeViews(
  context: vscode.ExtensionContext,
  service: BeansService,
  manager: BeansFilterManager,
  details: BeansDetailsViewProvider,
  logger: BeansOutput
): RegisteredBeanProviders {
  const baseTitles = {
    active: 'Open Beans',
    completed: 'Completed',
    draft: 'Drafts',
    search: 'Search',
  } as const;

  const dragAndDropController = new BeansDragAndDropController(service);

  const activeProvider = new ActiveBeansProvider(service);
  const completedProvider = new CompletedBeansProvider(service);
  const draftProvider = new DraftBeansProvider(service);
  const searchProvider = new BeansSearchTreeProvider(service);

  const activeTreeView = vscode.window.createTreeView<BeanTreeItem>('beans.active', {
    treeDataProvider: activeProvider,
    showCollapseAll: true,
    dragAndDropController,
  });

  const searchTreeView = vscode.window.createTreeView<BeanTreeItem>('beans.search', {
    treeDataProvider: searchProvider,
    showCollapseAll: false,
  });

  const completedTreeView = vscode.window.createTreeView<BeanTreeItem>('beans.completed', {
    treeDataProvider: completedProvider,
    showCollapseAll: true,
    dragAndDropController,
  });

  const draftTreeView = vscode.window.createTreeView<BeanTreeItem>('beans.draft', {
    treeDataProvider: draftProvider,
    showCollapseAll: true,
    dragAndDropController,
  });

  const shouldShowCounts = (): boolean => {
    return vscode.workspace.getConfiguration('beans').get<boolean>('view.showCounts', true);
  };

  const formatTitle = (baseTitle: string, count: number): string => {
    return shouldShowCounts() ? `${baseTitle} (${count})` : baseTitle;
  };

  const applyCountTitles = (): void => {
    draftTreeView.title = formatTitle(baseTitles.draft, draftProvider.getVisibleCount());
    activeTreeView.title = formatTitle(baseTitles.active, activeProvider.getVisibleCount());
    completedTreeView.title = formatTitle(baseTitles.completed, completedProvider.getVisibleCount());
    searchTreeView.title = formatTitle(baseTitles.search, searchProvider.getVisibleCount());
  };

  const refreshCountTitles = (): void => {
    try {
      applyCountTitles();
    } catch (error) {
      logger.warn('Failed to refresh bean counts for side panel headers', error as Error);
    }
  };

  context.subscriptions.push(
    manager.onDidChangeFilter(viewId => {
      const filter = manager.getFilter(viewId);
      const filterOptions = filter
        ? {
            searchFilter: filter.text,
            tagFilter: filter.tags,
            typeFilter: filter.types as BeanType[] | undefined,
          }
        : {};

      switch (viewId) {
        case 'beans.active':
          activeProvider.setFilter(filterOptions);
          break;
        case 'beans.search':
          searchProvider.setFilter(manager.getFilter(viewId));
          break;
        case 'beans.completed':
          completedProvider.setFilter(filterOptions);
          break;
        case 'beans.draft':
          draftProvider.setFilter(filterOptions);
          break;
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('beans.openBean', (bean: Bean) => {
      if (bean) {
        details.showBean(bean).catch(error => {
          logger.error('Failed to show bean details', error as Error);
        });
      }
    })
  );

  const applySearchFilterCmd = vscode.commands.registerCommand('beans.searchView.filter', async () => {
    try {
      const current = manager.getFilter('beans.search');
      const newFilter = await showSearchFilterUI(current);
      if (newFilter) {
        manager.setFilter('beans.search', newFilter);
      }
    } catch (error) {
      logger.error('Failed to apply search filter', error as Error);
    }
  });

  const clearSearchFilterCmd = vscode.commands.registerCommand('beans.searchView.clear', async () => {
    try {
      manager.clearFilter('beans.search');
      vscode.window.showInformationMessage('Search filters cleared');
    } catch (error) {
      logger.error('Failed to clear search filters', error as Error);
    }
  });

  context.subscriptions.push(applySearchFilterCmd, clearSearchFilterCmd);

  context.subscriptions.push(
    activeProvider.onDidChangeTreeData(() => {
      void refreshCountTitles();
    }),
    completedProvider.onDidChangeTreeData(() => {
      void refreshCountTitles();
    }),
    draftProvider.onDidChangeTreeData(() => {
      void refreshCountTitles();
    }),
    searchProvider.onDidChangeTreeData(() => {
      void refreshCountTitles();
    }),
    activeTreeView.onDidChangeSelection(e => {
      if (e.selection.length > 0) {
        const bean = e.selection[0].bean;
        if (bean) {
          details.showBean(bean).catch(error => {
            logger.error('Failed to show bean details', error as Error);
          });
        }
      }
    }),
    completedTreeView.onDidChangeSelection(e => {
      if (e.selection.length > 0) {
        const bean = e.selection[0].bean;
        if (bean) {
          details.showBean(bean).catch(error => {
            logger.error('Failed to show bean details', error as Error);
          });
        }
      }
    }),
    draftTreeView.onDidChangeSelection(e => {
      if (e.selection.length > 0) {
        const bean = e.selection[0].bean;
        if (bean) {
          details.showBean(bean).catch(error => {
            logger.error('Failed to show bean details', error as Error);
          });
        }
      }
    }),
    searchTreeView.onDidChangeSelection(e => {
      if (e.selection.length > 0) {
        const bean = e.selection[0].bean;
        if (bean) {
          details.showBean(bean).catch(error => {
            logger.error('Failed to show bean details', error as Error);
          });
        }
      }
    })
  );

  context.subscriptions.push(activeTreeView, completedTreeView, draftTreeView, searchTreeView);

  applyCountTitles();
  if (activeTreeView.visible || completedTreeView.visible || draftTreeView.visible || searchTreeView.visible) {
    // Only trigger the potentially expensive count refresh if any view is visible
    void refreshCountTitles();
  }

  logger.info('Tree views registered with drag-and-drop support and details view integration');

  return {
    activeProvider,
    completedProvider,
    draftProvider,
  };
}
