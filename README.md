<h1 align="center" style="font-weight:500">
  stdio Bus </br> Agentic Orchestration Ecosystem
</h1>

<p align="center">
  A deterministic C runtime providing transport-level routing for ACP/MCP-style agent protocols.
</p>

<p align="center">
  <a href="https://github.com/stdiobus"><img src="https://img.shields.io/badge/ecosystem-stdio%20Bus-ff4500?style=for-the-badge" alt="stdioBus"></a>
</p>

<p align="center">
  <a href="https://stdiobus.com/" target="_blank">stdio Bus Portal</a> • 
  <a href="https://hub.docker.com/r/stdiobus/stdiobus" target="_blank">Docker Hub</a>
</p>

stdio Bus kernel acts as a process supervisor and message router between external clients (IDEs, CLIs, services) and worker processes. It handles NDJSON-framed JSON-RPC messages with session-based routing, while remaining completely agnostic to protocol semantics.

## Key Features

- **Single-threaded**: One event loop using epoll (Linux) or kqueue (macOS)
- **No external dependencies**: Only libc and POSIX APIs
- **Protocol agnostic**: Forwards messages unchanged, parsing only routing fields
- **Session affinity**: Messages with the same `sessionId` route to the same worker
- **Backpressure management**: Configurable limits prevent memory exhaustion

## Prerequisites

- C11-compliant compiler (GCC 4.9+ or Clang 3.4+)
- Make or CMake 3.10+
- Node.js 18+ (for running example workers)


## Binary Releases

Pre-compiled binaries for multiple platforms are available in the [`/releases`](./releases) directory. Each version contains ready-to-use `stdio_bus` binaries for different architectures:

### Version 2.0.3

**Available platforms**:
- **macOS**: [`darwin-amd64`](./releases/v2.0.3/darwin-amd64) | [`darwin-arm64`](./releases/v2.0.3/darwin-arm64)
- **Linux**: [`linux-amd64`](./releases/v2.0.3/linux-amd64) | [`linux-arm64`](./releases/v2.0.3/linux-arm64) | [`linux-armv7`](./releases/v2.0.3/linux-armv7)
- **Linux (musl)**: [`linux-musl-amd64`](./releases/v2.0.3/linux-musl-amd64) | [`linux-musl-arm64`](./releases/v2.0.3/linux-musl-arm64)

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


## Implementations

Embedded stdio_bus runtime for your application process — no external daemon, no Docker, no TCP hop.

| Language | Package | Status    |
|----------|-------|-----------|
| Rust | [`stdiobus`](https://crates.io/crates/stdiobus) | Available |
| Node.js | [`@stdiobus/node`](https://www.npmjs.com/package/@stdiobus/node) | Available |
| C++ | [`stdiobus`](https://github.com/stdiobus/stdiobus-cpp) | Available |
| Python | [`stdiobus`](https://pypi.org/project/stdiobus/) | Staging   |
| Go | — | Planned   |


## MCP Orchestration

MCP server that connects IDE clients to ACP-compatible agents through stdio Bus: [`@stdiobus/mcp-agentic`](https://github.com/stdiobus/mcp-agentic)

Exposes 8 MCP tools covering agent discovery, session lifecycle, one-shot delegation, and health checks. Supports in-process agents and external worker processes. Includes a Provider Factory API for OpenAI, Anthropic, and Google Gemini with a unified interface, runtime parameter control per session and per prompt, and a `defineProvider()` contract for custom or private LLM integrations.

See [mcp-agentic](https://github.com/stdiobus/mcp-agentic) for provider setup, tool reference, and IDE integration.


## MCP Module Launcher

Manifest-driven CLI launcher for MCP server modules in the stdio Bus ecosystem: [`@stdiobus/mcpx`](https://github.com/stdiobus/mcpx)

Replaces hardcoded shell commands in `mcp.json` with a single portable entrypoint — `mcpx run <module>`. Each module is described by a `module.json` manifest that defines runtime, entry point, environment defaults, and arguments. Supports Node.js, Python, Go, Rust, Shell, and Docker runtimes. Works with any MCP client: Kiro, Cursor, Claude Desktop, Windsurf.

See [mcpx](https://github.com/stdiobus/mcpx) for manifest reference and environment management.


## Agent Skills

Structured, validated, machine-readable skills for AI agents delivered over MCP via stdio Bus: [`@stdiobus/skills`](https://github.com/stdiobus/skills)

An MCP server that exposes agent skills as a machine-parseable knowledge base — not documentation for humans. Skills are organized in a 5-layer hierarchy (Concepts → API → Patterns → Guardrails → Diagnostics), CI-validated against real framework types, and served through five MCP tools: `list_skills`, `read_skill`, `list_references`, `read_reference`, `search_skills`. Ships with two skill collections: Runtime Web (12 skills for `@worktif/runtime`) and stdio Bus SDKs (C++, Node.js, Rust).

See [skills](https://github.com/stdiobus/skills) for the skill catalog and agent consumption protocol.

## Workers

Protocol workers for stdio Bus kernel: [`@stdiobus/workers-registry`](https://github.com/stdiobus/workers-registry)

Includes ACP Registry launcher for routing to any registered agent (Claude, Goose, Cline, GitHub Copilot and others), OpenAI-compatible endpoint bridge, MCP-to-ACP proxy for IDE integration, standalone ACP agent for protocol testing, and echo workers for protocol validation. Workers run as child processes of the kernel, communicating via NDJSON over stdin/stdout. Authentication supports API keys and OAuth 2.1 with PKCE (GitHub, Google, Azure AD, AWS Cognito, OIDC).

See [workers-registry](https://github.com/stdiobus/workers-registry) for the full worker catalog, configuration, and authentication setup.


## License

Apache License, Version 2.0
