# Apache License 2.0
# Copyright (c) 2025–present Raman Marozau, Work Target Insight Function.
# Contact: raman@worktif.com
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
#
# SPDX-License-Identifier: Apache-2.0

# stdio Bus Agent Transport OS kernel – Makefile
# Alternative to CMake for building stdio Bus kernel
#
# Requirements satisfied:
# - 1: C11 standard
# - 2: Build using Makefile
# - 3: -Wall -Wextra -Werror flags
# - 4: No external dependencies beyond libc and POSIX

RELEASES_DIR = releases
DOCKER_DIR = docker
RELEASES = v2.0.3

# All supported platforms
PLATFORMS = darwin-amd64 darwin-arm64 linux-amd64 linux-arm64 linux-armv7 linux-musl-amd64 linux-musl-arm64

# Test all platform binaries
# Usage: make release-test [VERSION=v2.0.3] [PLATFORM=linux-amd64]
.PHONY: release-test
release-test:
	./scripts/test-platforms.sh $(VERSION) $(if $(PLATFORM),$(PLATFORM),all)

# =============================================================================
# Run targets
# =============================================================================

# Get latest version (highest semver directory in releases/)
LATEST_VERSION = $(shell ls -d $(RELEASES_DIR)/v* 2>/dev/null | sort -V | tail -1 | xargs basename)
VERSION ?= $(LATEST_VERSION)

# Run with auto-detected platform
# Usage: make run [VERSION=v2.0.3] [ARGS='--config config.json']
.PHONY: run
run:
	./$(RELEASES_DIR)/$(VERSION)/stdio_bus $(ARGS)

# Run specific platform target
# Usage: make run-target PLATFORM=linux-amd64 [VERSION=v2.0.3] [ARGS='...']
.PHONY: run-target
run-target:
	./$(RELEASES_DIR)/$(VERSION)/$(PLATFORM)/stdio_bus $(ARGS)

# =============================================================================
# Help
# =============================================================================

.PHONY: help
help:
	@echo "stdio Bus kernel"
	@echo ""
	@echo "Usage:"
	@echo "  make run                     Run binary (auto-detect platform, latest version)"
	@echo "  make run-target              Run specific platform binary"
	@echo "  make release-test            Test all platform binaries in Docker"
	@echo "  make help                    Show this help"
	@echo ""
	@echo "Parameters:"
	@echo "  VERSION=<version>            Release version (default: $(LATEST_VERSION))"
	@echo "  PLATFORM=<platform>          Target platform (required for run-target)"
	@echo "  ARGS='<args>'                Arguments passed to stdio_bus"
	@echo ""
	@echo "Platforms:"
	@echo "  darwin-amd64                 macOS Intel"
	@echo "  darwin-arm64                 macOS Apple Silicon"
	@echo "  linux-amd64                  Linux x86_64"
	@echo "  linux-arm64                  Linux ARM64"
	@echo "  linux-armv7                  Linux ARMv7"
	@echo "  linux-musl-amd64             Alpine Linux x86_64"
	@echo "  linux-musl-arm64             Alpine Linux ARM64"
	@echo ""
	@echo "Examples:"
	@echo "  make run"
	@echo "  make run VERSION=v2.0.3"
	@echo "  make run ARGS='--config examples/echo-worker/echo-worker-config.json'"
	@echo "  make run-target PLATFORM=linux-amd64"
	@echo "  make run-target PLATFORM=darwin-arm64 VERSION=v2.0.3 ARGS='--config config.json'"
	@echo "  make release-test"
	@echo "  make release-test VERSION=v2.0.3 PLATFORM=linux-amd64"
