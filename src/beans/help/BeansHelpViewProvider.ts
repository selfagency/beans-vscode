import * as vscode from 'vscode';

/**
 * Webview view provider for static help and support links.
 */
export class BeansHelpViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'beans.help';

  constructor(private readonly extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    webviewView.webview.options = {
      enableScripts: false,
      enableCommandUris: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml();
  }

  private getHtml(): string {
    const csp = ["default-src 'none'", "style-src 'unsafe-inline'", 'img-src https: data:'].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <title>Beans Help</title>
  <style>
    body {
      padding: 12px;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      line-height: 1.5;
    }

    h2 {
      margin: 0 0 8px;
      font-size: 13px;
      font-weight: 600;
    }

    h3 {
      margin: 14px 0 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    p {
      margin: 0 0 8px;
    }

    ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 6px;
    }

    li {
      margin: 0;
    }

    a {
      color: var(--vscode-textLink-foreground);
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .button-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 8px 0 0;
    }

    .button-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      text-decoration: none;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.2;
    }

    .button-link.secondary {
      background: var(--vscode-button-secondaryBackground, var(--vscode-editorWidget-background));
      color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
      border-color: var(--vscode-widget-border, var(--vscode-button-border, transparent));
    }

    .button-link:hover {
      background: var(--vscode-button-hoverBackground);
      color: var(--vscode-button-foreground);
    }

    .button-link.secondary:hover {
      background: var(--vscode-toolbar-hoverBackground, var(--vscode-list-hoverBackground));
      color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    }

    a:hover {
      color: var(--vscode-textLink-activeForeground, var(--vscode-textLink-foreground));
    }

    a:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 2px;
      border-radius: 2px;
    }

    .note {
      margin-top: 14px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
  </style>
</head>
<body>
  <h3>Documentation</h3>
  <div class="button-row">
    <a class="button-link" href="command:beans.openUserGuide">User guide</a>
    <a class="button-link secondary" href="command:beans.openAiFeaturesGuide">AI features guide</a>
  </div>

  <h3>Support</h3>
  <p>Need some help? Something broken? Open an issue!</p>
  <div class="button-row">
    <a class="button-link" href="https://github.com/selfagency/beans-vscode/issues/new/choose">Open an issue</a>
  </div>

  <h3>About Beans</h3>
  <p>Beans is a lightweight issue tracker that stores tasks, bugs, and features as Markdown files in a ⁠.beans folder, making them easy to version control and letting both humans and machines edit them. A CLI, built-in TUI, and GraphQL interface let you—or your AI coding agent—create, query, archive, and auto-generate roadmaps while using completed beans as project memory.</p>

  <div class="button-row">
    <a class="button-link secondary" href="https://github.com/hmans/beans">Beans on GitHub</a>
  </div>

  <p class="note">Special thanks to Hendrik Mans for creating Beans.</p>
</body>
</html>`;
  }
}
