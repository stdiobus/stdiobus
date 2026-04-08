#!/usr/bin/env node

/*
 * Apache License 2.0
 * Copyright (c) 2025–present Raman Marozau, Target Insight Function.
 * Contact: raman@stdiobus.com
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
 * @file ndjson-client.js
 * @brief Simple NDJSON test client for stdio Bus kernel
 *
 * This is a minimal test client for sending JSON-RPC requests to Agent Transport
 * OS (stdio Bus kernel) and observing responses. It demonstrates the client-to-daemon contract
 * and is useful for testing routing behavior, session affinity, and debugging.
 *
 * ## Connection Modes
 *
 * stdio Bus kernel supports three operating modes. This client supports TCP and Unix socket:
 *
 * - **TCP**: Connect to `--tcp <host:port>` mode
 *   ```bash
 *   node examples/ndjson-client.js --tcp localhost:9000
 *   ```
 *
 * - **Unix Socket**: Connect to `--unix <path>` mode
 *   ```bash
 *   node examples/ndjson-client.js --unix /tmp/stdio_bus.sock
 *   ```
 *
 * Note: stdio mode is not supported by this client (use shell pipes instead).
 *
 * ## Usage
 *
 * ```bash
 * # Basic usage - send a single request
 * node examples/ndjson-client.js --tcp localhost:9000 --method echo --id req-1
 *
 * # With session ID for session affinity testing
 * node examples/ndjson-client.js --tcp localhost:9000 --method test --id req-1 --session sess-123
 *
 * # With custom params (JSON string)
 * node examples/ndjson-client.js --tcp localhost:9000 --method process --id req-1 --params '{"data":"hello"}'
 *
 * # Interactive mode - read requests from stdin
 * node examples/ndjson-client.js --tcp localhost:9000 --interactive
 *
 * # Send notification (no id, no response expected)
 * node examples/ndjson-client.js --tcp localhost:9000 --method notify --notification
 * ```
 *
 * ## Command Line Options
 *
 * | Option | Description |
 * |--------|-------------|
 * | `--tcp <host:port>` | Connect via TCP to specified host and port |
 * | `--unix <path>` | Connect via Unix domain socket |
 * | `--method <name>` | JSON-RPC method name (default: "echo") |
 * | `--id <value>` | Request ID (default: auto-generated UUID) |
 * | `--session <id>` | Session ID for session affinity |
 * | `--params <json>` | JSON string of params to include |
 * | `--notification` | Send as notification (no id, no response) |
 * | `--interactive` | Interactive mode: read JSON from stdin |
 * | `--timeout <ms>` | Response timeout in milliseconds (default: 5000) |
 * | `--help` | Show usage information |
 *
 * ## Examples
 *
 * ### Testing Session Affinity
 *
 * Send multiple requests with the same sessionId to verify they route to the
 * same worker:
 *
 * ```bash
 * # Start stdio Bus kernel with multiple worker instances
 * ./releases/stdio_bus --config examples/echo-worker-config.json --tcp localhost:9000
 *
 * # In another terminal, send requests with same session
 * node examples/ndjson-client.js --tcp localhost:9000 --method test --session my-session --id 1
 * node examples/ndjson-client.js --tcp localhost:9000 --method test --session my-session --id 2
 * node examples/ndjson-client.js --tcp localhost:9000 --method test --session my-session --id 3
 * ```
 *
 * ### Testing Request-Response Correlation
 *
 * Verify that responses contain the same `id` as requests:
 *
 * ```bash
 * node examples/ndjson-client.js --tcp localhost:9000 --method echo --id unique-id-123
 * # Response should contain: "id": "unique-id-123"
 * ```
 *
 * ### Interactive Mode
 *
 * Send arbitrary JSON-RPC messages:
 *
 * ```bash
 * node examples/ndjson-client.js --tcp localhost:9000 --interactive
 * # Then type JSON messages, one per line:
 * {"jsonrpc":"2.0","id":"1","method":"test","params":{"foo":"bar"}}
 * {"jsonrpc":"2.0","id":"2","method":"echo","sessionId":"sess-1"}
 * ```
 *
 * @see spec/agent-transport-os.md for the full normative specification
 * @see docs-internal/integration-for-platforms.md for integration guidance
 */

