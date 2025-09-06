# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Commands (Non-Standard)
- Build script runs only `npm install` without transpilation ([package.json](package.json)).
- No linting scripts; run ESLint manually as no config exists.
- Grouped tests via `npm run test:cpu` targeting `tests/cpu*.test.js`.
- Multi-service start with `autonomous-system-start` using concurrently; watch for port conflicts with active terminals.
- Integration tests need `--prefix integration` (cd required due to separate package.json).
- MCP server requires `DEBUG=mcp-server` flag for logging.
- Python http.server for static serving (no JS execution).

## Style (Beyond Configs)
- Use `typeof window` checks for browser globals ([js/app.js](js/app.js)).
- Dynamic `import()` for heavy modules to avoid ESM chain issues.
- Relative paths without .js extensions (Jest mapper handles).
- 2-space indentation; strict semicolons; JSDoc with @class/@param.
- PascalCase classes prefixed "iMaCoMpUtERussy*" (e.g., iMaCoMpUtERussyCPU).

## Patterns/Utilities
- Custom video opcodes VLD/VST/VUP/VDL in [js/cpu.js](js/cpu.js); video buffer $0200-$05FF.
- Memory listeners via addWriteListener; ROM writes ignored silently.
- Expression eval in [js/assembler.js](js/assembler.js) with two-pass assembly.
- Use standardizeError from [lib/ErrorHandler.js](lib/ErrorHandler.js); validate with sanitizeProgramName/validateMemoryAddress in [lib/validators.js](lib/validators.js).
- resolvePort in [lib/port-utils.js](lib/port-utils.js); instanceId logging in [agent/queue-manager.js](agent/queue-manager.js).
- Task classification in [agent/autonomous-agent.js](agent/autonomous-agent.js); MCPError early throws.
- Dynamic schema endpoints in [server/mcp_server.js](server/mcp_server.js); schema deps in [docs/mcp_schemas/](docs/mcp_schemas/).

## Gotchas
- ESM "type": "module" breaks CommonJS; legacy node-fetch v2 used.
- Jest with ts-jest preset in JS project adds overhead; hybrid tests bypass describe/it (e.g., runTest in [tests/cpu.basic.test.js](tests/cpu.basic.test.js)).
- jest.setup.js mocks window/videoDisplay/fs; coverage excludes vendor.
- Child process spawn in [server.js](server.js); no-op WebSocket broadcast.
- Atomic backups in agent queue; Windows path issues in tests.