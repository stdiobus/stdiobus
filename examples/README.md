# stdio Bus kernel Examples

This directory contains example configurations and worker implementations for Agent Transport OS (stdio Bus kernel).

## Contents

| File                                        | Description                                              |
|---------------------------------------------|----------------------------------------------------------|
| `echo-worker-config.json`       | Example configuration file for stdio Bus kernel          |
| `echo-worker.js`                | Simple Node.js echo worker demonstrating NDJSON protocol |
| `ndjson-client.js`   | Test client for sending requests to stdio Bus kernel     |
| `mcp-echo-server.ts` | TypeScript MCP echo server example                       |

## Running the Examples

### Prerequisites

- stdio Bus kernel built from source (see `releases/`)
- Node.js 18.0.0 or later

---

### Echo Worker Example

The echo worker (`echo-worker.js`) demonstrates the basic NDJSON worker contract. It echoes back any JSON-RPC request it
receives.

#### Running Standalone (without stdio Bus kernel)

Test the echo worker directly:

```bash
# Send a single request
echo '{"jsonrpc":"2.0","id":"1","method":"test","params":{"foo":"bar"}}' | node examples/echo-worker.js

# Expected output:
# {"jsonrpc":"2.0","id":"1","result":{"echo":{"foo":"bar"},"method":"test","timestamp":"..."}}
```

#### Running with stdio Bus kernel (stdio mode)

```bash
# Start stdio Bus kernel with echo worker in stdio mode
./releases/stdio_bus --config examples/echo-worker-config.json --stdio

# Then send messages via stdin (one JSON per line)
{"jsonrpc":"2.0","id":"1","method":"echo","params":{"hello":"world"}}
```

#### Running with stdio Bus kernel (TCP mode)

This is the recommended mode for testing with the NDJSON client:

```bash
# Terminal 1: Start stdio Bus kernel with TCP listener
./releases/stdio_bus --config examples/echo-worker-config.json --tcp 127.0.0.1:9000

# Terminal 2: Send test requests
node examples/ndjson-client.js --tcp 127.0.0.1:9000 --method echo --id req-1

# Test session affinity (multiple requests with same session)
node examples/ndjson-client.js --tcp 127.0.0.1:9000 --method test --session sess-123 --id 1
node examples/ndjson-client.js --tcp 127.0.0.1:9000 --method test --session sess-123 --id 2
```

#### Running with stdio Bus kernel (Unix socket mode)

```bash
# Terminal 1: Start stdio Bus kernel with Unix socket
./releases/stdio_bus --config examples/echo-worker-config.json --unix /tmp/stdio_bus.sock

# Terminal 2: Send test requests
node examples/ndjson-client.js --unix /tmp/stdio_bus.sock --method echo --id req-1
```

---

### NDJSON Client Example

The NDJSON client (`ndjson-client.js`) is a test utility for sending requests to stdio Bus kernel.

#### Basic Usage

```bash
# Terminal 1: Start stdio Bus kernel with TCP listener
./releases/stdio_bus --config examples/echo-worker-config.json --tcp 127.0.0.1:9000

# Send a simple request
node examples/ndjson-client.js --tcp localhost:9000 --method echo --id req-1

# Send with session ID
node examples/ndjson-client.js --tcp localhost:9000 --method test --session my-session --id req-1

# Send with custom params
node examples/ndjson-client.js --tcp localhost:9000 --method process --id req-1 --params '{"data":"hello"}'

# Send a notification (no response expected)
node examples/ndjson-client.js --tcp localhost:9000 --method notify --notification
```

#### Interactive Mode

```bash
# Start interactive mode
node examples/ndjson-client.js --tcp localhost:9000 --interactive

# Then type JSON messages, one per line:
{"jsonrpc":"2.0","id":"1","method":"echo","params":{"test":true}}
{"jsonrpc":"2.0","id":"2","method":"test","sessionId":"sess-1"}
```

#### Command Line Options

| Option              | Description                            |
|---------------------|----------------------------------------|
| `--tcp <host:port>` | Connect via TCP                        |
| `--unix <path>`     | Connect via Unix socket                |
| `--method <name>`   | JSON-RPC method name (default: "echo") |
| `--id <value>`      | Request ID (default: auto-generated)   |
| `--session <id>`    | Session ID for session affinity        |
| `--params <json>`   | JSON string of params                  |
| `--notification`    | Send as notification (no response)     |
| `--interactive`     | Interactive mode                       |
| `--timeout <ms>`    | Response timeout (default: 5000)       |
| `--help`            | Show help                              |

---

### Using the Default Configuration

The included `config.json` runs both the echo worker and the protocol worker:

```bash
# View the configuration
cat examples/echo-worker-config.json

# Start stdio Bus kernel with default config
./releases/stdio_bus --config examples/echo-worker-config.json --tcp 127.0.0.1:9000
```

## Configuration Reference

stdio Bus kernel reads configuration from a JSON file specified via `--config <path>`. The configuration defines worker
pools and operational limits.

### Configuration File Structure

```json
{
  "pools": [ ... ],
  "limits": { ... }
}
```

### Pool Configuration

The `pools` array defines one or more worker pools. Each pool specifies a group of identical worker processes.

