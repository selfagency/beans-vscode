/**
 * Thin wrapper for the Beans MCP server: delegates to the implementation
 * provided by the @selfagency/beans-mcp package. This file is bundled by
 * esbuild into dist/beans-mcp-server.js and launched by the extension
 * via process.execPath.
 */
export { startBeansMcpServer, parseCliArgs, sortBeans, isPathWithinRoot } from '@selfagency/beans-mcp';
import { startBeansMcpServer } from '@selfagency/beans-mcp';

if (require.main === module) {
  startBeansMcpServer(process.argv.slice(2)).catch(error => {
    console.error('[beans-mcp-server] fatal:', error);
    process.exit(1);
  });
}
