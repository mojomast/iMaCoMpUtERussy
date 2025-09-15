# MCP Server Integration Tests

Comprehensive integration test suite that validates the autonomous agent can successfully execute generated code using the MCP server emulator in real-time.

## Overview

This integration test suite provides end-to-end validation of:

- **Real-time code generation** and execution
- **Interactive debugging workflows**
- **Performance benchmarking**
- **Error recovery mechanisms**
- **Health monitoring and metrics collection**

## Quick Start

```bash
# Run all integration tests
npm test

# Run in CI mode (with JUnit output)
npm run test:ci

# Run specific test categories
npm run test:client       # MCP client integration tests
npm run test:agent        # Agent-MCP server integration
npm run test:debugging    # Real-time debugging workflows
```

## Prerequisites

- Node.js 18+
- MCP Server running on localhost:3000
- Autonomous Software Agent configured
- Queue manager system operational

## Test Categories

### 🔌 MCP Client Integration Tests
Validates all MCP client methods work with live server endpoints:

```javascript
// Test CPU operations
await client.resetCPU();
await client.getCPUState();

// Test memory operations
await client.readMemory(0x2000, 1);
await client.writeMemory(0x2000, 42);

// Test assembly and execution
const result = await client.assembleAndRun(assemblyCode);
```

### 🤖 Agent-MCP Server Integration Tests
Tests complete workflow from natural language prompts to executed code:

```javascript
const agent = new AutonomousSoftwareAgent({
  mcpServerUrl: 'http://localhost:3000'
});

// Add generation task
await agent.queue.addPrompt({
  prompt: "Create a program that adds two numbers",
  type: "generation"
});

// Agent automatically processes and executes
```

### 🐛 Real-time Debugging Integration Tests
Validates debugging workflows and breakpoint management:

```javascript
// Set breakpoint at specific address
await client.setBreakpoint(0x0602);

// Trace execution with breakpoints
const trace = await client.traceExecution(50);

// Inspect memory regions
const memory = await client.inspectMemory(0x00, 64);
```

### ⚡ Performance and Load Tests
Tests concurrent operations and performance metrics:

```javascript
// Run concurrent operations
const results = await Promise.all(
  Array(10).fill().map(() =>
    client.assembleAndRun(testAssembly, { maxSteps: 100 })
  )
);

// Measure performance
const metrics = await collectIntegrationMetrics();
console.log(`Throughput: ${metrics.throughput} ops/sec`);
```

### 💪 Error Recovery Tests
Validates resilience and error handling:

```javascript
// Test server unavailability
await mockServerDown();

// Agent recovers with retry logic
const result = await agent.processNextTask();
assert(result.success, 'Agent recovered from server failure');
```

## Configuration

Tests can be configured via environment variables:

```bash
# Enable debug logging
DEBUG_TESTS=true npm test

# Set custom MCP server URL
MCP_SERVER_URL=http://localhost:9000 npm test

# Enable parallel test execution
PARALLEL_TESTS=4 npm test
```

## Health Monitoring

The test suite provides comprehensive health monitoring:

```bash
# Check system health
npm run health

# Collect metrics
npm run report

# Generate JUnit reports
npm run junit
```

### Health Metrics
- **Client Connection**: MCP server connectivity
- **Server Status**: Server availability and responsiveness
- **Integration Tests**: End-to-end workflow validation
- **Performance Metrics**: Response times and throughput
- **Error Recovery**: Failure handling and retry logic

## Performance Benchmarking

Run detailed performance analysis:

```bash
# Benchmark all operations
npm run test:perf

# Custom benchmark (iterations)
node -e "import('./agent-mcp-integration.js').then(m => m.benchmarkMCPServer(500))"
```

## CI/CD Integration

The test suite supports CI/CD workflows:

```bash
# Run with JUnit output
npm run test:ci

# Generate XML reports
npm run junit

# Custom reporting directory
OUTPUT_DIR=./reports npm run test:ci
```

## Debugging and Troubleshooting

### Common Issues

1. **MCP Server Not Running**
   ```bash
   # Start MCP server
   npm run mcp-server
   # Then run tests
   npm test
   ```

2. **Port Conflicts**
    ```bash
    # Check if port 3000 is available
    lsof -i :3000
    # Kill conflicting process
    kill -9 $(lsof -t -i :3000)
    ```

3. **Timeout Issues**
   ```bash
   # Increase timeout for slow systems
   TIMEOUT=60000 npm test
   ```

### Debug Mode

Enable debug logging for detailed test execution:

```bash
DEBUG_TESTS=true npm test
```

This creates detailed logs in `integration/logs/` directory.

## Test Structure

```
integration/
├── agent-mcp-integration.js    # Main test suite
├── test-utils.js              # Utilities and helpers
├── package.json               # Test dependencies
├── README.md                  # This file
├── reports/                   # Test reports (generated)
└── logs/                      # Debug logs (generated)
```

## API Reference

### Test Runner API

```javascript
import { runAllIntegrationTests, testMCPClientIntegration } from './agent-mcp-integration.js';

// Run all tests
await runAllIntegrationTests();

// Run specific test
await testMCPClientIntegration();
```

### Test Utilities API

```javascript
import {
  MCPTestServerManager,
  PerformanceMonitor,
  TestAssertions
} from './test-utils.js';

// Server management
const server = new MCPTestServerManager();
await server.start();
await server.stop();

// Performance monitoring
performanceMonitor.startSession('test-session');
// ... run operations ...
performanceMonitor.endSession();
const stats = performanceMonitor.getStatistics();

// Assertions
TestAssertions.assertMCPResponse(response, expectedStructure);
```

## Contributing

### Adding New Tests

1. Add test function to `agent-mcp-integration.js`
2. Register with test runner using `testRunner.addTest()`
3. Add assertions and cleanup logic
4. Update this README if needed

### Test Best Practices

- **Isolation**: Tests should be independent and not rely on external state
- **Cleanup**: Always clean up resources after tests
- **Timeouts**: Set reasonable timeouts for async operations
- **Assertions**: Use descriptive assertion messages
- **Error Handling**: Test both success and failure scenarios

## License

MIT License - see project root for details.