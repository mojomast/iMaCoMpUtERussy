# MCP Implementation Documentation

## Overview

The iMaCoMpUtERussy MCP (Model Context Protocol) implementation provides a REST API server for programmatic interaction with the 8-bit CPU emulator. This document verifies and updates the existing MCP documentation based on the actual implementation.

## Server Architecture

### Core Components

1. **MCP Server** (`server/mcp_server.js`)
   - Express.js REST API server
   - JSON schema validation using AJV
   - Rate limiting with express-rate-limit
   - Circuit breaker pattern for error handling
   - Winston structured logging

2. **Developer Adapters** (`server/mcp_developer_adapter.js`)
   - Bridge between MCP API and emulator core
   - Consistent response format handling
   - Error standardization

3. **Error Handling** (`server/mcp_errors.js`)
   - Custom MCPError class
   - Circuit breaker implementation
   - Retry logic with exponential backoff

## Server Configuration

### Port and Binding
- **Default Port**: 3000 (configurable via `PORT` environment variable)
- **Binding**: 127.0.0.1 (localhost only for security)
- **Health Check**: `GET /health`

### Authentication
- **API Key Authentication**: Required for most endpoints
- **Header**: `X-API-Key` or `Authorization`
- **Default Key**: `default-api-key-change-in-production` (change for production)

### Rate Limiting
- **Intense Operations**: 10 requests per 15 minutes
- **Moderate Operations**: 25 requests per 5 minutes  
- **Lenient Operations**: 100 requests per minute

## API Endpoints

### CPU Operations

#### POST /mcp/cpu/reset
Reset CPU to initial state.

**Request Schema**: `cpu.reset.request.json`
```json
{
  "hardReset": false
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "CPU reset successfully",
    "pc": 1536,
    "resetType": "soft"
  }
}
```

#### POST /mcp/cpu/step
Execute single CPU instruction.

**Request Schema**: `cpu.step.request.json`
```json
{
  "timeout": 1000
}
```

**Response Schema**: `cpu.step.response.json`
```json
{
  "success": true,
  "data": {
    "pc": 1536,
    "instruction": "LDA #$42",
    "opcode": 169,
    "cycles": 2,
    "cpuState": {
      "a": 66,
      "x": 0,
      "y": 0,
      "sp": 255,
      "flags": {
        "z": false,
        "n": false,
        "c": false,
        "v": false
      }
    }
  }
}
```

#### POST /mcp/cpu/run
Execute multiple CPU instructions.

**Request Schema**: `cpu.run.request.json`
```json
{
  "maxSteps": 1000,
  "stepDelay": 1,
  "breakOnHalt": true
}
```

**Response Schema**: `cpu.run.response.json`
```json
{
  "success": true,
  "data": {
    "stepsExecuted": 45,
    "halted": true,
    "finalPC": 1581,
    "finalState": {
      "a": 0,
      "x": 0,
      "y": 0,
      "running": false
    }
  }
}
```

#### GET /mcp/cpu/state
Get current CPU state.

**Response Schema**: `cpu.state.response.json`
```json
{
  "success": true,
  "data": {
    "pc": 1536,
    "a": 0,
    "x": 0,
    "y": 0,
    "running": false,
    "flags": {
      "z": true,
      "n": false,
      "c": false,
      "v": false,
      "i": false,
      "d": false
    }
  }
}
```

### Memory Operations

#### POST /mcp/memory/read
Read bytes from memory.

**Request Schema**: `memory.read.request.json`
```json
{
  "address": 1536,
  "bytes": 4
}
```

**Response Schema**: `memory.read.response.json`
```json
{
  "success": true,
  "data": {
    "address": 1536,
    "bytes": 4,
    "byteArray": [169, 66, 133, 0],
    "endAddress": 1539
  }
}
```

#### POST /mcp/memory/write
Write bytes to memory.

**Request Schema**: `memory.write.request.json`
```json
{
  "address": 1536,
  "value": 169,
  "bytes": 1
}
```

**Response Schema**: `memory.write.response.json`
```json
{
  "success": true,
  "data": {
    "address": 1536,
    "value": 169,
    "bytes": 1
  }
}
```

#### POST /mcp/memory/loadProgram
Load bytecode into memory.

