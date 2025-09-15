# iMaCoMpUtERussy MCP API Reference

## Overview

The iMaCoMpUtERussy MCP (Model Context Protocol) server provides a RESTful HTTP interface for programmatic interaction with the 6502-based emulator. This API enables assembly, execution, debugging, and I/O operations through clearly defined endpoints with JSON schemas.

The server runs on `http://localhost:8001` by default and exposes endpoints under the `/mcp` path.

## Developer Mapping

All MCP endpoints map directly to internal emulator components:

| Component | Adapter File |
|-----------|-------------|
| CPU Operations | [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:312) via `iMaCoMpUtERussyCPU` |
| Memory Operations | [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:393) via `iMaCoMpUtERussyMemory` |
| Assembly | [`js/assembler.js`](js/assembler.js:1) via `assemble()` function |
| Terminal I/O | [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:469) via memory-mapped I/O |
| Video Framebuffer | [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:518) via memory addresses 0x0200-0x05FF |
| Program Management | [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:586) via file system operations |
| Debug Operations | [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:631) via breakpoint management |

## Error Codes

All endpoints use standardized error responses:

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `CPU_NOT_READY` | 409 | CPU is currently executing |
| `CPU_HALTED` | 422 | CPU has halted execution |
| `CPU_TIMEOUT` | 408 | CPU operation timed out |
| `MEMORY_OUT_OF_BOUNDS` | 400 | Memory address out of valid range (0x0000-0xFFFF) |
| `MEMORY_OUT_OF_RANGE` | 422 | Memory address range exceeds bounds |
| `INVALID_ASSEMBLY` | 400 | Assembly code syntax error |
| `PROGRAM_TOO_LARGE` | 400 | Program exceeds maximum size |
| `INVALID_VIDEO_OPERATION` | 400 | Video framebuffer operation invalid |
| `VIDEO_UPDATE_TIMEOUT` | 408 | Video update operation timed out |
| `TIMEOUT_EXCEEDED` | 408 | Operation timed out |
| `TERMINAL_BUSY` | 503 | Terminal is currently busy |
| `SYSTEM_ERROR` | 500 | Internal system error |
| `VALIDATION_FAILED` | 422 | Input validation failed |
| `RESOURCE_BUSY` | 503 | Resource temporarily unavailable |
| `PROGRAM_NOT_FOUND` | 404 | Requested program not found |
| `PROGRAM_EXISTS` | 409 | Program already exists |
| `QUEUE_FULL` | 503 | Queue is at maximum capacity |
| `TASK_NOT_FOUND` | 404 | Requested task not found |
| `INVALID_BREAKPOINT` | 422 | Invalid breakpoint operation |
| `BREAKPOINT_HIT` | 422 | Breakpoint was hit during execution |
| `NOT_FOUND` | 404 | Resource not found |
| `ENDPOINT_NOT_FOUND` | 404 | API endpoint not found |

Standard error response format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": {},
    "retryable": true,
    "retryCount": 0,
    "maxRetries": 3,
    "retryDelay": 1000,
    "suggestedAction": "Retry operation"
  }
}
```

## CPU Operations

### POST /mcp/cpu/reset
Resets the CPU to initial state.

**Request Schema:** [`docs/mcp_schemas/cpu.reset.request.json:1`](docs/mcp_schemas/cpu.reset.request.json:1)
```json
{
  "hardReset": false
}
```

**Response Schema:** [`docs/mcp_schemas/cpu.reset.response.json:1`](docs/mcp_schemas/cpu.reset.response.json:1)
```json
{
  "success": true,
  "data": {
    "pc": 0,
    "a": 0,
    "x": 0,
    "y": 0,
    "running": false,
    "flags": {
      "carry": false,
      "zero": true,
      "interrupt": true,
      "decimal": false,
      "overflow": false,
      "negative": false
    }
  }
}
```

**Possible Errors:** `CPU_NOT_READY`  
**Maps to:** `cpu.reset()` in [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:314)

```bash
curl -X POST http://localhost:8001/mcp/cpu/reset \
  -H "Content-Type: application/json" \
  -d '{"hardReset": false}'
