export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2
}

export class TreeItem {
  label?: string;
  description?: string;
  tooltip?: unknown;
  contextValue?: string;
  iconPath?: unknown;
  command?: { command: string; title: string; arguments?: unknown[] };

  constructor(
    label?: string,
    public readonly collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.None
  ) {
    this.label = label;
  }
}

export class ThemeColor {
  constructor(public readonly id: string) {}
}

export class ThemeIcon {
  constructor(public readonly id: string, public readonly color?: ThemeColor) {}
}

export class MarkdownString {
  value = '';
  supportHtml = false;
  isTrusted = false;

  appendMarkdown(text: string): void {
    this.value += text;
  }
}

export class Uri {
  constructor(
    public scheme: string,
    public authority: string,
    public path: string,
    public query: string,
    public fragment: string
  ) {}

  static file(path: string): Uri {
    return new Uri('file', '', path, '', '');
  }

  static parse(value: string): Uri {
    return new Uri('file', '', value, '', '');
  }

  static joinPath(uri: Uri, ...pathSegments: string[]): Uri {
    const joined = [uri.path, ...pathSegments].join('/').replace(/\/+/g, '/');
    return new Uri(uri.scheme, uri.authority, joined, uri.query, uri.fragment);
  }

  get fsPath(): string {
    return this.path;
  }
}

class OutputChannel {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  append(_value: string): void {
    // no-op
  }

  appendLine(_value: string): void {
    // no-op
  }

  clear(): void {
    // no-op
  }

  show(): void {
    // no-op
  }

  hide(): void {
    // no-op
  }

  dispose(): void {
    // no-op
  }
}

export const window = {
  showInformationMessage: (_message: string): void => {
    // no-op mock
  },
  showErrorMessage: (_message: string): void => {
    // no-op mock
  },
  showWarningMessage: (_message: string): void => {
    // no-op mock
  },
  createOutputChannel: (name: string): OutputChannel => {
    return new OutputChannel(name);
  },
  registerWebviewViewProvider: (): { dispose: () => void } => {
    return { dispose: () => {} };
  },
  registerTreeDataProvider: (): { dispose: () => void } => {
    return { dispose: () => {} };
  }
};

export const workspace = {
  workspaceFolders: undefined as any,
  getConfiguration: (): any => ({
    get: () => undefined,
    has: () => false,
    inspect: () => undefined,
    update: () => Promise.resolve()
  }),
  findFiles: (): Promise<Uri[]> => Promise.resolve([]),
  registerTextDocumentContentProvider: (): { dispose: () => void } => {
    return { dispose: () => {} };
  },
  createFileSystemWatcher: (): any => ({
    onDidCreate: () => ({ dispose: () => {} }),
    onDidChange: () => ({ dispose: () => {} }),
    onDidDelete: () => ({ dispose: () => {} }),
    dispose: () => {}
  }),
  onDidChangeConfiguration: (): { dispose: () => void } => {
    return { dispose: () => {} };
  }
};

export const commands = {
  registerCommand: (): { dispose: () => void } => {
    return { dispose: () => {} };
  },
  executeCommand: (): Promise<any> => Promise.resolve()
};

export const env = {
  openExternal: (): Promise<boolean> => Promise.resolve(true)
};

export class RelativePattern {
  constructor(public base: any, public pattern: string) {}
}

export class EventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];

  get event() {
    return (listener: (e: T) => void) => {
      this.listeners.push(listener);
      return { dispose: () => {} };
    };
  }

  fire(data: T): void {
    this.listeners.forEach((listener) => listener(data));
  }

  dispose(): void {
    this.listeners = [];
  }
}

export interface Event<T> {
  (listener: (e: T) => any): { dispose(): void };
}

export class McpStdioServerDefinition {
  constructor(
    public readonly label: string,
    public readonly command: string,
    public readonly args: string[],
    public readonly env?: Record<string, string | number | null>,
    public readonly version?: string
  ) {}
}
