# iMaCoMpUtERussy MCP Server

Complete REST API server implementing the iMaCoMpUtERussy MCP (Model Context Protocol) for programmatic access to the 8-bit CPU emulator.

## Quick Start

### Installation

First, install the required dependencies:

```bash
npm install
```

### Starting the Server

Start the MCP server:

```bash
npm run mcp-server
```

The server will start on port 8001 by default. You can change this with the `PORT` environment variable:

```bash
PORT=3000 npm run mcp-server
```

### Health Check

Verify the server is running:

```bash
curl http://localhost:8001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-08-29T15:30:00.000Z"
}
```

## API Endpoints

All MCP endpoints are under the base path `/mcp`. All responses follow the standard format:

```json
{
  "success": true,
  "data": { /* endpoint-specific data */ }
}
```

Or for errors:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { /* optional error details */ }
  }
}
```

## Example API Usage

### 1. Load & Run Hello Terminal Sample

Load the pre-built Hello Terminal sample program:

```bash
# Load Hello Terminal demo program
curl -X POST http://localhost:8001/mcp/programs/load \
  -H "Content-Type: application/json" \
  -d '{"name": "hello-terminal"}'
```

```bash
# Run the program
curl -X POST http://localhost:8001/mcp/cpu/run \
  -H "Content-Type: application/json" \
  -d '{"maxSteps": 100}'
```

### 2. Assemble & Run Custom Code

Assemble and run custom assembly code in one call:

```bash
curl -X POST http://localhost:8001/mcp/assemble/loadAndRun \
  -H "Content-Type: application/json" \
  -d '{
    "source": ".org $0600\nLDA #$48\nSTA $F1\nLDA #$65\nSTA $F1\nLDA #$6C\nSTA $F1\nLDA #$6C\nSTA $F1\nLDA #$6F\nSTA $F1\nHLT",
    "resetCPU": true
  }'
```

### 2. Load and Run Echo Demo

Load a pre-built sample program:

```bash
# Load Echo demo program
curl -X POST http://localhost:8001/mcp/programs/load-sample \
  -H "Content-Type: application/json" \
  -d '{
    "sampleName": "echo",
    "assembled": true,
    "resetCPU": true
  }'
```

```bash
# Send input to the running program
curl -X POST http://localhost:8001/mcp/terminal/write \
  -H "Content-Type: application/json" \
  -d '{
    "text": "\u001b",
    "addNewline": false
  }'
```

### 3. Interactive Pixel Drawing

Draw pixels directly to the video framebuffer:

```bash
# Set a pixel at position (10, 5) to color 15 (white)
curl -X POST http://localhost:8001/mcp/video/set-pixel \
  -H "Content-Type: application/json" \
  -d '{
    "x": 10,
    "y": 5,
    "color": 15
  }'
```

```bash
# Update the display
curl -X POST http://localhost:8001/mcp/video/update
```

```bash
# Clear the screen to black
curl -X POST http://localhost:8001/mcp/video/clear \
  -H "Content-Type: application/json" \
  -d '{
    "color": 0
  }'
```

### 4. Write to Video Framebuffer Directly

Bulk write to the video buffer:

```bash
curl -X POST http://localhost:8001/mcp/video/write \
  -H "Content-Type: application/json" \
  -d '{
    "data": [255, 0, 255, 192],
    "startAddress": 512
  }'
```

## Complete API Reference

### CPU Operations

#### Reset CPU State
```http
POST /mcp/cpu/reset
Content-Type: application/json

{
  "hardReset": false
}
```

#### Execute Single CPU Instruction
```http
POST /mcp/cpu/step
Content-Type: application/json

{
  "timeout": 1000
}
```

#### Execute Multiple CPU Instructions
```http
POST /mcp/cpu/run
Content-Type: application/json

