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
  const dragAndDropController = new BeansDragAndDropController(service);

  const activeProvider = new ActiveBeansProvider(service);
  const completedProvider = new CompletedBeansProvider(service);
  const draftProvider = new DraftBeansProvider(service);
  const searchProvider = new BeansSearchTreeProvider(service);

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

  const activeTreeView = vscode.window.createTreeView<BeanTreeItem>('beans.active', {
    treeDataProvider: activeProvider,
    showCollapseAll: true,
    dragAndDropController,
  });

  const searchTreeView = vscode.window.createTreeView<BeanTreeItem>('beans.search', {
    treeDataProvider: searchProvider,
    showCollapseAll: false,
  });

  const applySearchFilterCmd = vscode.commands.registerCommand('beans.searchView.filter', async () => {
    try {
      const current = manager.getFilter('beans.search');
      const newFilter = await showSearchFilterUI(current);
      if (newFilter) {
        manager.setFilter('beans.search', newFilter);
        searchProvider.setFilter(newFilter);
      }
    } catch (error) {
      logger.error('Failed to apply search filter', error as Error);
    }
  });

  const clearSearchFilterCmd = vscode.commands.registerCommand('beans.searchView.clear', () => {
    try {
      manager.clearFilter('beans.search');
      searchProvider.setFilter(undefined);
      vscode.window.showInformationMessage('Search filters cleared');
    } catch (error) {
      logger.error('Failed to clear search filters', error as Error);
    }
  });

  context.subscriptions.push(applySearchFilterCmd, clearSearchFilterCmd);

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

  context.subscriptions.push(
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

  logger.info('Tree views registered with drag-and-drop support and details view integration');

  return {
    activeProvider,
    completedProvider,
    draftProvider,
  };
}
