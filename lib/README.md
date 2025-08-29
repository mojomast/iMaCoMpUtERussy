# iMaCoMpUtERussy MCP Client Library

A robust, promise-based MCP (Model Context Protocol) client library designed specifically for AI agents to interact with the iMaCoMpUtERussy emulator through the MCP server.

## Features

- ✅ **Promise-based API** with async/await support
- ✅ **Configurable timeout and retry logic** for network resilience
- ✅ **Comprehensive error handling** with AI-friendly messages
- ✅ **Response caching** for frequently-accessed data
- ✅ **Cross-platform compatibility** (Node.js & browser)
- ✅ **Special AI-focused workflows** and utilities
- ✅ **Batch operations support** for multiple sequential operations
- ✅ **Comprehensive JSDoc documentation** with usage examples

## Quick Start

### Installation

```bash
# Install the iMaCoMpUtERussy project (includes MCP server)
git clone https://github.com/kyledurepos/imacomputerussy.git
cd imacomputerussy
npm install

# Start the MCP server
npm run mcp-server
```

### Basic Usage

```javascript
// For Node.js
import { MCPClient } from './lib/mcp-client.js';

// For browser (if bundling)
import { MCPClient } from './lib/mcp-client.js';

async function main() {
  // Create client instance
  const client = new MCPClient('http://localhost:8001');

  try {
    // Test connection
    const health = await client.healthCheck();
    console.log('MCP Server Health:', health);

    // List available programs
    const programs = await client.listPrograms();
    console.log('Available programs:', programs.length);

    // Assemble and run a simple program
    const source = `
      .org $0600
      LDA #$42    ; Load 42 into accumulator
      STA $00     ; Store at memory location 0
      HLT         ; Halt execution
    `;

    const result = await client.assembleAndRun(source);
    console.log('Execution result:', result);

    // Check CPU state
    const state = await client.getCPUState();
    console.log('Final CPU state:', state);

  } catch (error) {
    console.error('MCP Error:', error.message);
  }
}

main();
```

## API Overview

### Core MCPClient Class

All operations map directly to MCP server endpoints:

#### CPU Operations
```javascript
await client.resetCPU();             // Reset CPU to initial state
await client.stepCPU();              // Execute single instruction
await client.runCPU(steps);          // Execute multiple instructions
await client.getCPUState();          // Get current CPU state
```

#### Memory Operations
```javascript
await client.readMemory(0x0200, 1);     // Read byte from address
await client.writeMemory(0x0200, 42);   // Write byte to address
await client.loadProgramToMemory(bytecode, 0x0600); // Load bytecode
```

#### Assembly Operations
```javascript
await client.assemble(sourceCode);          // Assemble to bytecode
await client.assembleAndRun(sourceCode);    // Assemble, load, and execute
```

#### Program Management
```javascript
await client.listPrograms();        // List sample programs
await client.loadProgram('hello-world'); // Load program by name
await client.saveProgram('my-program', source); // Save assembly source
```

#### Terminal Operations
```javascript
await client.writeToTerminal('Hello!');  // Write to terminal
await client.readFromTerminal();         // Read from terminal
await client.clearTerminal();            // Clear terminal buffer
```

#### Video Operations
```javascript
await client.setPixel(10, 5, 15);     // Set pixel color
await client.updateVideoDisplay();     // Update display
await client.clearVideoDisplay(0);     // Clear display
```

#### Debug Operations
```javascript
await client.setBreakpoint(0x0602);    // Set breakpoint
await client.traceExecution(100);      // Trace execution
await client.inspectMemory(0x0600);    // Inspect memory
```

## AI-Focused Workflows

### Code Generation & Testing

```javascript
// Generate assembly from natural language
const result = await client.generateAssembly(
  "Load value 42 into accumulator, store at address 100, then halt",
  { maxInstructions: 5 }
);

// Test generated code
const tests = [
  { description: "Loads value 42", expectA: 42 },
  { description: "Halts after execution", expectHalt: true }
];
const testResults = await client.testAssembly(result.source, tests);
```

### Interactive Debugging

```javascript
// Set up debugging session
const assembly = `
  .org $0600
  LDA #$42
  STA $00
  INC $00
  HLT
`;

const session = await client.interactiveDebug(assembly, [
  0x0603, // Break after store
  0x0605  // Break after increment
]);

// Step through execution
await client.stepCPU(); // Execute LDA #$42
await client.stepCPU(); // Execute STA $00
await client.stepCPU(); // Execute INC $00
```

### Batch Processing

