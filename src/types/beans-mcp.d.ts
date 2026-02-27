// Temporary module shim for @selfagency/beans-mcp to satisfy TypeScript resolution
// when building the extension. The actual package ships its own typings, but
// some TS resolution configurations may not pick them up consistently.
// This shim can be removed once the package is reliably resolved in all envs.
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
