#!/usr/bin/env node
/**
 * Patchwork MCP Server
 * 
 * The MCP server IS the product. It exposes synth control capabilities
 * to LLMs through a clean, intent-based tool surface.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { toolDefinitions } from './tools.js';
import {
  handleListSynths,
  handleDescribeSynth,
  handleSetParam,
  handleLoadPreset,
  handleSetSynthFeature,
  handleInit,
  handleSetModulation,
  handleCreateSequence,
  handleGetSequence,
  handleDumpPreset,
  handleScanPresets,
  handleFindEmptySlots,
} from './handlers.js';
import { listResources, readResource } from './resources.js';
import { synthRegistry } from '../synth/adapter.js';
import { driverFactoryRegistry } from '../synth/factory.js';
import type { CanonicalParam } from '../synth/types.js';

// Import drivers to trigger their factory registration
import '../drivers/microfreak/index.js';

const SERVER_NAME = 'patchwork';
const SERVER_VERSION = '0.1.0';

/**
 * Initialize synth drivers and register them.
 */
async function initializeSynths(): Promise<void> {
  console.error('[patchwork] Initializing synth drivers...');
  
  // Try all registered driver factories
  for (const factory of driverFactoryRegistry.getAll()) {
    console.error(`[patchwork] Checking for ${factory.name}...`);
    const driver = await factory.detect();
    if (driver && driver.isConnected()) {
      synthRegistry.register(driver);
      console.error(`[patchwork] ✓ Registered synth: ${driver.name} (${driver.id})`);
    } else {
      console.error(`[patchwork] ✗ ${factory.name} not found or not connected`);
    }
  }
  
  const synthCount = synthRegistry.getAll().length;
  console.error(`[patchwork] Total synths registered: ${synthCount}`);
}

/**
 * Rescan for new synths (hot-plug support).
 * Checks all driver factories for newly available synths.
 */
async function rescanSynths(): Promise<void> {
  // Try all registered driver factories
  for (const factory of driverFactoryRegistry.getAll()) {
    // Check if we already have a connected instance of this synth
    const existing = synthRegistry.getAll().find(s => s.name === factory.name);
    
    if (!existing || !existing.isConnected()) {
      const driver = await factory.detect();
      if (driver && driver.isConnected()) {
        // Remove old disconnected one if exists
        if (existing) {
          synthRegistry.unregister(existing.id);
        }
        synthRegistry.register(driver);
        console.error(`[patchwork] ✓ Newly detected and registered: ${driver.name}`);
      }
    }
  }
}

/**
 * Create and configure the MCP server.
 */
function createServer(): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {}, resources: {} } }
  );

  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: listResources() };
  });

  // Read a resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const result = readResource(uri);
    
    if (!result) {
      throw new Error(`Resource not found: ${uri}`);
    }

    return {
      contents: [{
        uri,
        mimeType: result.mimeType,
        text: result.content,
      }],
    };
  });

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: toolDefinitions };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: unknown;

      switch (name) {
        case 'list_synths':
          // Rescan for newly connected synths before listing
          await rescanSynths();
          result = await handleListSynths();
          break;

        case 'describe_synth':
          result = await handleDescribeSynth(args as { synthId?: string });
          break;

        case 'set_param':
          result = await handleSetParam(
            args as { param: CanonicalParam; value: number; synthId?: string }
          );
          break;

        case 'load_preset':
          result = await handleLoadPreset(
            args as { slot: number; synthId?: string }
          );
          break;

        case 'set_synth_feature':
          result = await handleSetSynthFeature(
            args as { feature: string; value: string; synthId?: string }
          );
          break;

        case 'init':
          result = await handleInit(
            args as { synthId?: string }
          );
          break;

        case 'set_modulation':
          result = await handleSetModulation(
            args as { source: string; destination: string; amount: number; synthId?: string }
          );
          break;

        case 'create_sequence':
          result = await handleCreateSequence(
            args as { steps: any[]; synthId?: string }
          );
          break;

        case 'get_sequence':
          result = await handleGetSequence(
            args as { synthId?: string }
          );
          break;

        case 'dump_preset':
          result = await handleDumpPreset(
            args as { slot: number; synthId?: string }
          );
          break;

        case 'scan_presets':
          result = await handleScanPresets(
            args as { synthId?: string }
          );
          break;

        case 'find_empty_slots':
          result = await handleFindEmptySlots(
            args as { synthId?: string }
          );
          break;

        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  console.error('[patchwork] Starting Patchwork MCP Server...');

  // Initialize synth drivers
  await initializeSynths();

  // Create and start server
  const server = createServer();
  const transport = new StdioServerTransport();
  
  await server.connect(transport);
  console.error('[patchwork] Server connected via stdio');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.error('[patchwork] Shutting down...');
    for (const synth of synthRegistry.getAll()) {
      await synth.disconnect();
    }
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('[patchwork] Fatal error:', error);
  process.exit(1);
});
