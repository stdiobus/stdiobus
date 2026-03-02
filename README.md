# stdio Bus – Agent Transport OS kernel

A deterministic C runtime providing transport-level routing for ACP/MCP-style agent protocols.

stdio Bus kernel acts as a process supervisor and message router between external clients (IDEs, CLIs, services) and worker processes. It handles NDJSON-framed JSON-RPC messages with session-based routing, while remaining completely agnostic to protocol semantics.

## Key Features

- **Zero AI logic**: All routing is deterministic based on session identifiers
- **Single-threaded**: One event loop using epoll (Linux) or kqueue (macOS)
- **No external dependencies**: Only libc and POSIX APIs
- **Protocol agnostic**: Forwards messages unchanged, parsing only routing fields
- **Session affinity**: Messages with the same `sessionId` route to the same worker
- **Backpressure management**: Configurable limits prevent memory exhaustion

### Prerequisites

- C11-compliant compiler (GCC 4.9+ or Clang 3.4+)
- Make or CMake 3.10+
- Node.js 18+ (for running example workers)


## License

Apache License, Version 2.0
