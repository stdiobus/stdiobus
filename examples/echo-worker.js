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
 * @file echo-worker/echo-worker.js
 * @brief Simple NDJSON echo worker for testing stdio Bus kernel
 *
 * This is a minimal reference implementation demonstrating the worker-to-daemon
 * contract for Agent Transport OS (stdio Bus kernel). It serves as both a functional test
 * worker and documentation of the NDJSON communication protocol.
 *
 * ## NDJSON Communication Contract
 *
 * stdio Bus kernel workers communicate with the daemon via stdin/stdout using NDJSON
 * (Newline-Delimited JSON) format:
 *
 * - **Input (stdin)**: The daemon sends JSON-RPC messages, one per line.
 *   Each message is a complete JSON object terminated by a newline (\n).
 *
 * - **Output (stdout)**: The worker writes JSON-RPC responses, one per line.
 *   Each response MUST be a complete JSON object terminated by a newline.
 *   The worker MUST NOT write anything else to stdout (no logs, no debug output).
 *
 * - **Errors (stderr)**: All logging, errors, and debug output MUST go to stderr.
 *   The daemon does not process stderr; it's for operator visibility only.
 *
 * ## Message Types
 *
 * 1. **Requests**: Have both `id` and `method` fields. MUST receive a response
 *    with the same `id`.
 *
 * 2. **Notifications**: Have `method` but no `id`. MUST NOT receive a response.
 *    Workers may optionally send notifications back to the client.
 *
 * 3. **Responses**: Have `id` and either `result` or `error`. Sent by workers
 *    in reply to requests.
 *
 * ## Session Affinity
 *
 * Messages may include a `sessionId` field for session-based routing:
 * - The daemon routes all messages with the same `sessionId` to the same worker
 * - Workers MUST preserve `sessionId` in responses when present in requests
 * - This enables stateful conversations within a session
 *
 * ## Graceful Shutdown
 *
 * Workers MUST handle SIGTERM for graceful shutdown:
 * - Stop accepting new messages
 * - Complete any in-flight processing
 * - Exit with code 0
 *
 * The daemon sends SIGTERM during shutdown or when restarting workers.
 *
 * @example
 * // Start the echo worker
 * node examples/echo-worker.js
 *
 * // Send a request (from another terminal or via stdio Bus kernel)
 * echo '{"jsonrpc":"2.0","id":"1","method":"test","params":{"foo":"bar"}}' | node examples/echo-worker.js
 *
 * // Expected response:
 * // {"jsonrpc":"2.0","id":"1","result":{"echo":{"foo":"bar"},"method":"test","timestamp":"..."}}
 *
 * @see spec/agent-transport-os.md for the full normative specification
 * @see docs-internal/integration-for-platforms.md for worker implementation guidance
 */

import readline from 'readline';

/**
 * Flag to track shutdown state.
 * When true, the worker will not process new messages.
 */
let shuttingDown = false;

/**
 * Create readline interface for NDJSON processing.
 *
 * The readline module handles line-based input efficiently, buffering
 * partial lines until a complete newline-terminated message is received.
 * This is essential for NDJSON processing where messages may arrive
 * in chunks over the pipe.
 */
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

/**
 * Process a single JSON-RPC message from stdin.
 *
 * This function implements the core worker contract:
 * 1. Parse the incoming JSON message
 * 2. Determine message type (request vs notification)
 * 3. Generate appropriate response
 * 4. Preserve sessionId for session affinity
 *
 * @param {string} line - Raw JSON line from stdin (without trailing newline)
 *
 * ## Request Handling
 *
 * For requests (messages with both `id` and `method`):
 * - Generate a response with the same `id`
 * - Include `result` object with echoed data
 * - Preserve `sessionId` if present
 *
 * ## Notification Handling
 *
 * For notifications (messages with `method` but no `id`):
 * - Do NOT send a response (per JSON-RPC 2.0 spec)
 * - Optionally send a notification back if sessionId is present
 *
 * ## Error Handling
 *
 * For malformed JSON:
 * - Log error to stderr (never stdout)
 * - Continue processing subsequent messages
 * - Do NOT crash the worker
 */
function processMessage(line) {
  // Skip processing if we're shutting down
  if (shuttingDown) {
    return;
  }

  try {
    const msg = JSON.parse(line);

    // Request: has both id and method - MUST send response
    if (msg.id !== undefined && msg.method !== undefined) {
      const response = {
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          echo: msg.params || {},
          method: msg.method,
          timestamp: new Date().toISOString()
        }
      };

      // Session affinity: preserve sessionId in response
      // This is REQUIRED for session-based routing to work correctly.
      // The daemon uses sessionId to route responses back to the
      // correct client connection.
      if (msg.sessionId) {
        response.sessionId = msg.sessionId;
      }

      // Write response as NDJSON (JSON + newline)
      // console.log automatically adds the newline
      console.log(JSON.stringify(response));
    }
    // Notification: has method but no id - MUST NOT send response
    else if (msg.method !== undefined && msg.id === undefined) {
      // Per JSON-RPC 2.0: notifications don't receive responses.
      // However, workers may send their own notifications to clients.
      // If sessionId is present, we demonstrate sending a notification back.
      if (msg.sessionId) {
        const notification = {
          jsonrpc: '2.0',
          method: 'echo.notification',
          params: {
            original: msg.method,
            timestamp: new Date().toISOString()
          },
          sessionId: msg.sessionId
        };
        console.log(JSON.stringify(notification));
      }
    }
    // Response or other message type: ignore
    // Workers typically don't receive responses, but if they do,
    // they should be silently ignored.
  } catch (err) {
    // Log parse errors to stderr (NEVER stdout)
    // stdout is reserved exclusively for NDJSON protocol messages
    console.error(`[echo-worker] Error parsing message: ${err.message}`);
    console.error(`[echo-worker] Raw input: ${line.substring(0, 100)}...`);
  }
}

/**
 * Handle graceful shutdown on SIGTERM.
 *
 * The stdio Bus kernel daemon sends SIGTERM when:
 * - The daemon itself is shutting down
 * - The worker needs to be restarted (due to crash or configuration change)
 * - The worker pool is being scaled down
 *
 * Proper SIGTERM handling ensures:
 * - No message loss (in-flight messages complete)
 * - Clean process exit (exit code 0)
 * - Resource cleanup (file handles, connections)
 *
 * Workers that don't handle SIGTERM will receive SIGKILL after the
 * daemon's configured drain timeout (default: 30 seconds).
 */
function handleShutdown() {
  if (shuttingDown) {
    return; // Already shutting down
  }

  shuttingDown = true;
  console.error('[echo-worker] Received SIGTERM, shutting down gracefully...');

  // Close the readline interface to stop accepting new input
  rl.close();
}

// Register SIGTERM handler for graceful shutdown
process.on('SIGTERM', handleShutdown);

// Also handle SIGINT (Ctrl+C) for development convenience
process.on('SIGINT', handleShutdown);

// Process each line from stdin as an NDJSON message
rl.on('line', processMessage);

// Handle stdin close (daemon closed the pipe)
rl.on('close', () => {
  console.error('[echo-worker] stdin closed, exiting');
  process.exit(0);
});

// Handle uncaught exceptions
// Log to stderr and exit with error code
// The daemon will restart the worker based on restart policy
process.on('uncaughtException', (err) => {
  console.error(`[echo-worker] Uncaught exception: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[echo-worker] Unhandled promise rejection:', reason);
  process.exit(1);
});

// Log startup to stderr (for debugging)
console.error('[echo-worker] Started, waiting for NDJSON messages on stdin...');
