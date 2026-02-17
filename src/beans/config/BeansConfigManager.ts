import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import * as path from 'path';
import * as vscode from 'vscode';
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
   * Read and parse .beans.yml config using js-yaml
   */
  async read(): Promise<BeansConfig | null> {
    try {
      const configFile = await vscode.workspace.findFiles('.beans.yml', null, 1);
      if (configFile.length === 0) {
        return null;
      }

      const document = await vscode.workspace.openTextDocument(configFile[0]);
      const content = document.getText();

      // Parse YAML using js-yaml with safe schema
      // CORE_SCHEMA is safer than DEFAULT_SCHEMA (no custom types/functions/eval)
      const parsed = yaml.load(content, {
        schema: yaml.CORE_SCHEMA,
        json: false,
      });

      // Validate that parsed content is an object
      if (!parsed || typeof parsed !== 'object') {
        this.logger.warn('.beans.yml parsed to non-object value');
        return null;
      }

      // Extract the 'beans' root key to match .beans.yml structure
      const beansConfig = (parsed as any).beans;
      if (!beansConfig || typeof beansConfig !== 'object') {
        this.logger.warn('.beans.yml missing "beans" root key');
        return null;
      }

      return beansConfig as BeansConfig;
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