```

### POST /mcp/cpu/step
Executes a single CPU instruction.

**Request Schema:** [`docs/mcp_schemas/cpu.step.request.json:1`](docs/mcp_schemas/cpu.step.request.json:1)
```json
{
  "timeout": 1000
}
```

**Response Schema:** [`docs/mcp_schemas/cpu.step.response.json:1`](docs/mcp_schemas/cpu.step.response.json:1)
```json
{
  "success": true,
  "data": {
    "pc": 1536,
    "instruction": "LDA #$42",
    "cycles": 2,
    "halted": false,
    "cpuState": {
      "a": 66,
      "x": 0,
      "y": 0,
      "flags": {
        "zero": false,
        "negative": false
      }
    }
  }
}
```

**Possible Errors:** `CPU_NOT_READY`, `TIMEOUT_EXCEEDED`  
**Maps to:** `cpu.step()` in [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:333)
![MCP CPU step execution flowchart](images/mcp-cpu-step-flowchart.png)

```bash
curl -X POST http://localhost:8001/mcp/cpu/step \
  -H "Content-Type: application/json" \
  -d '{}'
```

### POST /mcp/cpu/run
Executes multiple CPU instructions.

**Request Schema:** [`docs/mcp_schemas/cpu.run.request.json:1`](docs/mcp_schemas/cpu.run.request.json:1)
```json
{
  "maxSteps": 100,
  "stepDelay": 10,
  "breakOnHalt": true
}
```

**Response Schema:** [`docs/mcp_schemas/cpu.run.response.json:1`](docs/mcp_schemas/cpu.run.response.json:1)
```json
{
  "success": true,
  "data": {
    "stepsExecuted": 15,
    "totalCycles": 45,
    "halted": true,
    "finalState": {
      "pc": 1542,
      "a": 0,
      "x": 0,
      "y": 0
    },
    "executionTrace": [
      {
        "step": 1,
        "pc": 1536,
        "instruction": "LDA #$42"
      }
    ]
  }
}
```

**Possible Errors:** `CPU_NOT_READY`, `TIMEOUT_EXCEEDED`  
**Maps to:** `cpu.run(maxSteps)` in [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:356)

```bash
curl -X POST http://localhost:8001/mcp/cpu/run \
  -H "Content-Type: application/json" \
  -d '{"maxSteps": 100, "stepDelay": 10}'
```

### GET /mcp/cpu/state
Retrieves current CPU state.

**Request:** No body required  
**Response Schema:** [`docs/mcp_schemas/cpu.state.response.json:1`](docs/mcp_schemas/cpu.state.response.json:1)
```json
{
  "success": true,
  "data": {
    "pc": 1536,
    "a": 42,
    "x": 0,
    "y": 0,
    "running": false,
    "flags": {
      "carry": false,
      "zero": false,
      "interrupt": true,
      "decimal": false,
      "overflow": false,
      "negative": false
    }
  }
}
```

**Possible Errors:** `CPU_NOT_READY`  
**Maps to:** CPU register access in [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:372)

```bash
curl -X GET http://localhost:8001/mcp/cpu/state
```

## Memory Operations

### POST /mcp/memory/read
Reads memory byte or word.

**Request Schema:** [`docs/mcp_schemas/memory.read.request.json:1`](docs/mcp_schemas/memory.read.request.json:1)
```json
{
  "address": 240,
  "bytes": 1
}
```

**Response Schema:** [`docs/mcp_schemas/memory.read.response.json:1`](docs/mcp_schemas/memory.read.response.json:1)
```json
{
  "success": true,
  "data": {
    "address": 240,
    "bytes": 1,
    "value": 65,
    "hexValue": "41"
  }
}
```

**Possible Errors:** `MEMORY_OUT_OF_BOUNDS`  
**Maps to:** `memory.readByte()` / `memory.readWord()` in [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:395)

```bash
curl -X POST http://localhost:8001/mcp/memory/read \
  -H "Content-Type: application/json" \
  -d '{"address": 240, "bytes": 1}'