**Request Schema**: `memory.loadProgram.request.json`
```json
{
  "bytecode": [169, 66, 133, 0, 58],
  "startAddress": 1536,
  "validate": true
}
```

**Response Schema**: `memory.loadProgram.response.json`
```json
{
  "success": true,
  "data": {
    "bytesLoaded": 5,
    "startAddress": 1536,
    "endAddress": 1540
  }
}
```

#### POST /mcp/memory/saveState
Save memory state to file.

**Request**: 
```json
{
  "name": "state_name",
  "range": {
    "start": 0,
    "end": 65535
  },
  "overwrite": false
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "name": "state_name",
    "bytesSaved": 65536,
    "range": {
      "start": 0,
      "end": 65535
    },
    "savedAt": "2025-09-15T19:00:00.000Z"
  }
}
```

#### POST /mcp/memory/loadState
Load memory state from file.

**Request**:
```json
{
  "name": "state_name",
  "targetAddress": 0,
  "range": {
    "start": 0,
    "end": 65535
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "name": "state_name",
    "bytesLoaded": 65536,
    "targetAddress": 0,
    "range": {
      "start": 0,
      "end": 65535
    },
    "loadedAt": "2025-09-15T19:00:00.000Z"
  }
}
```

### Assembly Operations

#### POST /mcp/assemble/source
Assemble source code and return bytecode.

**Request Schema**: `assemble.source.request.json`
```json
{
  "source": ".org $0600\nLDA #$42\nSTA $00\nHLT",
  "origin": 1536
}
```

**Response Schema**: `assemble.source.response.json`
```json
{
  "success": true,
  "data": {
    "origin": 1536,
    "bytes": [169, 66, 133, 0, 58],
    "byteCount": 5,
    "sourceLength": 31
  }
}
```

#### POST /mcp/assemble/loadAndRun
Assemble, load to memory, and optionally run.

**Request Schema**: `assemble.loadAndRun.request.json`
```json
{
  "source": ".org $0600\nLDA #$42\nSTA $00\nHLT",
  "origin": 1536,
  "run": true,
  "maxSteps": 1000
}
```

**Response Schema**: `assemble.loadAndRun.response.json`
```json
{
  "success": true,
  "data": {
    "origin": 1536,
    "bytesLoaded": 5,
    "sourceLength": 31,
    "execution": {
      "stepsExecuted": 3,
      "startPC": 1536,
      "finalPC": 1540,
      "halted": true
    },
    "run": true,
    "maxSteps": 1000
  }
}
```

### Program Management