import net from 'net';
import readline from 'readline';
import crypto from 'crypto';

/**
 * Parse command line arguments.
 * @returns {Object} Parsed options
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    tcp: null,
    unix: null,
    method: 'echo',
    id: null,
    sessionId: null,
    params: null,
    notification: false,
    interactive: false,
    timeout: 5000,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--tcp':
        options.tcp = args[++i];
        break;
      case '--unix':
        options.unix = args[++i];
        break;
      case '--method':
        options.method = args[++i];
        break;
      case '--id':
        options.id = args[++i];
        break;
      case '--session':
        options.sessionId = args[++i];
        break;
      case '--params':
        options.params = args[++i];
        break;
      case '--notification':
        options.notification = true;
        break;
      case '--interactive':
        options.interactive = true;
        break;
      case '--timeout':
        options.timeout = parseInt(args[++i], 10);
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        process.exit(1);
    }
  }

  return options;
}

/**
 * Display usage information.
 */
function showHelp() {
  console.log(`
NDJSON Test Client for stdio Bus kernel

Usage:
  node ndjson-client.js --tcp <host:port> [options]
  node ndjson-client.js --unix <path> [options]

Connection (one required):
  --tcp <host:port>    Connect via TCP (e.g., localhost:9000)
  --unix <path>        Connect via Unix socket (e.g., /tmp/stdio_bus.sock)

Request Options:
  --method <name>      JSON-RPC method name (default: echo)
  --id <value>         Request ID (default: auto-generated)
  --session <id>       Session ID for session affinity
  --params <json>      JSON string of params to include
  --notification       Send as notification (no response expected)

Modes:
  --interactive        Read JSON messages from stdin
  --timeout <ms>       Response timeout in ms (default: 5000)

Other:
  --help, -h           Show this help message

Examples:
  # Send a simple request
  node ndjson-client.js --tcp localhost:9000 --method echo --id req-1

  # Test session affinity
  node ndjson-client.js --tcp localhost:9000 --method test --session sess-123

  # Interactive mode
  node ndjson-client.js --tcp localhost:9000 --interactive
`);
}

/**
 * Generate a unique request ID.
 * @returns {string} UUID v4
 */
function generateId() {
  return crypto.randomUUID();
}

/**
 * Build a JSON-RPC request message.
 * @param {Object} options - Request options
 * @returns {Object} JSON-RPC message
 */
function buildRequest(options) {
  const message = {
    jsonrpc: '2.0', method: options.method
  };

  // Add id for requests (not notifications)
  if (!options.notification) {
    message.id = options.id || generateId();
  }

  // Add sessionId if specified
  if (options.sessionId) {
    message.sessionId = options.sessionId;
  }

  // Add params if specified
  if (options.params) {
    try {
      message.params = JSON.parse(options.params);
    } catch (err) {
      console.error(`Error parsing params JSON: ${err.message}`);
      process.exit(1);
    }
  }

  return message;
}

/**
 * Create a socket connection to stdio Bus kernel.
 * @param {Object} options - Connection options
 * @returns {net.Socket} Connected socket
 */
function createConnection(options) {
  if (options.tcp) {
    const [host, portStr] = options.tcp.split(':');
    const port = parseInt(portStr, 10);
    if (!host || isNaN(port)) {
      console.error('Invalid TCP address. Use format: host:port');
      process.exit(1);
    }
    console.error(`Connecting to TCP ${host}:${port}...`);
    return net.createConnection({ host, port });
  } else if (options.unix) {
    console.error(`Connecting to Unix socket ${options.unix}...`);
    return net.createConnection({ path: options.unix });
  } else {
    console.error('Error: Must specify --tcp or --unix');
    process.exit(1);
  }
}

/**
 * Run in single-request mode.
 * Sends one request and waits for response.
 * @param {Object} options - Parsed options
 */