```

### POST /mcp/memory/write
Writes memory byte or word.

**Request Schema:** [`docs/mcp_schemas/memory.write.request.json:1`](docs/mcp_schemas/memory.write.request.json:1)
```json
{
  "address": 240,
  "value": 72,
  "bytes": 1
}
```

**Response Schema:** [`docs/mcp_schemas/memory.write.response.json:1`](docs/mcp_schemas/memory.write.response.json:1)
```json
{
  "success": true,
  "data": {
    "address": 240,
    "bytes": 1,
    "value": 72,
    "previous": 65
  }
}
```

**Possible Errors:** `MEMORY_OUT_OF_BOUNDS`  
**Maps to:** `memory.writeByte()` / `memory.writeWord()` in [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:409)

### POST /mcp/memory/loadProgram
Loads compiled bytecode into memory.

**Request Schema:** [`docs/mcp_schemas/memory.loadProgram.request.json:1`](docs/mcp_schemas/memory.loadProgram.request.json:1)
```json
{
  "bytecode": [169, 66, 133, 0, 76],
  "startAddress": 1536,
  "validate": true
}
```

**Response Schema:** [`docs/mcp_schemas/memory.loadProgram.response.json:1`](docs/mcp_schemas/memory.loadProgram.response.json:1)
```json
{
  "success": true,
  "data": {
    "startAddress": 1536,
    "bytesLoaded": 5,
    "endAddress": 1540,
    "programSize": 5
  }
}
```

**Possible Errors:** `MEMORY_OUT_OF_BOUNDS`, `VALIDATION_FAILED`
**Maps to:** `memory.loadProgram()` in [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:417)

### POST /mcp/memory/saveState
Saves current memory state to a file for later restoration.

**Request Schema:** `memory.saveState.request.json`
```json
{
  "name": "my_state",
  "range": {
    "start": 0,
    "end": 65535
  },
  "overwrite": false
}
```

**Response Schema:** `memory.saveState.response.json`
```json
{
  "success": true,
  "data": {
    "name": "my_state",
    "bytesSaved": 65536,
    "range": {
      "start": 0,
      "end": 65535
    },
    "savedAt": "2025-09-15T19:00:00.000Z"
  }
}
```

**Possible Errors:** `STATE_EXISTS`, `MEMORY_OUT_OF_BOUNDS`, `VALIDATION_FAILED`
**Maps to:** Memory state save in [`server/mcp_server.js`](server/mcp_server.js:262)

```bash
curl -X POST http://localhost:8001/mcp/memory/saveState \
  -H "Content-Type: application/json" \
  -d '{"name": "my_state", "overwrite": false}'