#### GET /mcp/programs/list
List available sample programs.

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "name": "hello-world",
      "description": "Basic terminal output demo",
      "size": 156,
      "path": "samples/hello-world.asm"
    },
    {
      "name": "fibonacci",
      "description": "Mathematical computation example",
      "size": 89,
      "path": "samples/fibonacci.asm"
    }
  ]
}
```

#### POST /mcp/programs/load
Load program by name.

**Request**:
```json
{
  "name": "hello-world",
  "startAddress": 1536
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "name": "hello-world",
    "version": "1.1",
    "metadata": {
      "checksum": "a1b2c3d4...",
      "integrity": "sha256"
    },
    "bytesLoaded": 156,
    "startAddress": 1536,
    "checksum": "a1b2c3d4..."
  }
}
```

#### POST /mcp/programs/save
Save program with metadata.

**Request Schema**: `programs.save.request.json`
```json
{
  "name": "my_program",
  "source": ".org $0600\nLDA #$42\nHLT",
  "metadata": {
    "description": "Simple test program",
    "author": "Developer"
  },
  "overwrite": false
}
```

**Response Schema**: `programs.save.response.json`
```json
{
  "success": true,
  "data": {
    "name": "my_program",
    "size": 25,
    "path": "samples/my_program.asm",
    "version": "1.1",
    "metadata": {
      "description": "Simple test program",
      "author": "Developer",
      "checksum": "e5f6g7h8...",
      "integrity": "sha256"
    },
    "savedAt": "2025-09-15T19:00:00.000Z",
    "backupCreated": true,
    "checksum": "e5f6g7h8..."
  }
}
```

### Video Operations

#### POST /mcp/video/setPixel
Set pixel color at coordinates.

**Request Schema**: `video.setPixel.request.json`
```json
{
  "x": 10,
  "y": 5,
  "color": 15
}
```

**Note**: Schema validation corrected - Y coordinate maximum is properly set to 23 for 32×24 display.

**Response Schema**: `video.setPixel.response.json`
```json
{
  "success": true,
  "data": {
    "address": 672
  }
}
```

#### POST /mcp/video/update
Refresh video display.

**Request Schema**: `video.update.request.json`
```json
{
  "flush": true,
  "timeout": 5000
}
```

**Response Schema**: `video.update.response.json`
```json
{
  "success": true,
  "data": {
    "durationMs": 50,
    "status": "updated"
  }
}
```

#### POST /mcp/video/clear
Clear video framebuffer.

**Request Schema**: `video.clear.request.json`
```json
{
  "color": 0
}
```

**Response Schema**: `video.clear.response.json`
```json
{
  "success": true,
  "data": {
    "cleared": true
  }
}
```

### Terminal Operations

#### POST /mcp/terminal/write
Write text to terminal output.

**Request Schema**: `terminal.write.request.json`
```json
{
  "text": "Hello, World!",
  "addNewline": true
}
```

**Response Schema**: `terminal.write.response.json`
```json
{
  "success": true,
  "data": {
    "bytesWritten": 14
  }
}
```

#### GET /mcp/terminal/read
Read from terminal input buffer.

**Response Schema**: `terminal.read.response.json`
```json
{
  "success": true,
  "data": {
    "input": "user input text",
    "bytesRead": 15,
    "hasInput": true
  }
}
```

#### POST /mcp/terminal/clear
Clear terminal input buffer.

**Response Schema**: `terminal.clear.response.json`
```json
{
  "success": true,
  "data": {
    "cleared": true,
    "bufferSize": 256
  }
}
```

### Debug Operations

#### POST /mcp/debug/trace
Execute instructions with detailed tracing.

**Request Schema**: `debug.trace.request.json`
```json
{
  "steps": 100,
  "until": "halt"
}
```

**Response Schema**: `debug.trace.response.json`
```json
{
  "success": true,
  "data": {
    "steps": [
      {
        "pc": 1536,
        "instruction": "LDA #$42",
        "opcode": 169,
        "cycles": 2,
        "registers": {
          "a": 66,
          "x": 0,
          "y": 0
        }
      }
    ],
    "totalSteps": 3,
    "stopReason": "halt"
  }
}
```

#### POST /mcp/debug/memoryView
Get formatted memory dump.

**Request Schema**: `debug.memoryView.request.json`
```json
{
  "address": 1536,
  "size": 256
}
```

**Response Schema**: `debug.memoryView.response.json`
```json
{
  "success": true,
  "data": {
    "address": 1536,
    "size": 256,
    "bytes": [169, 66, 133, 0, 58, ...],
    "format": "numeric",
    "endAddress": 1791
  }
}
```

#### POST /mcp/debug/breakpoints
Manage breakpoints.

**Request Schema**: `debug.breakpoints.request.json`
```json
{
  "action": "set",
  "address": 1538,
  "id": 1
}
```

**Response Schema**: `debug.breakpoints.response.json`
```json
{
  "success": true,
  "data": {
    "breakpoints": [
      {
        "id": 1,
        "address": 1538,
        "enabled": true
      }
    ],
    "operationResult": {
      "action": "set",
      "success": true,
      "id": 1,
      "address": 1538
    }
  }
}
```

### AI Operations

#### POST /mcp/ai/generate
Generate content using AI models.

**Request Schema**: `ai.generate.request.json`
```json
{
  "prompt": "Generate assembly code to display 'Hello' on terminal",
  "task": "generation",
  "options": {
    "model": "auto",
    "maxTokens": 1000
  }
}
```

**Response Schema**: `ai.generate.response.json`
```json
{
  "success": true,
  "data": {
    "content": ".org $0600\nLDA #72\nSTA $F1\n...",
    "model": "claude-3-sonnet",
    "tokensUsed": 150,
    "generatedAt": "2025-09-15T19:00:00.000Z"
  }
}
```

#### POST /mcp/ai/models
List available AI models.

**Response**:
```json
{
  "success": true,
  "data": {
    "availableModels": [
      {
        "name": "claude-3-sonnet",
        "provider": "anthropic",
        "capabilities": ["text-generation", "code-generation"]
      }
    ],
    "configStatus": {
      "anthropic": "configured",
      "openai": "missing-key"
    }
  }
}
```

### Queue Operations

#### POST /mcp/queue/add
Add task to AI processing queue.

**Request**:
```json
{
  "prompt": "Create a sorting algorithm in assembly",
  "type": "generation",
  "priority": "normal",
  "metadata": {
    "requestId": "req-123"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "taskId": "task-456",
    "message": "Task added to queue successfully",
    "type": "generation",
    "priority": "normal"
  }
}
```

#### GET /mcp/queue/list
List queue items with optional filtering.

**Query Parameters**:
- `status`: Filter by status (queued, processing, completed, failed, cancelled)
- `type`: Filter by type (generation, optimization, testing, debugging, custom)
- `priority`: Filter by priority (high, normal, low)
- `search`: Search in prompt text
- `limit`: Maximum items to return (default: 100, max: 1000)

**Response**:
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "task-456",
        "prompt": "Create a sorting algorithm...",
        "type": "generation",
        "priority": "normal",
        "status": "queued",
        "createdAt": "2025-09-15T19:00:00.000Z"
      }
    ],
    "count": 1,
    "total": 1,
    "filter": {
      "status": ["queued"]
    },
    "limit": 100
  }
}
```

## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      "originalError": "Internal error details",
      "validationErrors": [...],
      "circuitStatus": {...}
    }
  }
}
```

### Common Error Codes
- `UNAUTHORIZED` (401): Missing or invalid API key
- `INVALID_REQUEST` (400): Malformed request data
- `VALIDATION_FAILED` (422): Schema validation failed
- `MEMORY_OUT_OF_BOUNDS` (422): Memory address out of range
- `CPU_NOT_READY` (409): CPU operation failed
- `PROGRAM_NOT_FOUND` (404): Requested program not found
- `ASSEMBLY_FAILED` (422): Assembly compilation failed
- `SERVICE_UNAVAILABLE` (503): Service temporarily unavailable
- `INTERNAL_ERROR` (500): Internal server error

### Circuit Breaker Status
Each error response includes circuit breaker status:
```json
{
  "circuitStatus": {
    "cpu": {
      "state": "CLOSED",
      "available": true,
      "failureCount": 0,
      "lastFailure": null
    },
    "memory": {
      "state": "CLOSED", 
      "available": true,
      "failureCount": 0,
      "lastFailure": null
    }
  }
}
```

## Implementation Issues Found

### 1. Schema Validation Inconsistencies ✅ **FULLY RESOLVED**
- Video Y coordinate maximum corrected to 23 for 32×24 display ✅
- Coordinate validation successfully tested with bounds checking
- Integration tests confirm proper error handling for out-of-bounds coordinates
- Some schemas missing `additionalProperties: false`
- Required fields not consistently specified

### 2. WebSocket Implementation
- WebSocket server is disabled in current build
- `broadcastEvent` function called but not properly implemented
- Real-time events not functioning

### 3. Import/Export Issues  
- Mixed ESM and CommonJS imports causing module resolution failures
- Dynamic imports needed for some server-side modules

### 4. Response Format Inconsistencies
- Some adapters return `{success, data}` format
- Others return raw data causing validation failures
- Memory state save/load responses not fully validated

### 5. Memory Banking
- Bank validation incomplete
- Copy-on-write implementation has race conditions
- Bank switching may access undefined banks

## Recommendations

### Immediate Fixes
1. ✅ **RESOLVED** Video coordinate schema fully validated and corrected (Y max = 23 for 32×24 display)
   - Schema validation passes all tests
   - Coordinate bounds properly enforced
   - Integration tests confirm correct behavior
2. Standardize all adapter response formats
3. Resolve ESM/CommonJS import conflicts
4. Implement proper WebSocket broadcasting or remove references

### Improvements
1. Add comprehensive input validation
2. Implement proper error recovery mechanisms
3. Add circuit breaker monitoring endpoints
4. Create automated schema validation tests
5. Add WebSocket reconnection logic

### Testing
1. Add integration tests for all MCP endpoints
2. Create schema validation test suite
3. Test circuit breaker behavior under load
4. Validate error response formats
5. Test authentication across all endpoints