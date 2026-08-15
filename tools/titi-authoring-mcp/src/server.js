import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createToolDefinitions } from './tools.js';

export const SERVER_INSTRUCTIONS = 'Create Titi course drafts through the HTTP authoring API. Never publish without a recent separate preview and explicit human approval of its phrase, token, and fingerprint. Reuse the same idempotency key after a timeout or unknown write outcome. Never chain preview and publish inside one tool call. Never execute uploaded files or scan folders. Never reveal TITI_SERVICE_TOKEN or Authorization headers.';

export function createServer({ client } = {}) {
  const server = new McpServer(
    { name: 'titi-authoring', version: '1.0.0' },
    { instructions: SERVER_INSTRUCTIONS },
  );
  for (const definition of createToolDefinitions(client)) {
    server.registerTool(definition.name, {
      description: definition.description,
      inputSchema: definition.inputSchema,
      annotations: definition.annotations,
    }, definition.run);
  }
  return server;
}
