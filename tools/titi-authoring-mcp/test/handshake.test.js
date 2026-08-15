import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, SERVER_INSTRUCTIONS } from '../src/server.js';
import { TOOL_NAMES } from '../src/tools.js';

test('MCP initializes and lists tools without requiring a service token at startup', async (context) => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer({ client: { request: async () => { throw new Error('not called'); } } });
  const client = new Client({ name: 'titi-authoring-test', version: '1.0.0' });
  context.after(async () => {
    await client.close();
    await server.close();
  });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map((tool) => tool.name), TOOL_NAMES);
  assert.equal(tools.tools.every((tool) => tool.inputSchema.additionalProperties === false), true);
  const instructions = client.getInstructions();
  assert.equal(instructions, SERVER_INSTRUCTIONS);
});
