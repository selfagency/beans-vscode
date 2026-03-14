// Type shim for @selfagency/beans-mcp (package currently ships CJS without .d.ts)
// Keep this in sync with imports used by BeansMcpServer.ts.
declare module '@selfagency/beans-mcp' {
  export function startBeansMcpServer(argv: string[]): Promise<void>;
  export function parseCliArgs(argv: string[]): {
    workspaceRoot: string;
    workspaceExplicit: boolean;
    cliPath: string;
    port: number;
    logDir: string;
  };
  export function sortBeans<T extends { [key: string]: unknown }>(beans: T[], mode: string): T[];
  export function isPathWithinRoot(root: string, target: string): boolean;
}