function runSingleRequest(options) {
  const socket = createConnection(options);
  const request = buildRequest(options);
  let responseReceived = false;
  let buffer = '';

  // Set up response timeout
  const timeoutId = setTimeout(() => {
    if (!responseReceived && !options.notification) {
      console.error(`Timeout: No response received within ${options.timeout}ms`);
      socket.destroy();
      process.exit(1);
    }
  }, options.timeout);

  socket.on('connect', () => {
    console.error('Connected.');
    console.error(`Sending: ${JSON.stringify(request)}`);
    // Send request as NDJSON (JSON + newline)
    socket.write(JSON.stringify(request) + '\n');

    // For notifications, close after sending
    if (options.notification) {
      console.error('Notification sent (no response expected).');
      clearTimeout(timeoutId);
      socket.end();
    }
  });

  socket.on('data', (data) => {
    buffer += data.toString();

    // Process complete NDJSON lines
    let newlineIndex;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          responseReceived = true;
          clearTimeout(timeoutId);

          // Display response
          console.log('Response:');
          console.log(JSON.stringify(response, null, 2));

          // Verify id correlation
          if (response.id === request.id) {
            console.error('✓ Response ID matches request ID');
          } else if (response.id !== undefined) {
            console.error(`✗ Response ID (${response.id}) does not match request ID (${request.id})`);
          }

          // Verify sessionId preservation
          if (request.sessionId) {
            if (response.sessionId === request.sessionId) {
              console.error('✓ SessionId preserved in response');
            } else if (response.sessionId !== undefined) {
              console.error(`✗ SessionId mismatch: expected ${request.sessionId}, got ${response.sessionId}`);
            } else {
              console.error('✗ SessionId not present in response');
            }
          }

          socket.end();
        } catch (err) {
          console.error(`Error parsing response: ${err.message}`);
          console.error(`Raw: ${line}`);
        }
      }
    }
  });

  socket.on('error', (err) => {
    clearTimeout(timeoutId);
    console.error(`Connection error: ${err.message}`);
    process.exit(1);
  });

  socket.on('close', () => {
    clearTimeout(timeoutId);
    if (!responseReceived && !options.notification) {
      console.error('Connection closed without receiving response.');
      process.exit(1);
    }
    process.exit(0);
  });
}

/**
 * Run in interactive mode.
 * Reads JSON messages from stdin and sends them to stdio Bus kernel.
 * @param {Object} options - Parsed options
 */
function runInteractive(options) {
  const socket = createConnection(options);
  let buffer = '';

  const rl = readline.createInterface({
    input: process.stdin, output: process.stderr, terminal: false
  });

  socket.on('connect', () => {
    console.error('Connected. Enter JSON-RPC messages (one per line):');
    console.error('Example: {"jsonrpc":"2.0","id":"1","method":"echo","params":{"test":true}}');
    console.error('Press Ctrl+D to exit.\n');
  });

  // Handle incoming responses
  socket.on('data', (data) => {
    buffer += data.toString();

    let newlineIndex;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          console.log('\n← Response:');
          console.log(JSON.stringify(response, null, 2));
          console.error(''); // Blank line for readability
        } catch (err) {
          console.error(`Error parsing response: ${err.message}`);
        }
      }
    }
  });

  // Handle user input
  rl.on('line', (line) => {
    if (!line.trim()) return;

    try {
      // Validate JSON before sending
      const msg = JSON.parse(line);
      console.error(`→ Sending: ${JSON.stringify(msg)}`);
      socket.write(line + '\n');
    } catch (err) {
      console.error(`Invalid JSON: ${err.message}`);
      console.error('Please enter a valid JSON object.');
    }
  });

  rl.on('close', () => {
    console.error('\nClosing connection...');
    socket.end();
  });

  socket.on('error', (err) => {
    console.error(`Connection error: ${err.message}`);
    rl.close();
    process.exit(1);
  });

  socket.on('close', () => {
    console.error('Connection closed.');
    process.exit(0);
  });
}

/**
 * Main entry point.
 */
function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!options.tcp && !options.unix) {
    console.error('Error: Must specify --tcp or --unix connection');
    console.error('Use --help for usage information.');
    process.exit(1);
  }

  if (options.interactive) {
    runInteractive(options);
  } else {
    runSingleRequest(options);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error(`Uncaught exception: ${err.message}`);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  console.error(`Unhandled rejection: ${reason}`);
  process.exit(1);
});

main();
