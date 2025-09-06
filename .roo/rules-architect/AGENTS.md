# Architect Rules (Non-Obvious Only)

- Multi-server setup via child process spawn in [server.js](server.js); leads to orphaned processes without proper cleanup.
- Atomic backups in agent queue-manager; Windows path issues affect cross-platform reliability ([agent/queue-manager.js](agent/queue-manager.js)).
- ESM "type": "module" breaks CommonJS interoperability; legacy node-fetch v2 workaround required.
- Dynamic schema endpoints in [server/mcp_server.js](server/mcp_server.js) depend on hidden schemas in [docs/mcp_schemas/](docs/mcp_schemas/).
- Video buffer assumptions $0200-$05FF hardcoded; affects emulator architecture ([js/cpu.js](js/cpu.js)).
- Flow: client->MCP->emulator->UI; no-op WebSocket broadcast breaks real-time updates ([server.js](server.js)).
- Task classification in [agent/autonomous-agent.js](agent/autonomous-agent.js) assumes MCPError early propagation; stateless providers not enforced.
- Dual concurrently versions risk conflicts in multi-service start; port resolution via [lib/port-utils.js](lib/port-utils.js).
- Hybrid test architecture bypasses standard Jest; requires custom runTest() and mocks in [tests/cpu.basic.test.js](tests/cpu.basic.test.js).
- Integration tests isolated with separate package.json; cd required, not root-based execution.