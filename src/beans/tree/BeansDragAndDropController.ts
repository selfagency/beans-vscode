import * as vscode from 'vscode';
import { BeansOutput } from '../logging';
import { Bean, BeanStatus, VALID_PARENT_TYPES, getUserMessage } from '../model';
import { BeansService } from '../service';
import { BeanTreeItem } from './BeanTreeItem';

const logger = BeansOutput.getInstance();

/**
 * Drag and drop controller for re-parenting beans via tree view drag/drop
 */
export class BeansDragAndDropController implements vscode.TreeDragAndDropController<BeanTreeItem> {
  dropMimeTypes = ['application/vnd.code.tree.beans'];
  dragMimeTypes = ['application/vnd.code.tree.beans'];

  constructor(
    private readonly service: BeansService,
    private readonly targetStatus: BeanStatus | null = null,
    private readonly nativeStatuses: BeanStatus[] = []
  ) {
    // Touch to avoid TS6138 unused private property errors until the params are used
    void this.targetStatus;
    void this.nativeStatuses;
  }

  /**
   * Handle drag operation - add bean to data transfer
   */
  public async handleDrag(
    source: readonly BeanTreeItem[],
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {
    if (token.isCancellationRequested) {
      return;
    }

    // Only support dragging single beans
    if (source.length !== 1) {
      return;
    }

    const bean = source[0].bean;
    // Set multiple mime types so the payload survives view/process boundaries.
    dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(bean));
    try {
      dataTransfer.set('application/json', new vscode.DataTransferItem(JSON.stringify(bean)));
    } catch (e) {
      // JSON serialization may fail for circular structures; ignore and continue
    }
    // Also include id as plain text for the simplest cross-process lookup
    if (bean.id) {
      dataTransfer.set('text/plain', new vscode.DataTransferItem(bean.id));
    }

    logger.debug(`Drag started for bean ${bean.code}`);
  }

