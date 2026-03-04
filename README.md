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

## Binary Releases

Pre-compiled binaries for multiple platforms are available in the [`/releases`](./releases) directory. Each version contains ready-to-use `stdio_bus` binaries for different architectures:

### Version 2.0.3

**Available platforms**:
- **macOS**: [`darwin-amd64`](./releases/v2.0.3/darwin-amd64/stdio_bus) | [`darwin-arm64`](./releases/v2.0.3/darwin-arm64/stdio_bus)
- **Linux**: [`linux-amd64`](./releases/v2.0.3/linux-amd64/stdio_bus) | [`linux-arm64`](./releases/v2.0.3/linux-arm64/stdio_bus) | [`linux-armv7`](./releases/v2.0.3/linux-armv7/stdio_bus)
- **Linux (musl)**: [`linux-musl-amd64`](./releases/v2.0.3/linux-musl-amd64/stdio_bus) | [`linux-musl-arm64`](./releases/v2.0.3/linux-musl-arm64/stdio_bus)

**Verification**: SHA256 checksums available at [`checksums.sha256`](./releases/v2.0.3/checksums.sha256)

Download the appropriate binary for your platform and make it executable:
```bash
# Example for Linux AMD64
curl -L -o stdio_bus https://github.com/stdiobus/stdiobus/releases/v2.0.3/linux-amd64/stdio_bus
chmod +x stdio_bus
```


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
