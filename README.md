# stdio Bus – Agent Transport OS

A deterministic C runtime providing transport-level routing for ACP/MCP-style agent protocols.

stdio Bus kernel acts as a process supervisor and message router between external clients (IDEs, CLIs, services) and worker processes. It handles NDJSON-framed JSON-RPC messages with session-based routing, while remaining completely agnostic to protocol semantics.

## Key Features

- **Zero AI logic**: All routing is deterministic based on session identifiers
- **Single-threaded**: One event loop using epoll (Linux) or kqueue (macOS)
- **No external dependencies**: Only libc and POSIX APIs
- **Protocol agnostic**: Forwards messages unchanged, parsing only routing fields
- **Session affinity**: Messages with the same `sessionId` route to the same worker
- **Backpressure management**: Configurable limits prevent memory exhaustion

## Docker

Pre-built multi-architecture images available on Docker Hub:

```bash
docker pull stdiobus/stdiobus:latest
```

**Supported platforms**: `linux/amd64`, `linux/arm64`, `linux/arm/v7`

**Available tags**: `latest`, `v2.0.3`, `main`, `develop`

See [Docker Hub](https://hub.docker.com/r/stdiobus/stdiobus) for complete usage examples and configuration.

## Workers

Worker implementations for stdio Bus kernel available in separate repository:

**Repository**: [github.com/stdiobus/workers-registry](https://github.com/stdiobus/workers-registry)

**Available workers**:
- `acp-worker` - Full ACP protocol implementation
- `registry-launcher` - Routes to any agent in ACP Registry
- `mcp-to-acp-proxy` - Bridges MCP clients to ACP agents
- `echo-worker` - Testing and reference implementation
- `mcp-echo-server` - MCP server example

See [Workers README](https://github.com/stdiobus/workers-registry) for build instructions and usage examples.

### Prerequisites

- C11-compliant compiler (GCC 4.9+ or Clang 3.4+)
- Make or CMake 3.10+
- Node.js 18+ (for running example workers)


## License

Apache License, Version 2.0
