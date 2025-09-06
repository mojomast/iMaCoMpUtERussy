# Ask Rules (Non-Obvious Only)

- Video buffer at $0200-$05FF for retro emulator; counterintuitive address range ([js/cpu.js](js/cpu.js)).
- Hybrid tests bypass standard Jest describe/it with runTest() in [tests/cpu.basic.test.js](tests/cpu.basic.test.js); not using typical Jest patterns.
- Schema dependencies in [docs/mcp_schemas/](docs/mcp_schemas/) are hidden; dynamic endpoints in [server/mcp_server.js](server/mcp_server.js) require them.
- Two-pass assembly with expression eval in [js/assembler.js](js/assembler.js); not standard assembler flow.
- Custom video opcodes VLD/VST/VUP/VDL only documented in code, not external docs ([js/cpu.js](js/cpu.js)).
- Memory listeners via addWriteListener; ROM writes ignored silently, no documentation ([js/memory.js](js/memory.js)).
- Task classification in [agent/autonomous-agent.js](agent/autonomous-agent.js) uses MCPError early throws; undocumented pattern.
- jest.setup.js mocks window/videoDisplay/fs globally; affects all tests unexpectedly.
- Integration tests require cd to integration/ due to separate package.json; not root-based.
- Windows path issues in tests; coverage excludes vendor directories implicitly.