```

### POST /mcp/memory/loadState
Loads previously saved memory state from a file.

**Request Schema:** `memory.loadState.request.json`
```json
{
  "name": "my_state",
  "targetAddress": 0,
  "range": {
    "start": 0,
    "end": 65535
  }
}
```

**Response Schema:** `memory.loadState.response.json`
```json
{
  "success": true,
  "data": {
    "name": "my_state",
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

**Possible Errors:** `STATE_NOT_FOUND`, `MEMORY_OUT_OF_BOUNDS`, `INVALID_RANGE`
**Maps to:** Memory state load in [`server/mcp_server.js`](server/mcp_server.js:360)

## Assembly Operations

### POST /mcp/assemble/source
Assembles assembly source code to bytecode.

**Request Schema:** [`docs/mcp_schemas/assemble.source.request.json:1`](docs/mcp_schemas/assemble.source.request.json:1)
```json
{
  "source": ".org $0600\nLDA #$42\nSTA $00\nHLT",
  "optimize": false,
  "orgAddress": 1536
}
```

**Response Schema:** [`docs/mcp_schemas/assemble.source.response.json:1`](docs/mcp_schemas/assemble.source.response.json:1)
```json
{
  "success": true,
  "data": {
    "bytecode": [169, 66, 133, 0, 0, 0],
    "hexBytes": ["A9", "42", "85", "00", "00", "00"],
    "instructionCount": 3,
    "sizeBytes": 6,
    "program": [
      {
        "address": 1536,
        "machineCode": [169, 66],
        "size": 2,
        "source": "LDA #$42"
      }
    ]
  }
}
```

**Possible Errors:** `INVALID_ASSEMBLY`, `PROGRAM_TOO_LARGE`  
**Maps to:** `assemble()` in [`js/assembler.js`](js/assembler.js:1)

### POST /mcp/assemble/loadAndRun
Assembles, loads, and executes program in one operation.

**Request Schema:** [`docs/mcp_schemas/assemble.loadAndRun.request.json:1`](docs/mcp_schemas/assemble.loadAndRun.request.json:1)
```json
{
  "source": ".org $0600\nLDA #$42\nSTA $00\nHLT",
  "resetCPU": true,
  "maxSteps": 100
}
```

**Response Schema:** [`docs/mcp_schemas/assemble.loadAndRun.response.json:1`](docs/mcp_schemas/assemble.loadAndRun.response.json:1)
```json
{
  "success": true,
  "data": {
    "assembledByteCount": 6,
    "loadAddress": 1536,
    "runOutcome": {
      "stepsExecuted": 3,
      "halted": true,
      "finalState": {
        "pc": 1544,
        "a": 0,
        "x": 0,
        "y": 0,
        "running": false
      }
    }
  }
}
```

**Possible Errors:** `INVALID_ASSEMBLY`, `MEMORY_OUT_OF_BOUNDS`, `CPU_NOT_READY`  
**Maps to:** Combined `assemble()` + `loadAndRun()` in [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:743)

## Terminal I/O Operations

### POST /mcp/terminal/write
Writes text to terminal output.

**Request Schema:** [`docs/mcp_schemas/terminal.write.request.json:1`](docs/mcp_schemas/terminal.write.request.json:1)
```json
{
  "text": "Hello, World!",
  "addNewline": true
}
```

**Response Schema:** [`docs/mcp_schemas/terminal.write.response.json:1`](docs/mcp_schemas/terminal.write.response.json:1)
```json
{
  "success": true,
  "data": {
    "bytesWritten": 13,
    "currentBuffer": "Hello, World!\n"
  }
}
```

**Possible Errors:** `TERMINAL_BUSY`  
**Maps to:** Memory write to 0xF1 in [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:473)

### POST /mcp/terminal/read
Reads input from terminal.

**Request:** Empty body or no body required  
**Response Schema:** [`docs/mcp_schemas/terminal.read.response.json:1`](docs/mcp_schemas/terminal.read.response.json:1)
```json
{
  "success": true,
  "data": {
    "input": "user input",
    "bytesRead": 10,
    "hasInput": true
  }
}
```

**Possible Errors:** None (returns empty result if no input)  
**Maps to:** Memory read from 0xF0 in [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:480)

### POST /mcp/terminal/clear
Clears terminal buffers.

**Request:** Empty body (optional)  
**Response Schema:** [`docs/mcp_schemas/terminal.clear.response.json:1`](docs/mcp_schemas/terminal.clear.response.json:1)
```json
{
  "success": true,
  "data": {
    "cleared": true,
    "bufferSize": 0
  }
}
```

**Possible Errors:** None  
**Maps to:** Memory writes to 0xF0 and 0xF2 in [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:531)

## Video Framebuffer Operations

### POST /mcp/video/setPixel
Sets a pixel in the video framebuffer.

**Request Schema:** [`docs/mcp_schemas/video.setPixel.request.json:1`](docs/mcp_schemas/video.setPixel.request.json:1)
```json
{
  "x": 10,
  "y": 5,
  "color": 15
}
```

**Response Schema:** [`docs/mcp_schemas/video.setPixel.response.json:1`](docs/mcp_schemas/video.setPixel.response.json:1)
```json
{
  "success": true,
  "data": {
    "address": 536,
    "value": 15
  }
}
```

**Possible Errors:** `VIDEO_OUT_OF_BOUNDS`  
**Maps to:** Memory write to address `0x0200 + (y * 32) + x` in [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:520)

### POST /mcp/video/update
Triggers video display update (VUP - Video Update Pending).

**Request Schema:** [`docs/mcp_schemas/video.update.request.json:1`](docs/mcp_schemas/video.update.request.json:1)
```json
{
  "timeout": 5000,
  "flush": true
}
```

**Response Schema:** [`docs/mcp_schemas/video.update.response.json:1`](docs/mcp_schemas/video.update.response.json:1)
```json
{
  "success": true,
  "data": {
    "durationMs": 150,
    "status": "updated"
  }
}
```

**Possible Errors:** `VIDEO_UPDATE_TIMEOUT`  
**Maps to:** Video display update in [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:701)

### POST /mcp/video/clear
Clears the video framebuffer with specified color.

**Request Schema:** [`docs/mcp_schemas/video.clear.request.json:1`](docs/mcp_schemas/video.clear.request.json:1)
```json
{
  "color": 0
}
```

**Response Schema:** [`docs/mcp_schemas/video.clear.response.json:1`](docs/mcp_schemas/video.clear.response.json:1)
```json
{
  "success": true,
  "data": {
    "cleared": true,
    "startAddr": 512,
    "endAddr": 1535
  }
}
```

**Possible Errors:** None  
**Maps to:** Bulk memory clear of 0x0200-0x05FF in [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:769)

## Program Management

### GET /mcp/programs/list
Lists available sample programs.

**Request:** No body required  
**Response Schema:** [`docs/mcp_schemas/programs.list.response.json:1`](docs/mcp_schemas/programs.list.response.json:1)
```json
{
  "success": true,
  "data": [
    {
      "name": "hello-terminal",
      "description": "Outputs 'HELLO WORLD!' to terminal",
      "size": 47,
      "path": "hello-terminal.asm"
    }
  ]
}
```

**Possible Errors:** `SYSTEM_ERROR`  
**Maps to:** File system listing in [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:585)

### POST /mcp/programs/load-sample
Loads a sample program from the samples/ directory.

**Request Schema:** [`docs/mcp_schemas/programs.load.request.json:1`](docs/mcp_schemas/programs.load.request.json:1)
```json
{
  "sampleName": "hello-terminal",
  "assembled": true,
  "resetCPU": true
}
```

**Response Schema:** [`docs/mcp_schemas/programs.load.response.json:1`](docs/mcp_schemas/programs.load.response.json:1)
```json
{
  "success": true,
  "data": {
    "sampleName": "hello-terminal",
    "programSize": 47,
    "loadAddress": 1536,
    "source": ".org $0600...",
    "bytecode": [169, 72, 169, 101, 133, 241, 169, 108, 133, 241, 169, 108, 133, 241, 169, 111, 133, 241, 169, 10, 133, 241, 96]
  }
}
```

**Possible Errors:** `PROGRAM_NOT_FOUND`  
**Maps to:** File loading in [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:614)

### POST /mcp/programs/load
Loads program by name with custom address.

**Request Schema:** [`docs/mcp_schemas/programs.load.request.new.json:1`](docs/mcp_schemas/programs.load.request.new.json:1)
```json
{
  "name": "echo",
  "startAddress": 1536
}
```

**Possible Errors:** `PROGRAM_NOT_FOUND`, `MEMORY_OUT_OF_RANGE`  

### POST /mcp/programs/save
Saves assembly source to samples directory.

**Request Schema:** [`docs/mcp_schemas/programs.save.request.json:1`](docs/mcp_schemas/programs.save.request.json:1)
```json
{
  "name": "test-program",
  "source": "; Test program\n.org $0600\nLDA #$42\nSTA $00\nRTS",
  "overwrite": false
}
```

**Response Schema:** [`docs/mcp_schemas/programs.save.response.json:1`](docs/mcp_schemas/programs.save.response.json:1)
```json
{
  "success": true,
  "data": {
    "name": "test-program",
    "path": "test-program.asm",
    "bytesWritten": 45,
    "savedAt": "2023-12-01T10:30:00Z"
  }
}
```

**Possible Errors:** `PROGRAM_EXISTS`, `INVALID_REQUEST`, `SYSTEM_ERROR`  
**Maps to:** File writing in [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:598)

## Debug Operations

### POST /mcp/debug/trace
Executes program with detailed tracing.

**Request Schema:** [`docs/mcp_schemas/debug.trace.request.json:1`](docs/mcp_schemas/debug.trace.request.json:1)
```json
{
  "steps": 100,
  "until": "breakpoint"
}
```

**Response Schema:** [`docs/mcp_schemas/debug.trace.response.json:1`](docs/mcp_schemas/debug.trace.response.json:1)
```json
{
  "success": true,
  "data": {
    "stepsExecuted": 25,
    "halted": false,
    "haltReason": "breakpoint_hit",
    "trace": [
      {
        "pc": 1536,
        "opcode": 169,
        "operands": [],
        "instruction": "LDA #$42",
        "registers": {
          "a": 0,
          "x": 0,
          "y": 0
        },
        "flags": {
          "carry": false,
          "zero": true,
          "interrupt": true,
          "decimal": false,
          "overflow": false,
          "negative": false
        },
        "cycles": 2
      }
    ]
  }
}
```

**Possible Errors:** `BREAKPOINT_HIT`, `CPU_HALTED`  
**Maps to:** CPU step-by-step execution in [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:637)

### POST /mcp/debug/memoryView
Reads memory region for debugging.

**Request Schema:** [`docs/mcp_schemas/debug.memoryView.request.json:1`](docs/mcp_schemas/debug.memoryView.request.json:1)
```json
{
  "address": 0,
  "size": 256
}
```

**Response Schema:** [`docs/mcp_schemas/debug.memoryView.response.json:1`](docs/mcp_schemas/debug.memoryView.response.json:1)
```json
{
  "success": true,
  "data": {
    "address": 0,
    "size": 256,
    "bytes": [0, 0, 0, ...],
    "format": "numeric",
    "endAddress": 255
  }
}
```

**Possible Errors:** `MEMORY_OUT_OF_RANGE`  
**Maps to:** Bulk memory reads in [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:850)

### POST /mcp/debug/breakpoints
Manages CPU and memory breakpoints.

**Request Schema:** [`docs/mcp_schemas/debug.breakpoints.request.json:1`](docs/mcp_schemas/debug.breakpoints.request.json:1)
```json
{
  "action": "set",
  "address": 1536,
  "condition": "write"
}
```

**Response Schema:** [`docs/mcp_schemas/debug.breakpoints.response.json:1`](docs/mcp_schemas/debug.breakpoints.response.json:1)
```json
{
  "success": true,
  "data": {
    "breakpoints": [
      {
        "id": "bp_1",
        "address": 1536,
        "condition": "write",
        "enabled": true,
        "hitCount": 0
      }
    ],
    "operationResult": {
      "action": "set",
      "success": true,
      "id": "bp_1",
      "address": 1536
    }
  }
}
```

**Possible Errors:** `INVALID_BREAKPOINT`, `NOT_FOUND`
**Maps to:** Breakpoint management in [`server/mcp_developer_adapter.js`](server/mcp_developer_adapter.js:904)

## Queue Management Operations

### POST /mcp/queue/add
Adds a task to the AI processing queue.

**Request Schema:** `queue.add.request.json`
```json
{
  "prompt": "Generate assembly code to display 'Hello' on terminal",
  "type": "generation",
  "priority": "normal",
  "metadata": {
    "requestId": "req-123"
  }
}
```

**Response Schema:** `queue.add.response.json`
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

**Possible Errors:** `INVALID_REQUEST`, `SERVICE_UNAVAILABLE`
**Maps to:** Queue management in [`server/mcp_server.js`](server/mcp_server.js:1924)

```bash
curl -X POST http://localhost:8001/mcp/queue/add \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a Fibonacci program in assembly",
    "type": "generation",
    "priority": "normal"
  }'
```

### GET /mcp/queue/list
Lists tasks in the AI processing queue with optional filtering.

**Query Parameters:**
- `status`: Filter by status (queued, processing, completed, failed, cancelled)
- `type`: Filter by type (generation, optimization, testing, debugging, custom)
- `priority`: Filter by priority (high, normal, low)
- `search`: Search in prompt text
- `limit`: Maximum items to return (default: 100, max: 1000)

**Response Schema:** `queue.list.response.json`
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

**Possible Errors:** `SERVICE_UNAVAILABLE`
**Maps to:** Queue listing in [`server/mcp_server.js`](server/mcp_server.js:1975)

```bash
curl -X GET "http://localhost:8001/mcp/queue/list?status=queued&limit=50"
```

## AI Model Operations

### POST /mcp/ai/generate
Generates content using AI models for assembly programming assistance.

**Request Schema:** `ai.generate.request.json`
```json
{
  "prompt": "Generate assembly code to display 'Hello' on terminal",
  "task": "generation",
  "options": {
    "model": "auto",
    "maxTokens": 1000,
    "temperature": 0.7
  }
}
```

**Response Schema:** `ai.generate.response.json`
```json
{
  "success": true,
  "data": {
    "content": ".org $0600\nLDA #72\nSTA $F1\nLDA #101\nSTA $F1\n...",
    "model": "claude-3-sonnet",
    "tokensUsed": 150,
    "generatedAt": "2025-09-15T19:00:00.000Z"
  }
}
```

**Possible Errors:** `AI_GENERATION_FAILED`, `INVALID_REQUEST`, `SERVICE_UNAVAILABLE`
**Maps to:** AI model generation in [`server/mcp_server.js`](server/mcp_server.js:2032)

```bash
curl -X POST http://localhost:8001/mcp/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a loop in assembly",
    "task": "generation"
  }'
```

### POST /mcp/ai/models
Lists available AI models and their configuration status.

**Request Schema:** `ai.models.request.json`
```json
{
  "task": "generation"
}
```

**Response Schema:** `ai.models.response.json`
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

**Possible Errors:** `SERVICE_UNAVAILABLE`
**Maps to:** AI model listing in [`server/mcp_server.js`](server/mcp_server.js:2110)

```bash
curl -X POST http://localhost:8001/mcp/ai/models \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Limits & Safety

### Memory Bounds
- Valid addresses: 0x0000-0xFFFF (65536 bytes total)
- Zero page: 0x0000-0x00FF (256 bytes)
- Program area: 0x0600-0x06FF (256 bytes recommended)
- Video framebuffer: 0x0200-0x05FF (1024 bytes)
- I/O registers: 0x00F0-0x00F2

### Assembly Constraints
- Maximum source length: 64KB
- Maximum assembled program size: 64KB
- Instruction limit: 10000 per assembly
- Symbol table size: 1000 entries max

### CPU Execution Limits
- Maximum steps per run: 10000
- Step timeout: 100-5000ms
- Run timeout: 30 seconds
- Breakpoint limit: 10 active breakpoints

### Rate Limits
- CPU operations: 1000/minute
- Memory access: 10000/minute
- Assembly: 100/minute
- File upload: 50/minute with 1MB max file size

## Testing

Run the MCP server test suite using:
```bash
node tests/mcp.server.test.js
```

Tests cover all endpoints and validate request/response schemas using AJV. The test file is located at [`tests/mcp.server.test.js`](tests/mcp.server.test.js:1).

## Health Check

```bash
curl http://localhost:8001/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2023-12-01T10:30:00.000Z"
}