  /**
   * Handle drop operation - re-parent bean
   */
  public async handleDrop(
    target: BeanTreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {
    if (token.isCancellationRequested) {
      return;
    }

    const transferItem = dataTransfer.get('application/vnd.code.tree.beans');
    if (!transferItem) {
      return;
    }

    // The transfer payload may be either the full Bean object (in-process) or
    // a string id (when crossing views / processes). Normalize to a full
    // Bean by loading from the service when an id is provided.
    let raw = transferItem.value as unknown;
    let draggedBean: Bean;

    if (typeof raw === 'string') {
      if (raw.trim() === '') {
        // Some environments serialize complex objects to an empty string. Try
        // alternative common mime types before bailing.
        const altTypes = ['application/json', 'text/plain', 'text'];
        let found: string | undefined;
        for (const t of altTypes) {
          const alt = dataTransfer.get(t);
          if (!alt) {
            continue;
          }
          const v = alt.value as any;
          if (typeof v === 'string' && v.trim() !== '') {
            found = v;
            break;
          }
          if (v && typeof v.value === 'string' && v.value.trim() !== '') {
            found = v.value;
            break;
          }
        }

        if (found) {
          // Use the found alternative payload
          raw = found;
        } else {
          // Avoid calling showBean with empty id — surface helpful message and abort
          logger.error('Dragged payload is empty');
          vscode.window.showErrorMessage('Dragged bean data is empty; cannot complete drop');
          return;
        }
      }
      // The string payload can be either a serialized Bean (JSON) or an id.
      // Try to parse JSON first; if parsing fails, treat as id and fetch.
      try {
        const parsed = JSON.parse(raw as string);
        if (parsed && typeof parsed === 'object') {
          // Prefer explicit id, fall back to slug/code if present
          const candidateId = (parsed.id || parsed.slug || parsed.code) as string | undefined;
          if (candidateId && String(candidateId).trim() !== '') {
            // If parsed contains full bean fields, use it directly; otherwise
            // fetch the canonical bean by id/slug/code to ensure fresh data.
            if (parsed.id && String(parsed.id).trim() !== '') {
              draggedBean = parsed as Bean;
            } else {
              draggedBean = await this.service.showBean(candidateId);
            }
          } else {
            logger.error('Dragged payload JSON missing id/slug/code');
            vscode.window.showErrorMessage('Dragged bean data is missing an id; cannot complete drop');
            return;
          }
        } else {
          // Not an object – treat as id string
          draggedBean = await this.service.showBean(raw as string);
        }
      } catch (err) {
        // Not JSON — treat as id
        try {
          draggedBean = await this.service.showBean(raw as string);
        } catch (showErr) {
          const message = getUserMessage(showErr);
          logger.error(`Failed to resolve dragged bean id: ${message}`, showErr as Error);
          // Surface a user-friendly error and abort the drop
          vscode.window.showErrorMessage(`Failed to load bean for drag operation: ${message}`);
          return;
        }
      }
    } else {
      draggedBean = raw as Bean;
    }
    const targetBean = target?.bean;

    // Detect cross-pane drops: targetStatus !== null && dragged status not native to this pane
    const isCrossPane = this.targetStatus !== null && !this.nativeStatuses.includes(draggedBean.status);

    if (isCrossPane) {
      await this.handleCrossPaneDrop(draggedBean, targetBean);
      return;
    }

    // Default: intra-pane reparent behavior
    await this.handleReparentDrop(draggedBean, targetBean);
  }

  /**
   * Existing re-parent behavior extracted for clarity
   */
  private async handleReparentDrop(draggedBean: Bean, targetBean: Bean | undefined): Promise<void> {
    // Validate drop
    const validation = await this.validateDrop(draggedBean, targetBean);
    if (!validation.valid) {
      vscode.window.showErrorMessage(validation.reason || 'Invalid drop operation');
      return;
    }

    // Confirm re-parenting
    const confirmed = await this.confirmReparent(draggedBean, targetBean);
    if (!confirmed) {
      return;
    }

    // Perform re-parent
    try {
      await this.reparentBean(draggedBean, targetBean);
      const draggedName = draggedBean.title || draggedBean.code || draggedBean.id;
      const targetName = targetBean ? targetBean.title : 'root';
      vscode.window.showInformationMessage(`${draggedName} moved to ${targetName}`);
      await vscode.commands.executeCommand('beans.refreshAll');
    } catch (error) {
      const message = getUserMessage(error);
      logger.error(message, error as Error);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Handle cross-pane drops (background -> change status)
   */
  private async handleCrossPaneDrop(draggedBean: Bean, targetBean: Bean | undefined): Promise<void> {
    const draggedName = draggedBean.title || draggedBean.code || draggedBean.id;

    // Background drop: change status only
    if (!targetBean) {
      const choice = await vscode.window.showInformationMessage(
        `Set "${draggedName}" to ${this.targetStatus}?`,
        { modal: true },
        'Set Status'
      );

      if (!choice) {
        return;
      }

      try {
        await this.service.updateBean(draggedBean.id, { status: this.targetStatus! });
        vscode.window.showInformationMessage(`${draggedName} set to ${this.targetStatus}`);
        await vscode.commands.executeCommand('beans.refreshAll');
      } catch (error) {
        const message = getUserMessage(error);
        logger.error(message, error as Error);
        vscode.window.showErrorMessage(message);
      }

      return;
    }

    // Dropped on another bean — show prompt with options
    if (draggedBean.id === targetBean.id) {
      vscode.window.showErrorMessage('Cannot make a bean its own parent');
      return;
    }

    const targetCode = targetBean.code || targetBean.id;
    const moveLabel = `Change Status & Move to ${targetCode}`;
    const choice = await vscode.window.showInformationMessage(
      `Set "${draggedName}" to ${this.targetStatus}?`,
      { modal: true },
      'Change Status Only',
      moveLabel
    );

    if (!choice) {
      return;
    }

    if (choice === moveLabel) {
      // Validate re-parent before applying
      const validation = await this.validateDrop(draggedBean, targetBean);
      if (!validation.valid) {
        vscode.window.showErrorMessage(validation.reason || 'Invalid drop operation');
        return;
      }

      try {
        await this.service.updateBean(draggedBean.id, { status: this.targetStatus!, parent: targetBean.id });
        vscode.window.showInformationMessage(`${draggedName} set to ${this.targetStatus}`);
        await vscode.commands.executeCommand('beans.refreshAll');
      } catch (error) {
        const message = getUserMessage(error);
        logger.error(message, error as Error);
        vscode.window.showErrorMessage(message);
      }
    } else {
      // Change status only
      try {
        await this.service.updateBean(draggedBean.id, { status: this.targetStatus! });
        vscode.window.showInformationMessage(`${draggedName} set to ${this.targetStatus}`);
        await vscode.commands.executeCommand('beans.refreshAll');
      } catch (error) {
        const message = getUserMessage(error);
        logger.error(message, error as Error);
        vscode.window.showErrorMessage(message);
      }
    }
  }

  /**
   * Validate drop operation to prevent cycles and invalid operations
   */
  private async validateDrop(
    draggedBean: Bean,
    targetBean: Bean | undefined
  ): Promise<{ valid: boolean; reason?: string }> {
    // Can't drop on self
    if (targetBean && draggedBean.id === targetBean.id) {
      return { valid: false, reason: 'Cannot make a bean its own parent' };
    }

    // If dropping on root (no target), always valid
    if (!targetBean) {
      return { valid: true };
    }

    // Validate type hierarchy: check whether targetBean's type is a valid parent
    // for the dragged bean's type. Unknown types (custom configs) are allowed through.
    const allowedParents = VALID_PARENT_TYPES[draggedBean.type];
    if (allowedParents && !allowedParents.includes(targetBean.type)) {
      return {
        valid: false,
        reason: `A ${draggedBean.type} cannot have a ${targetBean.type} as parent. Allowed parent types: ${allowedParents.join(', ')}.`,
      };
    }

    // Prevent cycles: target bean cannot be a descendant of dragged bean
    const isDescendant = await this.isDescendantOf(targetBean, draggedBean);
    if (isDescendant) {
      return {
        valid: false,
        reason: `Cannot create cycle: ${targetBean.code} is a descendant of ${draggedBean.code}`,
      };
    }

    return { valid: true };
  }

  /**
   * Check if a bean is a descendant of another bean
   */
  private async isDescendantOf(bean: Bean, potentialAncestor: Bean): Promise<boolean> {
    // Check if bean has potentialAncestor in its parent chain
    let current: Bean | undefined = bean;

    // Protect against corrupted parent chains / cycles by capping traversal depth.
    let depth = 0;
    const MAX_DEPTH = 5;

    while (current?.parent) {
      // Bail out early if we suspect a cycle or excessively deep chain
      if (++depth > MAX_DEPTH) {
        logger.warn(`Parent chain exceeded max depth (${MAX_DEPTH}), aborting descendant check`);
        return false;
      }

      if (current.parent === potentialAncestor.id) {
        return true;
      }

      // Fetch parent bean
      try {
        current = await this.service.showBean(current.parent);
      } catch (error) {
        logger.warn(`Failed to fetch parent bean ${current.parent}`, error as Error);
        return false;
      }
    }

    return false;
  }

  /**
   * Show confirmation dialog for re-parenting
   */
  private async confirmReparent(draggedBean: Bean, targetBean: Bean | undefined): Promise<boolean> {
    const draggedName = draggedBean.title || draggedBean.code || draggedBean.id;
    const targetName = targetBean ? targetBean.title : 'root (no parent)';
    const result = await vscode.window.showInformationMessage(
      `Move ${draggedName} to ${targetName}?`,
      { modal: true },
      'Move'
    );

    return result === 'Move';
  }

  /**
   * Perform the re-parent operation
   */
  private async reparentBean(bean: Bean, newParent: Bean | undefined): Promise<void> {
    const updates = newParent ? { parent: newParent.id } : { clearParent: true };
    await this.service.updateBean(bean.id, updates);

    const beanName = bean.title || bean.code || bean.id;
    const parentName = newParent ? newParent.title || newParent.code || newParent.id : 'root';
    logger.info(`Bean ${beanName} moved to ${parentName}`);
  }
}
