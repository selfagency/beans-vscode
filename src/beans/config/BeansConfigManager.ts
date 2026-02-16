import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BeansOutput } from '../logging';
import { BeansConfig } from '../model';

/**
 * Manager for reading and writing .beans.yml configuration
 * Provides safe config operations with validation
 */
export class BeansConfigManager {
  private readonly logger = BeansOutput.getInstance();
  private readonly configPath: string;

  constructor(workspaceRoot: string) {
    this.configPath = path.join(workspaceRoot, '.beans.yml');
  }

  /**
   * Check if .beans.yml exists
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read and parse .beans.yml config
   */
  async read(): Promise<BeansConfig | null> {
    try {
      const configFile = await vscode.workspace.findFiles('.beans.yml', null, 1);
      if (configFile.length === 0) {
        return null;
      }

      const document = await vscode.workspace.openTextDocument(configFile[0]);
      const content = document.getText();

      // Basic YAML parsing - VS Code doesn't include a YAML parser by default
      // For production, consider using js-yaml or similar
      const config = this.parseBasicYaml(content);
      return config;
    } catch (error) {
      this.logger.error('Failed to read .beans.yml:', error as Error);
      return null;
    }
  }

  /**
   * Open .beans.yml in editor
   */
  async open(): Promise<void> {
    try {
      const configFiles = await vscode.workspace.findFiles('.beans.yml', null, 1);
      if (configFiles.length === 0) {
        vscode.window.showWarningMessage('.beans.yml not found in workspace');
        return;
      }

      const document = await vscode.workspace.openTextDocument(configFiles[0]);
      await vscode.window.showTextDocument(document);
      this.logger.info('Opened .beans.yml in editor');
    } catch (error) {
      const message = `Failed to open .beans.yml: ${(error as Error).message}`;
      this.logger.error(message, error as Error);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Parse basic YAML content into BeansConfig
   * This is a simple parser - for production use js-yaml
   */
  private parseBasicYaml(content: string): BeansConfig {
    const config: Partial<BeansConfig> = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || trimmed === '') {
        continue;
      }

      // Parse statuses array
      if (trimmed.startsWith('statuses:')) {
        config.statuses = [];
        continue;
      }

      // Parse types array
      if (trimmed.startsWith('types:')) {
        config.types = [];
        continue;
      }

      // Parse priorities array
      if (trimmed.startsWith('priorities:')) {
        config.priorities = [];
        continue;
      }

      // Parse array items
      if (trimmed.startsWith('- ')) {
        const value = trimmed.substring(2).trim();
        if (config.statuses && !config.types && !config.priorities) {
          config.statuses.push(value as any);
        } else if (config.types && !config.priorities) {
          config.types.push(value as any);
        } else if (config.priorities) {
          config.priorities.push(value as any);
        }
      }
    }

    return config as BeansConfig;
  }

  /**
   * Update .beans.yml with new values
   * For now, this opens the file for manual editing
   * In the future, could provide programmatic updates
   */
  async update(): Promise<void> {
    await this.open();
    vscode.window.showInformationMessage(
      'Please edit .beans.yml and save. Changes will be reflected after save.',
      'OK'
    );
  }
}
