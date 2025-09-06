# Code Rules (Non-Obvious Only)

- Classes must use PascalCase with "iMaCoMpUtERussy*" prefix (e.g., iMaCoMpUtERussyCPU in [js/cpu.js](js/cpu.js)).
- Use dynamic `import()` for heavy modules to avoid ESM chain issues ([js/app.js](js/app.js)).
- Always wrap errors with standardizeError from [lib/ErrorHandler.js](lib/ErrorHandler.js) before throwing.
- Validate inputs using sanitizeProgramName/validateMemoryAddress from [lib/validators.js](lib/validators.js); throws MCPError early.
- Use asyncHandler wrapper for Express routes; validation throws MCPError early in [server/mcp_server.js](server/mcp_server.js).
- Memory map uses UPPER_SNAKE_CASE constants (e.g., MEMORY_MAP, FLAGS).
- Relative import paths without .js extensions (Jest mapper handles).
- Use `typeof window` checks for browser globals ([js/app.js](js/app.js)).
- Two-pass assembly with expression eval in [js/assembler.js](js/assembler.js).
- Custom video operations VLD/VST/VUP/VDL in [js/cpu.js](js/cpu.js).