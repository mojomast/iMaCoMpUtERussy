# Debug Rules (Non-Obvious Only)

- ROM writes are ignored silently; no error or log emitted ([js/memory.js](js/memory.js)).
- WebSocket broadcast is no-op in current implementation; doesn't propagate changes ([server.js](server.js)).
- Use DEBUG=mcp-server flag for MCP server logging; otherwise minimal output ([server/mcp_server.js](server/mcp_server.js)).
- instanceId logging in queue-manager.js for tracing atomic backups; check for Windows path issues in tests.
- Child process spawn in server.js can lead to orphaned processes; monitor with taskkill.
- Hybrid tests use runTest() bypassing describe/it; requires custom setup in [tests/cpu.basic.test.js](tests/cpu.basic.test.js).
- Port resolution via resolvePort in [lib/port-utils.js](lib/port-utils.js); conflicts with active terminals.
- Jest setup mocks window/videoDisplay/fs; coverage excludes vendor directories.
- ECC bit-flip simulation only in [tests/queue.test.js](tests/queue.test.js); not in production code.
- MCPError propagation in autonomous-agent.js task classification; early throws for validation.