```javascript
// Execute multiple operations sequentially
const operations = [
  { type: 'setPixel', params: [10, 5, 12] },
  { type: 'setPixel', params: [11, 5, 14] },
  { type: 'writeToTerminal', params: ['Batch complete'] },
  { type: 'updateVideoDisplay', params: [] }
];

const results = await client.processBatch(operations);
console.log(`Processed ${results.length} operations`);
```

### Code Optimization

```javascript
const source = `
.org $0600
LDA #$42
STA $00
`;

const optimized = await client.optimizeAssembly(source, {
  minimizeSize: true,
  minimizeCycles: false
});

console.log('Size reduction:', optimized.improvements.sizeReduction, 'bytes');
```

## Configuration Options

```javascript
const client = new MCPClient('http://localhost:8001', {
  timeoutMs: 30000,        // Request timeout (30 seconds)
  retryAttempts: 3,        // Number of retry attempts
  retryDelayMs: 1000,      // Delay between retries (1 second)
  enableCache: true,       // Enable response caching
  cacheTTLMs: 300000,      // Cache TTL (5 minutes)
  maxCacheSize: 100,       // Maximum cached entries
  userAgent: 'MyAI/1.0'    // Custom user agent
});
```

## Error Handling

The client provides comprehensive error handling for AI-friendly consumption:

```javascript
try {
  await client.executeInstruction();
} catch (error) {
  if (error.code === 'CPU_NOT_READY') {
    console.log('CPU is currently busy. Please wait.');
  } else if (error.code === 'NETWORK_ERROR') {
    console.log('Network issue:', error.details.originalError);
  } else {
    console.log('Unknown error:', error.message);
  }
}
```

## Browser Compatibility

> **Note:** The client requires a modern browser with `fetch` API support. For older browsers, include a `fetch` polyfill.

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/fetch-polyfill"></script>
  <script type="module" src="lib/mcp-client.js"></script>
</head>
<body>
  <script>
    import { MCPClient } from './lib/mcp-client.js';
    // Your browser code here
  </script>
</body>
</html>
```

## Node.js Usage

```javascript
// ES6 Modules
import { MCPClient } from './lib/mcp-client.js';

// CommonJS (if configured)
const { MCPClient } = require('./lib/mcp-client.js');

const client = new MCPClient();
```

## Advanced Features

### Custom HTTP Headers

```javascript
const client = new MCPClient('http://localhost:8001', {
  // Custom headers for all requests
  userAgent: 'MyCustomAgent/1.0'
});

// Or per request (requires extending client)
```

### Timeout Management

```javascript
// Global timeout
await client.setTimeout(5000); // 5 second timeout

// Per-operation timeout (not implemented yet - extend as needed)
```

### Cache Management

```javascript
// Clear response cache
await client.clearCache();

// Check cache statistics
const config = client.getConfig();
console.log('Cache enabled:', config.enableCache);
console.log('Cache TTL:', config.cacheTTLMs);
```

## Migration from Direct HTTP Calls

If you're migrating from direct HTTP calls to the MCP server:

```javascript
// Before (direct HTTP)
const response = await fetch('http://localhost:8001/mcp/cpu/state');
const data = await response.json();

// After (MCP Client)
const data = await client.getCPUState();
```

## Best Practices

### For AI Agents

1. **Handle Timeouts Gracefully** - Network operations can fail
2. **Use Appropriate Retry Logic** - AI workflows are often iterative
3. **Leverage Caching** - Reduce redundant requests
4. **Validate Assembly** - Test generated code before execution
5. **Monitor CPU State** - Track execution progress

### Performance

1. **Enable Caching** for frequently-accessed data
2. **Use Batch Operations** for multiple related operations
3. **Configure Appropriate Timeouts** based on network conditions
4. **Monitor Error Rates** and adjust retry strategies

### Error Handling

1. **Categorize Errors** using error codes
2. **Provide User-Friendly Messages** for AI consumption
3. **Implement Exponential Backoff** for retries
4. **Log Important Operations** for debugging

## Supported Error Codes

The client uses the same error codes as the MCP server:

- `CPU_NOT_READY` - CPU is currently executing
- `MEMORY_OUT_OF_BOUNDS` - Invalid memory address
- `INVALID_ASSEMBLY` - Syntax error in assembly code
- `PROGRAM_NOT_FOUND` - Program doesn't exist
- `PROGRAM_EXISTS` - Program already exists
- `TERMINAL_BUSY` - Terminal is currently busy
- `VIDEO_OUT_OF_BOUNDS` - Invalid video coordinates
- `INVALID_BREAKPOINT` - Invalid breakpoint operation
- `TIMEOUT_EXCEEDED` - Operation timed out
- `NETWORK_ERROR` - Network connectivity issue

## Contributing

Please see the main project documentation for contribution guidelines.

## License

MIT License - see main project LICENSE file.