| Field       | Type     | Required | Description                                                   |
|-------------|----------|----------|---------------------------------------------------------------|
| `id`        | string   | Yes      | Unique identifier for this pool. Used in logging and routing. |
| `command`   | string   | Yes      | Path to the executable to run.                                |
| `args`      | string[] | No       | Command-line arguments passed to the executable.              |
| `instances` | number   | Yes      | Number of worker instances to spawn (must be ≥ 1).            |

#### Pool Configuration Example

```json
{
  "pools": [
    {
      "id": "echo-worker",
      "command": "/usr/bin/env",
      "args": ["node", "./examples/echo-worker.js"],
      "instances": 2
    }
  ]
}
```

#### Notes on Pool Configuration

- The `command` field should be an absolute path or a command available in `PATH`
- Using `/usr/bin/env` as the command with the actual executable as the first argument is a portable pattern
- The `args` array does NOT include the command itself as the first element (unlike C's `argv`)
- Multiple pools can be defined to run different worker types simultaneously
- Workers in the same pool are functionally identical and receive requests via round-robin assignment

### Limits Configuration

The `limits` object controls resource usage and error recovery behavior. All fields are optional; defaults are used when
omitted.

| Field                      | Type   | Default        | Description                                                                                                     |
|----------------------------|--------|----------------|-----------------------------------------------------------------------------------------------------------------|
| `max_input_buffer`         | number | 1048576 (1 MB) | Maximum input buffer size per connection in bytes. Messages larger than this cause the connection to be closed. |
| `max_output_queue`         | number | 4194304 (4 MB) | Maximum output queue size per connection in bytes. When exceeded, backpressure is applied.                      |
| `max_restarts`             | number | 5              | Maximum number of worker restarts allowed within the restart window.                                            |
| `restart_window_sec`       | number | 60             | Time window in seconds for counting worker restarts.                                                            |
| `drain_timeout_sec`        | number | 30             | Timeout in seconds for graceful shutdown. Workers not exited after this time receive SIGKILL.                   |
| `backpressure_timeout_sec` | number | 60             | Timeout in seconds before closing a connection when output queue is full.                                       |

#### Limits Configuration Example

```json
{
  "limits": {
    "max_input_buffer": 1048576,
    "max_output_queue": 4194304,
    "max_restarts": 5,
    "restart_window_sec": 60,
    "drain_timeout_sec": 30,
    "backpressure_timeout_sec": 60
  }
}
```

#### Understanding the Limits

**Input Buffer (`max_input_buffer`)**

- Each connection has a dedicated input buffer for accumulating incoming data
- NDJSON messages are parsed from this buffer when a complete line is received
- If a single message exceeds this limit, the connection is closed with an error

**Output Queue (`max_output_queue`)**

- Each connection has an output queue for messages waiting to be sent
- When the queue exceeds this limit, backpressure is applied (no new messages queued)
- If the queue remains full for `backpressure_timeout_sec`, the connection is closed

**Restart Policy (`max_restarts`, `restart_window_sec`)**

- stdio Bus kernel automatically restarts workers that exit unexpectedly
- If a worker restarts more than `max_restarts` times within `restart_window_sec` seconds, it is marked as failed and
  not restarted
- This prevents crash loops from consuming system resources

**Graceful Shutdown (`drain_timeout_sec`)**

- On SIGTERM/SIGINT, stdio Bus kernel sends SIGTERM to all workers
- Workers have `drain_timeout_sec` seconds to finish processing and exit
- After the timeout, remaining workers receive SIGKILL

**Backpressure (`backpressure_timeout_sec`)**

- When a connection's output queue is full, stdio Bus kernel stops queuing new messages
- If the queue cannot drain within `backpressure_timeout_sec`, the connection is closed
- This prevents slow clients from causing unbounded memory growth

---

## Example Configurations

### Minimal Configuration

A minimal configuration with one worker pool using defaults for all limits:

```json
{
  "pools": [
    {
      "id": "my-worker",
      "command": "/usr/bin/node",
      "args": ["./worker.js"],
      "instances": 1
    }
  ]
}
```

### High-Throughput Configuration

Configuration optimized for high message throughput with larger buffers:

```json
{
  "pools": [
    {
      "id": "high-throughput-worker",
      "command": "/usr/bin/node",
      "args": ["./worker.js"],
      "instances": 4
    }
  ],
  "limits": {
    "max_input_buffer": 4194304,
    "max_output_queue": 16777216,
    "backpressure_timeout_sec": 120
  }
}
```

### Development Configuration

Configuration for development with aggressive restart policy:

```json
{
  "pools": [
    {
      "id": "dev-worker",
      "command": "/usr/bin/env",
      "args": ["node", "--inspect", "./worker.js"],
      "instances": 1
    }
  ],
  "limits": {
    "max_restarts": 100,
    "restart_window_sec": 300,
    "drain_timeout_sec": 5
  }
}
```

### Multiple Worker Pools

Configuration with multiple worker pools for different purposes:

```json
{
  "pools": [
    {
      "id": "acp-worker-exmaple",
      "command": "/usr/bin/node",
      "args": ["./acp-worker.js"],
      "instances": 2
    },
    {
      "id": "mcp-worker-exmaple",
      "command": "/usr/bin/node",
      "args": ["./mcp-worker.js"],
      "instances": 1
    }
  ]
}
```

---

## See Also

- [Platform Integration Guide](../docs/docs-internal/integration-for-platforms.md) - Embedding stdio Bus kernel in platforms
- [Specification](../spec/agent-transport-os.md) - Normative specification document
