// Type shim for @selfagency/beans-mcp.
// The package currently resolves to CJS in this TS config, so we declare the
// exported runtime API used by the extension entrypoint.
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
