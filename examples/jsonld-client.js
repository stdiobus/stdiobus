#!/usr/bin/env node

/*
 * Apache License 2.0
 * Copyright (c) 2025–present Raman Marozau, Work Target Insight Function.
 * Contact: raman@worktif.com
 *
 * This file is part of the stdio bus protocol reference implementation:
 *   stdio_bus_kernel_binary (target: <target_stdio_bus_kernel_binary>).
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @file jsonld-client.js
 * @brief Example client for sending JSON-LD data through ACP Registry Transit
 *
 * This example demonstrates how to send structured JSON-LD data to an ACP agent
 * through the Registry Launcher transit chain.
 *
 * ## Usage
 *
 * ```bash
 * # Start stdio Bus with Registry Launcher
 * ./releases/stdio_bus --config examples/acp-registry/registry-launcher-config.json --tcp 127.0.0.1:9000
 *
 * # Send JSON-LD data
 * node examples/jsonld-client.js --tcp localhost:9000 --agent semantic-agent
 *
 * # Send custom JSON-LD from file
 * node examples/jsonld-client.js --tcp localhost:9000 --agent my-agent --file data.jsonld
 *
 * # Send inline JSON-LD
 * node examples/jsonld-client.js --tcp localhost:9000 --agent my-agent --data '{"@context":"https://schema.org","@type":"Person","name":"John"}'
 * ```
 */

import net from 'net';
import fs from 'fs';

// Example JSON-LD data
const EXAMPLE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  'name': 'Jane Smith',
  'jobTitle': 'Software Engineer',
  'email': 'jane@example.com',
  'worksFor': {
    '@type': 'Organization',
    'name': 'Tech Corp',
    'url': 'https://techcorp.example.com'
  },
  'knowsAbout': [
    'JavaScript',
    'TypeScript',
    'Node.js'
  ]
};

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    tcp: null,
    unix: null,
    agent: null,
    file: null,
    data: null,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--tcp':
        options.tcp = args[++i];
        break;
      case '--unix':
        options.unix = args[++i];
        break;
      case '--agent':
        options.agent = args[++i];
        break;
      case '--file':
        options.file = args[++i];
        break;
      case '--data':
        options.data = args[++i];
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
JSON-LD Client for ACP Registry Transit

Sends JSON-LD structured data to an ACP agent through stdio Bus.

Usage:
  node jsonld-client.js --tcp <host:port> --agent <id> [options]

Connection:
  --tcp <host:port>    Connect via TCP (e.g., localhost:9000)
  --unix <path>        Connect via Unix socket

Required:
  --agent <id>         Target agent ID from ACP Registry

Data Source (optional, uses example data if not specified):
  --file <path>        Read JSON-LD from file
  --data <json>        Inline JSON-LD string

Examples:
  # Use built-in example data
  node jsonld-client.js --tcp localhost:9000 --agent semantic-agent

  # Send from file
  node jsonld-client.js --tcp localhost:9000 --agent my-agent --file person.jsonld

  # Send inline
  node jsonld-client.js --tcp localhost:9000 --agent my-agent --data '{"@type":"Person","name":"John"}'
`);
}

function createConnection(options) {
  if (options.tcp) {
    const [host, port] = options.tcp.split(':');
    return net.createConnection({host, port: parseInt(port)});
  } else if (options.unix) {
    return net.createConnection({path: options.unix});
  }
  throw new Error('Must specify --tcp or --unix');
}

function getJsonLdData(options) {
  if (options.file) {
    const content = fs.readFileSync(options.file, 'utf-8');
    return JSON.parse(content);
  }
  if (options.data) {
    return JSON.parse(options.data);
  }
  return EXAMPLE_JSONLD;
}

async function sendRequest(socket, request, timeout = 30000) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let timer;

    const cleanup = () => {
      clearTimeout(timer);
      socket.removeAllListeners('data');
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout'));
    }, timeout);

    socket.on('data', (data) => {
      buffer += data.toString();
      const newline = buffer.indexOf('\n');
      if (newline !== -1) {
        const line = buffer.slice(0, newline);
        cleanup();
        try {
          resolve(JSON.parse(line));
        } catch (e) {
          reject(new Error(`Invalid JSON: ${line}`));
        }
      }
    });

    console.log(`→ Sending: ${JSON.stringify(request)}`);
    socket.write(JSON.stringify(request) + '\n');
  });
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!options.tcp && !options.unix) {
    console.error('Error: Must specify --tcp or --unix');
    process.exit(1);
  }

  if (!options.agent) {
    console.error('Error: Must specify --agent');
    process.exit(1);
  }

  const jsonLdData = getJsonLdData(options);
  console.log('\n=== JSON-LD Data ===');
  console.log(JSON.stringify(jsonLdData, null, 2));

  const socket = createConnection(options);

  socket.on('connect', async () => {
    console.log('\n=== Connected ===');

    try {
      // Step 1: Initialize
      console.log('\n--- Initialize ---');
      const initResponse = await sendRequest(socket, {
        jsonrpc: '2.0',
        id: 'init-1',
        method: 'initialize',
        agentId: options.agent,
        params: {
          protocolVersion: 1,
          clientCapabilities: {},
          clientInfo: {name: 'jsonld-client', version: '1.0.0'}
        }
      });
      console.log(`← Response: ${JSON.stringify(initResponse)}`);

      if (initResponse.error) {
        throw new Error(initResponse.error.message);
      }

      // Step 2: Create session
      console.log('\n--- Create Session ---');
      const sessionResponse = await sendRequest(socket, {
        jsonrpc: '2.0',
        id: 'session-1',
        method: 'session/new',
        agentId: options.agent,
        params: {}
      });
      console.log(`← Response: ${JSON.stringify(sessionResponse)}`);

      if (sessionResponse.error) {
        throw new Error(sessionResponse.error.message);
      }

      const sessionId = sessionResponse.result?.sessionId || 'default-session';

      // Step 3: Send JSON-LD as prompt
      console.log('\n--- Send JSON-LD ---');
      const promptResponse = await sendRequest(socket, {
        jsonrpc: '2.0',
        id: 'prompt-1',
        method: 'session/prompt',
        agentId: options.agent,
        params: {
          sessionId,
          prompt: {
            messages: [{
              role: 'user',
              content: {
                type: 'text',
                // JSON-LD is sent as stringified JSON in the text field
                text: `Process this JSON-LD data:\n\n${JSON.stringify(jsonLdData, null, 2)}`
              }
            }]
          }
        }
      });
      console.log(`← Response: ${JSON.stringify(promptResponse, null, 2)}`);

      console.log('\n=== Complete ===');

    } catch (err) {
      console.error(`\nError: ${err.message}`);
    } finally {
      socket.end();
    }
  });

  socket.on('error', (err) => {
    console.error(`Connection error: ${err.message}`);
    process.exit(1);
  });

  socket.on('close', () => {
    process.exit(0);
  });
}

main();