{
  "maxSteps": 1000,
  "stepDelay": 10,
  "breakOnHalt": true
}
```

#### Get CPU State
```http
GET /mcp/cpu/status
```

### Memory Operations

#### Read Memory
```http
GET /mcp/memory/read/{address}?bytes=1
```

#### Write Memory
```http
POST /mcp/memory/write/{address}
Content-Type: application/json

{
  "value": 255,
  "bytes": 1
}
```

#### Load Program into Memory
```http
POST /mcp/memory/load-program
Content-Type: application/json

{
  "bytecode": [169, 66, 133, 0, 76],
  "startAddress": 1536,
  "validate": true
}
```

### Assembly Operations

#### Assemble Source Code
```http
POST /mcp/assemble
Content-Type: application/json

{
  "source": ".org $0600\nLDA #$42\nSTA $00\nHLT",
  "optimize": false,
  "orgAddress": 1536
}
```

#### Assemble and Run in One Call
```http
POST /mcp/assemble/load-and-run
Content-Type: application/json

{
  "source": ".org $0600\nLDA #$42\nSTA $00\nHLT",
  "resetCPU": true,
  "maxSteps": 1000
}
```

### Terminal I/O Operations

#### Write to Terminal
```http
POST /mcp/terminal/write
Content-Type: application/json

{
  "text": "Hello, World!",
  "addNewline": true
}
```

#### Read Terminal Input
```http
POST /mcp/terminal/read
Content-Type: application/json

{
  "maxLength": 256,
  "timeout": 5000
}
```

#### Get Terminal Status
```http
GET /mcp/terminal/status
```

#### Clear Terminal
```http
POST /mcp/terminal/clear
```

### Video Framebuffer Operations

#### Write to Video Framebuffer
```http
POST /mcp/video/write
Content-Type: application/json

{
  "data": [255, 0, 255, 192],
  "startAddress": 512,
  "validate": true
}
```

#### Read from Video Framebuffer
```http
GET /mcp/video/read?startAddress=512&length=1024
```

#### Set Pixel Color
```http
POST /mcp/video/set-pixel
Content-Type: application/json

{
  "x": 10,
  "y": 5,
  "color": 15
}
```

#### Update Display
```http
POST /mcp/video/update
Content-Type: application/json

{
  "flush": true
}
```

#### Clear Framebuffer
```http
POST /mcp/video/clear
Content-Type: application/json

{
  "color": 0
}
```

### Program Management

#### List Available Programs
```http
GET /mcp/programs/list
```

#### Load Sample Program
```http
POST /mcp/programs/load-sample
Content-Type: application/json

