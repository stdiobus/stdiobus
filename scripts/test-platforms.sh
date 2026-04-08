#!/bin/bash

# Apache License 2.0
# Copyright (c) 2025–present Raman Marozau, Target Insight Function.
# Contact: raman@stdiobus.com
#
# This file is part of the stdio bus protocol reference implementation:
#   stdio_bus_kernel_binary (target: <target_stdio_bus_kernel_binary>).
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


# Test stdio_bus binaries on all platforms via Docker
# Runs a real integration test with echo-worker on each platform

set -e

DEFAULT_VERSION=v2.0.3

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VERSION="${1:-$DEFAULT_VERSION}"
DIST_DIR="$PROJECT_ROOT/releases"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_test() { echo -e "${CYAN}[TEST]${NC} $1"; }

PASSED=0
FAILED=0

# Test a platform
test_platform() {
    local platform=$1
    local docker_platform=$2
    local base_image=$3
    local binary="$DIST_DIR/$VERSION/$platform/stdio_bus"

    echo ""
    echo "============================================================"
    log_test "Testing $platform"
    echo "============================================================"

    if [ ! -f "$binary" ]; then
        log_error "Binary not found: $binary"
        ((FAILED++))
        return 1
    fi

    # Create temp directory for test
    local test_dir=$(mktemp -d)
    trap "rm -rf $test_dir" EXIT

    # Copy binary and test files
    cp "$binary" "$test_dir/stdio_bus"
    cp "$PROJECT_ROOT/examples/echo-worker.js" "$test_dir/"

    # Create test config
    # Use "node" directly instead of "/usr/bin/env node" for Alpine compatibility
    cat > "$test_dir/config.json" << 'EOF'
{
    "pools": [
        {
            "id": "echo",
            "command": "node",
            "args": ["/tmp/test/echo-worker.js"],
            "instances": 1
        }
    ],
    "limits": {
        "max_input_buffer": 1048576,
        "max_output_queue": 4194304,
        "max_restarts": 3,
        "restart_window_sec": 60,
        "drain_timeout_sec": 5,
        "backpressure_timeout_sec": 10
    }
}
EOF

    # Create test script that runs inside container
    cat > "$test_dir/run_test.sh" << 'TESTSCRIPT'
#!/bin/sh

cd /tmp/test

echo "[container] Platform: $(uname -m) / $(uname -s)"
echo "[container] Node version: $(node --version)"
echo "[container] Binary info:"
ls -la stdio_bus
echo ""

# Make binary executable
chmod +x stdio_bus

# Test 1: Version/help check
echo "[test] Running --help..."
./stdio_bus --help 2>&1 || true
echo ""

# Test 2: Config validation
echo "[test] Validating config..."
./stdio_bus --config config.json --validate 2>&1 && echo "Config valid" || echo "Config validation not supported (ok)"
echo ""

# Test 3: Start daemon and send test messages via Unix socket
echo "[test] Starting stdio_bus daemon with echo worker (Unix socket mode)..."

SOCKET_PATH="/tmp/stdio_bus_test.sock"
rm -f "$SOCKET_PATH"

./stdio_bus --config config.json --unix "$SOCKET_PATH" 2>/tmp/stderr.log &
DAEMON_PID=$!

# Give daemon time to start workers
sleep 3

# Check if daemon is running
if ! kill -0 $DAEMON_PID 2>/dev/null; then
    echo "[error] Daemon failed to start"
    cat /tmp/stderr.log
    exit 1
fi

# Check if socket was created
if [ ! -S "$SOCKET_PATH" ]; then
    echo "[error] Unix socket not created"
    cat /tmp/stderr.log
    kill $DAEMON_PID 2>/dev/null || true
    exit 1
fi

echo "[test] Daemon started (PID: $DAEMON_PID)"
echo "[test] Socket created: $SOCKET_PATH"
echo "[test] Sending test requests..."

# Create a Node.js test client
cat > /tmp/test_client.js << 'NODESCRIPT'
const net = require('net');
const readline = require('readline');

const socketPath = process.argv[2];
const requests = [
    { id: 'test-1', method: 'echo', params: { message: 'Hello!' } },
    { id: 'test-2', method: 'echo', params: { data: 'test' }, sessionId: 'session-abc' },
    { id: 'test-3', method: 'echo', params: { seq: 3 } }
];

let responsesOk = 0;
let responsesFailed = 0;
let currentRequest = 0;

function sendNextRequest(client) {
    if (currentRequest >= requests.length) {
        console.log(`\n[test] Results: ${responsesOk} OK, ${responsesFailed} FAILED`);
        client.end();
        process.exit(responsesOk > 0 ? 0 : 1);
        return;
    }

    const req = requests[currentRequest];
    const msg = JSON.stringify({ jsonrpc: '2.0', ...req });
    console.log(`[test] Sending request ${req.id}: ${req.method}`);
    client.write(msg + '\n');
}

const client = net.createConnection(socketPath, () => {
    console.log('[test] Connected to daemon');
    sendNextRequest(client);
});

const rl = readline.createInterface({ input: client });

rl.on('line', (line) => {
    try {
        const response = JSON.parse(line);
        const expectedId = requests[currentRequest].id;

        if (response.id === expectedId && response.result) {
            console.log(`[test] ✓ Response OK for ${expectedId}`);
            responsesOk++;
        } else if (response.error) {
            console.log(`[test] ✗ Error response for ${expectedId}: ${JSON.stringify(response.error)}`);
            responsesFailed++;
        } else {
            console.log(`[test] ✗ Unexpected response: ${line}`);
            responsesFailed++;
        }
    } catch (e) {
        console.log(`[test] ✗ Invalid JSON: ${line}`);
        responsesFailed++;
    }

    currentRequest++;
    setTimeout(() => sendNextRequest(client), 500);
});

client.on('error', (err) => {
    console.error(`[test] Connection error: ${err.message}`);
    process.exit(1);
});

client.on('close', () => {
    console.log('[test] Connection closed');
});

// Timeout after 15 seconds
setTimeout(() => {
    console.log('[test] Timeout waiting for responses');
    client.end();
    process.exit(1);
}, 15000);
NODESCRIPT

# Run the test client
node /tmp/test_client.js "$SOCKET_PATH"
TEST_RESULT=$?

# Graceful shutdown
echo ""
echo "[test] Sending SIGTERM for graceful shutdown..."
kill -TERM $DAEMON_PID 2>/dev/null || true
sleep 2

# Force kill if still running
if kill -0 $DAEMON_PID 2>/dev/null; then
    echo "[test] Force killing daemon..."
    kill -9 $DAEMON_PID 2>/dev/null || true
fi

echo ""
echo "[test] Daemon stderr log (last 30 lines):"
tail -30 /tmp/stderr.log 2>/dev/null || cat /tmp/stderr.log

# Cleanup
rm -f "$SOCKET_PATH" /tmp/test_client.js

if [ $TEST_RESULT -eq 0 ]; then
    echo ""
    echo "[container] Test completed successfully!"
    exit 0
else
    echo ""
    echo "[error] Test failed!"
    exit 1
fi
TESTSCRIPT

    chmod +x "$test_dir/run_test.sh"

    # Run test in Docker
    log_info "Running test in Docker ($docker_platform)..."

    if docker run --rm \
        --platform "$docker_platform" \
        -v "$test_dir:/test:ro" \
        "$base_image" \
        /bin/sh -c "cp -r /test /tmp/test && chmod +x /tmp/test/* && cd /tmp/test && ./run_test.sh" 2>&1; then
        log_info "✓ $platform: PASSED"
        ((PASSED++))
    else
        log_error "✗ $platform: FAILED"
        ((FAILED++))
    fi

    rm -rf "$test_dir"
    trap - EXIT
}

