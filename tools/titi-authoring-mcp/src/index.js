#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

const server = createServer();
const transport = new StdioServerTransport();

try {
  await server.connect(transport);
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown startup error';
  process.stderr.write(`Titi authoring MCP failed to start: ${message}\n`);
  process.exitCode = 1;
}