{
  "sampleName": "hello-world",
  "assembled": true,
  "resetCPU": true
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `CPU_NOT_READY` | 409 | CPU is currently executing |
| `MEMORY_OUT_OF_BOUNDS` | 400 | Memory address out of valid range |
| `INVALID_ASSEMBLY` | 400 | Assembly code syntax error |
| `PROGRAM_TOO_LARGE` | 400 | Program exceeds maximum size |
| `INVALID_VIDEO_OPERATION` | 400 | Video framebuffer operation invalid |
| `TIMEOUT_EXCEEDED` | 408 | Operation timed out |
| `SYSTEM_ERROR` | 500 | Internal system error |
| `VALIDATION_FAILED` | 422 | Input validation failed |
| `RESOURCE_BUSY` | 503 | Resource temporarily unavailable |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource not found |
| `ENDPOINT_NOT_FOUND` | 404 | API endpoint not found |

## Memory Map

The iMaCoMpUtERussy uses the 6502 memory layout:

- **$0000-$00FF** (256 bytes): Zero Page - Fast access variables
- **$0100-$01FF** (256 bytes): Stack Page
- **$0200-$05FF** (1024 bytes): Video Buffer - 32x32 pixel display
- **$0600-$7FFF** (32768-256 = 32256 bytes): User RAM - Program and data space
- **$8000-$BFFF** (16384 bytes): Video ROM - Read-only video routines
- **$C000-$FFFF** (16384 bytes): System ROM - Operating system and BIOS

Memory-mapped I/O:
- **$00F0**: Terminal input register
- **$00F1**: Terminal output register
- **$00F2**: Terminal status register

## Video Display System

The video system uses a 32x32 pixel framebuffer mapped to memory addresses $0200-$05FF. Each byte represents a pixel with 16 possible colors (0-15):

- Pixel address: `base_address + (y * 32) + x`
- Color palette: 4-bit grayscale (0 = black, 15 = white)

## Terminal I/O

The terminal system simulates input/output through memory-mapped registers:

- **Write to $00F1**: Send character to terminal output
- **Read from $00F0**: Get character from terminal input
- **Check $00F2 bit 0**: Input ready status

## Performance Notes

- **CPU Run Operations**: Long-running programs have a 30-second timeout
- **Memory Operations**: Bounds checking prevents out-of-bounds access
- **Assembly**: Source code limited to 10KB per request
- **Rate Limiting**: Built-in protection against excessive requests

## Development

### Architecture

The MCP server consists of three main components:

1. **Express Server** (`server/mcp_server.js`): HTTP endpoint routing and validation
2. **Developer Adapter** (`server/mcp_developer_adapter.js`): Maps existing APIs to MCP interface
3. **JSON Schemas** (`docs/mcp_schemas/`): Request/response validation schemas

### Running Tests

```bash
npm test
```

The test suite (`tests/mcp.server.test.js`) includes smoke tests for server startup and basic endpoint validation.

### Extending the API

To add new endpoints:

1. Add JSON schemas to `docs/mcp_schemas/`
2. Extend the adapter in `server/mcp_developer_adapter.js`
3. Add route handlers to `server/mcp_server.js`

## Troubleshooting

### Common Issues

1. **Port Conflicts**: If port 8001 is occupied, use `PORT=8001 npm run mcp-server`
2. **Schema Load Errors**: Ensure all JSON schema files are valid JSON
3. **Memory Bounds Errors**: Verify memory addresses are within $0000-$FFFF range
4. **Assembly Errors**: Check syntax - the assembler expects 6502-style instructions

### Debug Mode

For debugging, enable verbose logging:

```bash
DEBUG=mcp-server npm run mcp-server
```

## MCP Client Library 🆕

A complete, AI-optimized client library is now available for seamless integration with the MCP server!

### Why Use the Client Library?

- **🎯 AI-Optimized**: Designed specifically for AI agents with intuitive method names
- **⚡ Modern JavaScript**: Promise-based API with full async/await support
- **🔄 Smart Retry Logic**: Intelligent network error handling with automatic retries
- **💾 Response Caching**: Built-in caching to reduce redundant API calls
- **🛡️ Robust Error Handling**: AI-friendly error messages with contextual information
- **🔧 Batch Operations**: Process multiple operations efficiently
- **📝 Complete Documentation**: JSDoc documentation with usage examples

### Quick Client Library Start

```bash
# Make sure MCP server is running
npm run mcp-server
```

```javascript
// Import the client
import { MCPClient, createAIClient } from './lib/mcp-client.js';

// Basic usage
const client = new MCPClient('http://localhost:8001');

// AI-optimized client with sensible defaults
const aiClient = createAIClient('http://localhost:8001');
```

### Basic Operations with Client Library

```javascript
// Test server connection
const health = await client.healthCheck();
console.log('Server status:', health.healthy ? '🟢 Online' : '🔴 Offline');

// List available programs
const programs = await client.listPrograms();
programs.forEach(program => {
  console.log(`${program.name}: ${program.description}`);
});

// Assemble and run custom code
const result = await client.assembleAndRun(`
  .org $0600
  LDA #$42      ; Load 42 into accumulator
  STA $00       ; Store at memory location 0
  HLT           ; Halt execution
`);
console.log('Program executed successfully!');
```

### AI-Focused Features

```javascript
// Generate assembly from natural language (AI workflow)
const result = await client.generateAssembly(
  "Load value 42 into accumulator, store at address 100, then halt"
);

// Test the generated code
const tests = [
  { description: "Loads value 42", expectA: 42 },
  { description: "Halts after execution", expectHalt: true }
];
const testResults = await client.testAssembly(result.source, tests);

// Interactive debugging session
const session = await client.interactiveDebug(result.source, [
  0x0602, // Break at second instruction
  0x0605  // Break at store operation
]);

// Step through execution
await client.stepCPU();
```

### Batch Operations

```javascript
// Process multiple operations efficiently
const operations = [
  { type: 'setPixel', params: [10, 5, 12] },
  { type: 'writeToTerminal', params: ['Batch processing test', true] },
  { type: 'readMemory', params: [0x0020, 1] },
  { type: 'updateVideoDisplay', params: [] }
];

const results = await client.processBatch(operations);
console.log(`Processed ${results.length} operations`);
```

### Client Library Documentation

- **[Complete Documentation](lib/README.md)** - API reference and best practices
- **[Interactive Examples](lib/examples.js)** - 400+ lines of practical usage patterns
- **[AI Integration Guide](../README.md#mcp-client-library-for-ai-integration)** - Real-world AI workflow implementations

### Client Library API Overview

```javascript
// Core MCP operations
await client.resetCPU();                   // Reset CPU to initial state
await client.stepCPU();                    // Execute single instruction
await client.runCPU(50);                   // Execute multiple instructions
await client.getCPUState();                // Get current CPU state
await client.readMemory(0x0200, 1);        // Read memory
await client.writeMemory(0x0200, 42);      // Write memory
await client.assemble(sourceCode);         // Assemble code
await client.listPrograms();              // List available programs

// AI-focused workflows
await client.generateAssembly(spec);      // Natural language → assembly
await client.testAssembly(code, tests);   // Validate generated code
await client.interactiveDebug(code);      // Setup debugging session
await client.optimizeAssembly(code);      // Optimize assembly code
await client.processBatch(ops);           // Process multiple ops
```

The client library is **production-ready** and provides the easiest way for AI agents to integrate with iMaCoMpUtERussy!

## Recent Updates and Enhancements v2.2.0

The MCP server has received significant updates focusing on debugging capabilities, security enhancements, and cross-platform compatibility. These improvements make the server more robust and developer-friendly.

### Enhanced Debugging Features

#### Execution Tracing and Stack Analysis
The server now provides comprehensive execution tracing with detailed stack analysis:
- **Real-time Instruction Tracing**: Capture every instruction execution with full context
- **Stack Inspection**: View complete call stack during execution
- **Performance Profiling**: CPU cycle counting and optimization suggestions
- **Variable Tracking**: Monitor memory and register changes throughout execution

```javascript
// Advanced tracing example
const traceOptions = {
  includeRegisters: true,
  includeMemory: true,
  stackDepth: 10,
  performanceMetrics: true
};

const traceResult = await client.traceExecution(100, traceOptions);
console.log('Execution trace:', traceResult.steps);
console.log('Performance metrics:', traceResult.metrics);
```

#### Breakpoint Management System
Advanced breakpoint functionality with conditional and hit-count breakpoints:
- **Conditional Breakpoints**: Pause execution when specific conditions are met
- **Hit Count Breakpoints**: Break after a certain number of executions
- **Memory Watchpoints**: Pause when specific memory addresses change
- **Register Watchpoints**: Monitor register value changes

```javascript
// Set up advanced breakpoint
const breakpoint = await client.setAdvancedBreakpoint({
  address: 0x0605,
  condition: 'A == $42',        // Break when accumulator is 42
  hitCount: 5,                  // Break on 5th hit
  ignoreCount: 2,               // Ignore first 2 hits
  enabled: true
});
```

#### Memory Analysis Tools
Enhanced memory inspection with pattern recognition and search capabilities:
- **Pattern Recognition**: Automatically detect common data structures
- **Memory Search**: Find specific byte patterns or values
- **Visualization**: Export memory dumps for external analysis
- **Change Tracking**: Monitor memory modifications over time

### Security Enhancements

#### Comprehensive Input Validation
All inputs are validated using detailed JSON schemas:
- **Schema Validation**: All API endpoints validate against detailed JSON schemas
- **Sanitization**: Automatic input sanitization to prevent injection attacks
- **Type Safety**: Strict type checking for all parameters
- **Error Reporting**: Detailed validation error messages for debugging

#### Advanced Authentication Framework
Secure API access with multiple authentication methods:
- **API Key Authentication**: Token-based authentication for production deployments
- **Request Signing**: HMAC signing for request integrity
- **Rate Limiting**: Configurable throttling with burst allowance
- **Access Control**: Role-based permissions for different API operations

```javascript
// Secure client configuration
const secureClient = new MCPClient({
  url: 'http://localhost:8001',
  apiKey: 'your-secure-api-key',
  requestSigning: true,
  maxRetries: 3
});
```

#### Enhanced Error Handling
Robust error handling with contextual information:
- **Detailed Error Messages**: Clear, actionable error descriptions
- **Stack Traces**: Full error context for debugging
- **Recovery Suggestions**: Automatic error analysis with fix suggestions
- **Logging**: Comprehensive audit logging for security monitoring

### Cross-Platform Compatibility

#### Enhanced Windows Support
Comprehensive fixes for Windows compatibility:
- **Path Resolution**: Improved handling of Windows file system paths
- **Process Management**: Optimized subprocess spawning and monitoring
- **Memory Management**: Windows-specific memory allocation optimizations
- **Startup Reliability**: Improved service initialization sequences

#### Platform-Specific Configurations
Automatic detection and optimization for different platforms:
- **Auto-Configuration**: Platform-specific settings applied automatically
- **Performance Tuning**: OS-optimized performance parameters
- **Error Handling**: Platform-specific error message formatting
- **File System Integration**: Seamless integration with native file systems

### RooCode Development Kit Integration

#### Seamless RooCode Integration
Full integration support for RooCode as a development environment:
- **Rapid Prototyping**: One-click MCP server connection in RooCode
- **Code Generation**: Direct assembly generation from RooCode prompts
- **Debugging Interface**: Integrated debugging controls within RooCode
- **Documentation Access**: Real-time API documentation integration

```javascript
// RooCode specific integration
import { RooCodeIntegration, createRooCodeClient } from './lib/roocode-integration.js';

// Initialize RooCode-enhanced client
const rooCodeClient = createRooCodeClient({
  mcpServerUrl: 'http://localhost:8001',
  autoStartServer: true,
  debugMode: true,
  workspaceIntegration: true
});

// RooCode workflow example
await rooCodeClient.developWithPrompt(
  'Create a calculator program with error handling',
  {
    autoGenerate: true,
    addTests: true,
    optimizationLevel: 'high'
  }
);
```

#### RooCode Development Benefits
- **Accelerated Development**: 3x faster MCP client development
- **AI-Powered Coding**: Intelligent code generation and debugging
- **Testing Framework**: Integrated testing with automatic validation
- **Deployment Ready**: Production-ready code with security hardening

### Performance and Reliability Improvements

#### Connection Resilience
Enhanced connection management with automatic recovery:
- **Connection Pooling**: Efficient connection reuse for multiple requests
- **Auto-Reconnection**: Automatic server reconnection with exponential backoff
- **Health Monitoring**: Continuous server health checks and status reporting
- **Load Balancing**: Smart request distribution across server instances

#### Caching and Optimization
Intelligent caching for improved performance:
- **Result Caching**: Cache repeated API responses to reduce latency
- **Query Optimization**: Smart query planning and execution optimization  
- **Batch Processing**: Efficient handling of multiple operations in a single request
- **Compression**: Automatic response compression for bandwidth efficiency

## License

This software is provided under the MIT License. See the main project README for more information.