# Main
main() {
    echo "============================================================"
    echo "  stdio_bus Cross-Platform Integration Tests"
    echo "============================================================"
    echo ""
    log_info "Testing binaries from: $DIST_DIR/$VERSION"
    echo ""

    # Check binaries exist
    if [ ! -d "$DIST_DIR" ]; then
        log_error "dist/ directory not found. Run 'make dist' first."
        exit 1
    fi

    # Test each Linux platform (glibc)
    test_platform "linux-amd64" "linux/amd64" "node:20-slim"
    test_platform "linux-arm64" "linux/arm64" "node:20-slim"
    test_platform "linux-armv7" "linux/arm/v7" "node:20-slim"

    # Test musl platforms (Alpine)
    test_platform "linux-musl-amd64" "linux/amd64" "node:20-alpine"
    test_platform "linux-musl-arm64" "linux/arm64" "node:20-alpine"

    # Summary
    echo ""
    echo "============================================================"
    echo "  Test Summary"
    echo "============================================================"
    echo ""
    log_info "Passed: $PASSED"
    if [ $FAILED -gt 0 ]; then
        log_error "Failed: $FAILED"
        exit 1
    else
        log_info "Failed: $FAILED"
        echo ""
        log_info "All platform tests passed!"
    fi
}

# Run specific platform or all
case "${2:-all}" in
    all)
        main
        ;;
    linux-amd64)
        test_platform "linux-amd64" "linux/amd64" "node:20-slim"
        ;;
    linux-arm64)
        test_platform "linux-arm64" "linux/arm64" "node:20-slim"
        ;;
    linux-armv7)
        test_platform "linux-armv7" "linux/arm/v7" "node:20-slim"
        ;;
    linux-musl-amd64)
        test_platform "linux-musl-amd64" "linux/amd64" "node:20-alpine"
        ;;
    linux-musl-arm64)
        test_platform "linux-musl-arm64" "linux/arm64" "node:20-alpine"
        ;;
    *)
        echo "Usage: $0 [all|linux-amd64|linux-arm64|linux-armv7|linux-musl-amd64|linux-musl-arm64]"
        exit 1
        ;;
esac
