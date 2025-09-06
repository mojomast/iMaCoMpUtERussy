# iMaCoMpUtERussy MCP API Design

## Overview
Complete MCP (Model Context Protocol) API design and JSON schemas for the iMaCoMpUtERussy emulator integration. This document provides machine-readable schemas and human-readable descriptions for programmatic consumption.

## Base URL
All endpoints use the base URL: `http://localhost:8000/api/mcp`

## Error Response Format
All endpoints use consistent error response format:

**Error Response Schema:**
```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "title": "Error Response",
  "type": "object",
  "required": ["success", "error"],
  "properties": {
    "success": { "type": "boolean", "enum": [false] },
    "error": {
      "type": "object",
      "required": ["code", "message"],
      "properties": {
        "code": { "type": "string" },
        "message": { "type": "string" },
        "details": { "type": "object" }
      }
    }
  }
}
```

**Success Response Format:**
```json
{
  "success": true,
  "data": { /* endpoint-specific data */ }
}
```

## Core API Endpoints

### CPU Operations

#### 1. Reset CPU State
**Endpoint:** `POST /api/mcp/cpu/reset`  
**RPC:** `cpu.reset`

**Request Schema:**
```json
{
  "type": "object",
  "properties": {
    "hardReset": { "type": "boolean", "default": false }
  }
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "data": {
      "type": "object",
      "properties": {
        "pc": { "type": "integer", "minimum": 0, "maximum": 65535 },
        "a": { "type": "integer", "minimum": 0, "maximum": 255 },
        "x": { "type": "integer", "minimum": 0, "maximum": 255 },
        "y": { "type": "integer", "minimum": 0, "maximum": 255 },
        "running": { "type": "boolean" },
        "flags": {
          "type": "object",
          "properties": {
            "carry": { "type": "boolean" },
            "zero": { "type": "boolean" },
            "interrupt": { "type": "boolean" },
            "decimal": { "type": "boolean" },
            "overflow": { "type": "boolean" },
            "negative": { "type": "boolean" }
          }
        }
      }
    }
  }
}
```

**Example Request:**
```json
{
  "hardReset": false
}
```

**Example Response:**
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

**Maps to:** `cpu.reset()`

#### 2. Execute Single CPU Instruction
**Endpoint:** `POST /api/mcp/cpu/step`  
**RPC:** `cpu.step`

**Request Schema:**
```json
{
  "type": "object",
  "properties": {
    "timeout": { "type": "integer", "minimum": 100, "maximum": 5000, "default": 1000 }
  }
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "data": {
      "type": "object",
      "properties": {
        "pc": { "type": "integer" },
        "instruction": { "type": "string" },
        "cycles": { "type": "integer" },
        "halted": { "type": "boolean" },
        "cpuState": {
          "type": "object",
          "properties": {
            "a": { "type": "integer" },
            "x": { "type": "integer" },
            "y": { "type": "integer" },
            "flags": { "type": "object" }
          }
        }
      }
    }
  }
}
```

**Example Request:**
```json
{}
```

**Example Response:**
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
      "flags": { "zero": false, "negative": false }
    }
  }
}
```

**Maps to:** `cpu.step()`

#### 3. Execute Multiple CPU Instructions
**Endpoint:** `POST /api/mcp/cpu/run`  
**RPC:** `cpu.run`

**Request Schema:**
```json
{
  "type": "object",
  "required": ["maxSteps"],
  "properties": {
    "maxSteps": { "type": "integer", "minimum": 1, "maximum": 10000 },
    "stepDelay": { "type": "integer", "minimum": 0, "maximum": 100, "default": 1 },
    "breakOnHalt": { "type": "boolean", "default": true }
  }
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "data": {
      "type": "object",
      "properties": {
        "stepsExecuted": { "type": "integer" },
        "totalCycles": { "type": "integer" },
        "halted": { "type": "boolean" },
        "finalState": {
          "type": "object",
          "properties": {
            "pc": { "type": "integer" },
            "a": { "type": "integer" },
            "x": { "type": "integer" },
            "y": { "type": "integer" }
          }
        },
        "executionTrace": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "step": { "type": "integer" },
              "pc": { "type": "integer" },
              "instruction": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

**Example Request:**
```json
{
  "maxSteps": 100,
  "stepDelay": 10
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "stepsExecuted": 15,
    "totalCycles": 45,
    "halted": true,
    "finalState": { "pc": 1542, "a": 0, "x": 0, "y": 0 },
    "executionTrace": [
      { "step": 1, "pc": 1536, "instruction": "LDA #$42" },
      { "step": 2, "pc": 1538, "instruction": "STA $00" }
    ]
  }
}
```

**Maps to:** `cpu.run(maxSteps)`

#### 4. Get CPU State
**Endpoint:** `GET /api/mcp/cpu/status`  
**RPC:** `cpu.status`

**Request Schema:**
```json
{ "type": "object", "properties": {} }
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "data": {
      "type": "object",
      "properties": {
        "pc": { "type": "integer" },
        "a": { "type": "integer" },
        "x": { "type": "integer" },
        "y": { "type": "integer" },
        "running": { "type": "boolean" },
        "flags": { "type": "object" }
      }
    }
  }
}
```

**Maps to:** CPU register access (cpu.PC, cpu.A, cpu.X, cpu.Y, cpu.running)

### Memory Operations

#### 5. Read Memory Location
**Endpoint:** `GET /api/mcp/memory/read/{address}`  
**RPC:** `memory.read`

**Request Schema:**
```json
{
  "type": "object",
  "properties": {
    "bytes": { "type": "integer", "enum": [1, 2], "default": 1 }
  }
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "data": {
      "type": "object",
      "properties": {
        "address": { "type": "integer" },
        "bytes": { "type": "integer" },
        "value": { "type": "integer" },
        "hexValue": { "type": "string" }
      }
    }
  }
}
```

**Example Response:**
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

**Maps to:** `memory.readByte(address)` / `memory.readWord(address)`

#### 6. Write Memory Location
**Endpoint:** `POST /api/mcp/memory/write/{address}`  
**RPC:** `memory.write`

**Request Schema:**
```json
{
  "type": "object",
  "required": ["value"],
  "properties": {
    "value": { "type": "integer", "minimum": 0, "maximum": 65535 },
    "bytes": { "type": "integer", "enum": [1, 2], "default": 1 }
  }
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "data": {
      "type": "object",
      "properties": {
        "address": { "type": "integer" },
        "bytes": { "type": "integer" },
        "value": { "type": "integer" },
        "previous": { "type": "integer" }
      }
    }
  }
}
```

**Example Request:**
```json
{
  "value": 72,
  "bytes": 1
}
```

**Maps to:** `memory.writeByte(address, value)` / `memory.writeWord(address, word)`

#### 7. Load Program into Memory
**Endpoint:** `POST /api/mcp/memory/load-program`  
**RPC:** `memory.loadProgram`

**Request Schema:**
```json
{
  "type": "object",
  "required": ["bytecode", "startAddress"],
  "properties": {
    "bytecode": {
      "type": "array",
      "items": { "type": "integer", "minimum": 0, "maximum": 255 }
    },
    "startAddress": { "type": "integer", "minimum": 0, "maximum": 65535 },
    "validate": { "type": "boolean", "default": true }
  }
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "data": {
      "type": "object",
      "properties": {
        "startAddress": { "type": "integer" },
        "bytesLoaded": { "type": "integer" },
        "endAddress": { "type": "integer" },
        "programSize": { "type": "integer" }
      }
    }
  }
}
```

**Example Request:**
```json
{
  "bytecode": [169, 66, 133, 0, 76],
  "startAddress": 1536,
  "validate": true
}
```

**Maps to:** `memory.loadProgram(startAddress, byteArray)`

### Assembly Operations

#### 8. Assemble Source Code
**Endpoint:** `POST /api/mcp/assemble`  
**RPC:** `assemble.code`

**Request Schema:**
```json
{
  "type": "object",
  "required": ["source"],
  "properties": {
    "source": { "type": "string" },
    "optimize": { "type": "boolean", "default": false },
    "orgAddress": { "type": "integer", "minimum": 0, "maximum": 65535 }
  }
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "data": {
      "type": "object",
      "properties": {
        "bytecode": {
          "type": "array",
          "items": { "type": "integer" }
        },
        "hexBytes": { "type": "array", "items": { "type": "string" } },
        "instructionCount": { "type": "integer" },
        "sizeBytes": { "type": "integer" },
        "program": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "address": { "type": "integer" },
              "machineCode": { "type": "array", "items": { "type": "integer" } },
              "size": { "type": "integer" },
              "source": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

**Example Request:**
```json
{
  "source": ".org $0600\nLDA #$42\nSTA $00\nHLT",
  "optimize": false,
  "orgAddress": 1536
}
```

**Example Response:**
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

**Maps to:** `assemble(sourceCode)`

#### 9. Assemble, Load and Run Source Code
**Endpoint:** `POST /api/mcp/assemble/load-and-run`
**RPC:** `assemble.loadAndRun`

**Request Schema:**
```json
{
  "type": "object",
  "required": ["source"],
  "properties": {
    "source": { "type": "string" },
    "resetCPU": { "type": "boolean", "default": true },
    "maxSteps": { "type": "integer", "minimum": 1, "maximum": 10000 }
  }
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "data": {
      "type": "object",
      "properties": {
        "assembledBytes": { "type": "integer" },
        "bytesLoaded": { "type": "integer" },
        "origin": { "type": "integer" },
        "maxSteps": { "type": "integer" },
        "executionResult": { "type": "object" }
      }
    }
  }
}
```

**Example Request:**
```json
{
  "source": ".org $0600\nLDA #$42\nSTA $00\nHLT",
  "resetCPU": true,
  "maxSteps": 100
}
```

**Maps to:** `assemble()`, `memory.loadProgram()`, `cpu.reset()`, `cpu.run()`

### AI Operations

#### 10. Generate Content with AI
**Endpoint:** `POST /api/mcp/ai/generate`
**RPC:** `ai.generate`

**Request Schema:**
```json
{
  "type": "object",
  "required": ["prompt"],
  "properties": {
    "prompt": { "type": "string", "minLength": 1, "maxLength": 10000 },
    "task": { "type": "string", "enum": ["generation", "analysis", "code", "explanation"], "default": "generation" },
    "options": {
      "type": "object",
      "properties": {
        "model": { "type": "string" },
        "maxTokens": { "type": "integer", "minimum": 1, "maximum": 4096 },
        "temperature": { "type": "number", "minimum": 0, "maximum": 2 }
      }
    }
  }
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "data": {
      "type": "object",
      "properties": {
        "content": { "type": "string" },
        "model": { "type": "string" },
        "tokensUsed": { "type": "integer" },
        "generatedAt": { "type": "string", "format": "date-time" }
      }
    }
  }
}
```

**Example Request:**
```json
{
  "prompt": "Write a brief assembly program that loads the value 42 into the accumulator",
  "task": "code",
  "options": { "model": "gpt-4", "maxTokens": 200, "temperature": 0.7 }
}
```

**Maps to:** AI language model API calls for content generation

### State Management Operations

#### 11. Save Emulator State
**Endpoint:** `POST /api/mcp/memory/save-state`
**RPC:** `memory.saveState`

**Request Schema:**
```json
{
  "type": "object",
  "required": ["name"],
  "properties": {
    "name": { "type": "string", "pattern": "^[a-zA-Z0-9_\\-]+$", "minLength": 1, "maxLength": 50 },
    "includeCPU": { "type": "boolean", "default": true },
    "includeBreakpoints": { "type": "boolean", "default": true },
    "description": { "type": "string", "maxLength": 255 },
    "tags": { "type": "array", "items": { "type": "string" } }
  }
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "data": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "savedAt": { "type": "string", "format": "date-time" },
        "compressedSize": { "type": "integer" },
        "uncompressedSize": { "type": "integer" },
        "stateHash": { "type": "string" }
      }
    }
  }
}
```

**Example Request:**
```json
{
  "name": "fibonacci_program",
  "includeCPU": true,
  "includeBreakpoints": true,
  "description": "Fibonacci calculation demo",
  "tags": ["demo", "fibonacci"]
}
```

**Maps to:** Complete emulator state serialization and storage

#### 12. Load Emulator State
**Endpoint:** `POST /api/mcp/memory/load-state`
**RPC:** `memory.loadState`

**Request Schema:**
```json
{
  "type": "object",
  "required": ["name"],
  "properties": {
    "name": { "type": "string", "pattern": "^[a-zA-Z0-9_\\-]+$" },
    "targetAddress": { "type": "integer", "default": 0 },
    "loadCPUState": { "type": "boolean", "default": true },
    "loadBreakpoints": { "type": "boolean", "default": true }
  }
}
```

## New Features Troubleshooting Guide

### AI Generation Issues

#### Problem: AI generate requests timeout
**Symptoms:** Long response times or timeout errors
**Solution:** Reduce `maxTokens` in request options or check AI service status

#### Problem: AI responses are empty or malformed
**Symptoms:** Success response but empty content
**Solution:** Adjust temperature (try lower values for code generation) or revise prompt clarity

### Assembly LoadAndRun Issues

#### Problem: Assembly fails with timeout
**Symptoms:** Request returns with "timeout exceeded" error
**Solution:**
```json
{
  "source": "your_code_here",
  "maxSteps": 500,  // Reduce execution steps
  "resetCPU": true
}
```

#### Problem: Invalid assembly source
**Symptoms:** "INVALID_ASSEMBLY" error
**Common Issues:**
- Missing `.org` directive
- Invalid instruction syntax
- Undefined symbols
- Memory address conflicts

**Solution:** Validate assembly syntax against instruction set documentation

### State Management Issues

#### Problem: State save fails with quota exceeded
**Symptoms:** Large state objects fail to save
**Solution:**
```json
{
  "name": "compact_save",
  "includeCPU": true,
  "includeBreakpoints": false,  // Disable to reduce size
  "compressedSave": true
}
```

#### Problem: State load fails with corruption
**Symptoms:** "State validation failed" error
**Solution:**
- Ensure state file wasn't modified externally
- Use state verification endpoint before loading
- Check server-side state validation logs

#### Problem: State loading disrupts breakpoints
**Symptoms:** Breakpoints lost after state load
**Solution:**
```json
{
  "name": "state_with_breakpoints",
  "loadCPUState": true,
  "loadBreakpoints": true
}
```

### Performance Optimization Tips

#### Memory Usage Optimization
- Use `memory.loadState` with selective loading options
- Set `compressedSave: true` for space-constrained environments
- Configure memory view with pagination for large ranges

#### Network Optimization
```json
// Reduce payload size for mobile connections
{
  "options": {
    "maxTokens": 100,  // Reduce for mobile
    "model": "gpt-3.5-turbo"  // Use less resource-intensive model
  }
}
```
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "data": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "loadedAt": { "type": "string", "format": "date-time" },
        "memoryRange": { "type": "object", "properties": {"start": {"type": "integer"}, "end": {"type": "integer"}} },
        "cpuRestored": { "type": "boolean" },
        "breakpointsRestored": { "type": "integer" }
      }
    }
  }
}
```

**Example Request:**
```json
{
  "name": "fibonacci_program",
  "loadCPUState": true,
  "loadBreakpoints": true
}
```

**Maps to:** State deserialization and emulator restoration

### Terminal I/O Operations

#### 13. Write to Terminal
**Endpoint:** `POST /api/mcp/terminal/write`
**RPC:** `terminal.write`

**Request Schema:**
```json
{
  "type": "object",
  "required": ["text"],
  "properties": {
    "text": { "type": "string", "maxLength": 1024 },
    "addNewline": { "type": "boolean", "default": true }
  }
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "data": {
      "type": "object",
      "properties": {
        "bytesWritten": { "type": "integer" },
        "currentBuffer": { "type": "string" }
      }
    }
  }
}
```

**Example Request:**
```json
{
  "text": "Hello, World!",
  "addNewline": true
}
```

**Maps to:** `memory.writeByte(0xF1, charCode)`

#### 10. Read Terminal Input
**Endpoint:** `POST /api/mcp/terminal/read`  
**RPC:** `terminal.read`

**Request Schema:**
```json
{
  "type": "object",
  "properties": {
    "maxLength": { "type": "integer", "minimum": 1, "maximum": 256, "default": 256 },
    "timeout": { "type": "integer", "minimum": 100, "maximum": 10000, "default": 5000 }
  }
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "data": {
      "type": "object",
      "properties": {
        "input": { "type": "string" },
        "bytesRead": { "type": "integer" },
        "hasInput": { "type": "boolean" }
      }
    }
  }
}
```

**Example Response:**
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

**Maps to:** `memory.readByte(0xF0)` and `memory.readByte(0xF2)`

#### 11. Get Terminal Status
**Endpoint:** `GET /api/mcp/terminal/status`  
**RPC:** `terminal.status`

**Request Schema:** `{}`

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "data": {
      "type": "object",
      "properties": {
        "inputReady": { "type": "boolean" },
        "outputReady": { "type": "boolean" },
        "bufferSize": { "type": "integer" },
        "lastInput": { "type": "string" },
        "lastOutput": { "type": "string" }
      }
    }
  }
}
```

**Maps to:** `memory.readByte(0xF2)` (status register)

### Video Framebuffer Operations

#### 12. Write to Video Framebuffer
**Endpoint:** `POST /api/mcp/video/write`  
**RPC:** `video.write`

**Request Schema:**
```json
{
  "type": "object",
  "required": ["data"],
  "properties": {
    "data": {
      "type": "array",
      "items": { "type": "integer", "minimum": 0, "maximum": 255 }
    },
    "startAddress": { "type": "integer", "minimum": 512, "maximum": 1535, "default": 512 },
    "validate": { "type": "boolean", "default": true }
  }
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "data": {
      "type": "object",
      "properties": {
        "startAddress": { "type": "integer" },
        "bytesWritten": { "type": "integer" },
        "endAddress": { "type": "integer" },
        "displayUpdated": { "type": "boolean" }
      }
    }
  }
}
```

**Example Request:**
```json
{
  "data": [255, 0, 255, 192],
  "startAddress": 512
}
```

**Maps to:** Memory write operations to addresses 0x0200-0x05FF

#### 13. Read from Video Framebuffer
**Endpoint:** `GET /api/mcp/video/read`  
**RPC:** `video.read`

**Request Schema:**
```json
{
  "type": "object",
  "properties": {
    "startAddress": { "type": "integer", "minimum": 512, "maximum": 1535, "default": 512 },
    "length": { "type": "integer", "minimum": 1, "maximum": 1024, "default": 1024 }
  }
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "data": {
      "type": "object",
      "properties": {
        "startAddress": { "type": "integer" },
        "bytes": {
          "type": "array",
          "items": { "type": "integer" }
        },
        "length": { "type": "integer" }
      }
    }
  }
}
```

**Maps to:** Memory read operations from addresses 0x0200-0x05FF

### Program Management

#### 14. Load Sample Program
**Endpoint:** `POST /api/mcp/programs/load-sample`  
**RPC:** `programs.loadSample`

**Request Schema:**
```json
{
  "type": "object",
  "required": ["sampleName"],
  "properties": {
    "sampleName": {
      "type": "string",
      "enum": ["hello-world", "echo", "fibonacci", "graphics-demo", "video-demo"]
    },
    "assembled": { "type": "boolean", "default": true },
    "resetCPU": { "type": "boolean", "default": true }
  }
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "data": {
      "type": "object",
      "properties": {
        "sampleName": { "type": "string" },
        "programSize": { "type": "integer" },
        "loadAddress": { "type": "integer" },
        "source": { "type": "string" },
        "bytecode": { "type": "array", "items": { "type": "integer" } }
      }
    }
  }
}
```

**Example Request:**
```json
{
  "sampleName": "echo",
  "assembled": true
}
```

**Maps to:** File loading and `memory.loadProgram()` / `assemble()`

#### 15. Upload Program File
**Endpoint:** `POST /api/mcp/programs/upload`  
**RPC:** `programs.upload`

**Request Schema:**
```json
{
  "type": "object",
  "required": ["filename", "content"],
  "properties": {
    "filename": { "type": "string", "pattern": "\\.asm$" },
    "content": { "type": "string" },
    "assemble": { "type": "boolean", "default": true },
    "autoLoad": { "type": "boolean", "default": true }
  }
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "data": {
      "type": "object",
      "properties": {
        "filename": { "type": "string" },
        "size": { "type": "integer" },
        "loaded": { "type": "boolean" },
        "bytecode": { "type": "array", "items": { "type": "integer" } }
      }
    }
  }
}
```

**Maps to:** File handling and `assemble()` + `memory.loadProgram()`

### Debugging Operations

#### 16. Add Memory Breakpoint
**Endpoint:** `POST /api/mcp/debug/breakpoint/memory`  
**RPC:** `debug.addMemoryBreakpoint`

**Request Schema:**
```json
{
  "type": "object",
  "required": ["address"],
  "properties": {
    "address": { "type": "integer", "minimum": 0, "maximum": 65535 },
    "condition": {
      "type": "string",
      "enum": ["read", "write", "access"],
      "default": "write"
    },
    "valueFilter": { "type": "integer", "minimum": 0, "maximum": 255 },
    "enabled": { "type": "boolean", "default": true }
  }
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "data": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "address": { "type": "integer" },
        "condition": { "type": "string" },
        "enabled": { "type": "boolean" }
      }
    }
  }
}
```

**Maps to:** Memory write listeners and breakpoint management

#### 17. Add CPU Breakpoint
**Endpoint:** `POST /api/mcp/debug/breakpoint/cpu`  
**RPC:** `debug.addCpuBreakpoint`

**Request Schema:**
```json
{
  "type": "object",
  "required": ["address"],
  "properties": {
    "address": { "type": "integer", "minimum": 0, "maximum": 65535 },
    "temporary": { "type": "boolean", "default": false },
    "condition": { "type": "string" }
  }
}
```

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "data": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "address": { "type": "integer" },
        "temporary": { "type": "boolean" }
      }
    }
  }
}
```

**Maps to:** CPU PC breakpoints

#### 18. Get System State Snapshot
**Endpoint:** `GET /api/mcp/debug/snapshot`  
**RPC:** `debug.snapshot`

**Request Schema:** `{}`

**Response Schema:**
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "data": {
      "type": "object",
      "properties": {
        "timestamp": { "type": "string", "format": "date-time" },
        "cpu": {
          "type": "object",
          "properties": {
            "pc": { "type": "integer" },
            "a": { "type": "integer" },
            "x": { "type": "integer" },
            "y": { "type": "integer" },
            "flags": { "type": "object" }
          }
        },
        "memory": {
          "type": "object",
          "properties": {
            "zeroPage": { "type": "array", "items": { "type": "integer" } },
            "programArea": { "type": "array", "items": { "type": "integer" } }
          }
        },
        "breakpoints": {
          "type": "array",
          "items": { "type": "object" }
        }
      }
    }
  }
}
```

**Maps to:** CPU state access and memory reads

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

## Constraints and Edge Cases

### Memory Bounds
- Valid addresses: 0x0000-0xFFFF (65536 bytes total)
- Zero page: 0x0000-0x00FF (256 bytes)
- Program area: 0x0600-0x06FF (256 bytes recommended)
- Video framebuffer: 0x0200-0x05FF (1024 bytes)
- I/O registers: 0x00F0-0x00F2

### Assembly Constraints
- Maximum source length: 10KB
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

## Security Considerations

### Input Validation
- Assembly source code sanitized for dangerous patterns
- Memory address bounds checking
- Program size validation
- Timeout mechanisms prevent infinite loops

### Rate Limiting
- Per-client rate limiting on all endpoints
- Progressive delays for excessive requests
- Automatic banning for abuse patterns

### Resource Protection
- Memory access isolated to emulator instance
- File operations restricted to designated directories
- CPU execution time limits prevent resource exhaustion

## Common Flow Examples

### Flow 1: Assemble + Run Hello World
```json
// 1. Assemble program
POST /api/mcp/assemble
{
  "source": ".org $0600\nLDA #$48\nSTA $F1\nLDA #$65\nSTA $F1\nLDA #$6C\nSTA $F1\nLDA #$6C\nSTA $F1\nLDA #$6F\nSTA $F1\nHLT",
  "orgAddress": 1536
}

// 2. Load program into memory
POST /api/mcp/memory/load-program
{
  "bytecode": [169, 72, 133, 241, 169, 101, 133, 241, 169, 108, 133, 241, 169, 108, 133, 241, 169, 111, 133, 241, 0],
  "startAddress": 1536
}

// 3. Run program
POST /api/mcp/cpu/run
{
  "maxSteps": 100
}
```

### Flow 2: Load Echo Demo
```json
// 1. Load sample
POST /api/mcp/programs/load-sample
{
  "sampleName": "echo",
  "assembled": true
}

// 2. Start execution
POST /api/mcp/cpu/run
{
  "maxSteps": 1000,
  "breakOnHalt": false
}

// 3. Send input (simulates ESC to exit)
POST /api/mcp/terminal/write
{
  "text": "\u001b",
  "addNewline": false
}
```

### Flow 3: Draw Pixel and Trigger VUP
```json
// 1. Write to framebuffer
POST /api/mcp/video/write
{
  "data": [255],
  "startAddress": 512
}

// 2. Execute VUP instruction (if in running program)
// Program must contain VUP instruction at PC
POST /api/mcp/cpu/step
{}
```

### Flow 4: Assemble and Run Code (New)
```json
// 1. One-shot assemble, load, and run
POST /api/mcp/assemble/load-and-run
{
  "source": ".org $0600\nLDA #$42\nSTA $F1\nJMP $0600",
  "resetCPU": true,
  "maxSteps": 1000
}
```

### Flow 5: AI-Assisted Development (New)
```json
// 1. Generate assembly from natural language
POST /api/mcp/ai/generate
{
  "prompt": "Write assembly code to display 'HELLO' on the terminal",
  "task": "code",
  "options": {
    "maxTokens": 200,
    "temperature": 0.3
  }
}

// 2. Assemble the generated code
POST /api/mcp/assemble/load-and-run
{
  "source": "[AI generated assembly code]",
  "resetCPU": true,
  "maxSteps": 1000
}
```

### Flow 6: Save/Load Emulator State (New)
```json
// 1. Save current state
POST /api/mcp/memory/save-state
{
  "name": "before-debug",
  "description": "State before debugging issue",
  "tags": ["debug", "problem-123"]
}

// 2. Load saved state later
POST /api/mcp/memory/load-state
{
  "name": "before-debug",
  "loadCPUState": true,
  "loadBreakpoints": true
}
```

## Aggregate Schema For Programmatic Consumption

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "title": "iMaCoMpUtERussy MCP API Schemas",
  "type": "object",
  "definitions": {
    "cpuReset": { /* ... */ },
    "cpuStep": { /* ... */ },
    "cpuRun": { /* ... */ },
    "cpuGetStatus": { /* ... */ },
    "memoryRead": { /* ... */ },
    "memoryWrite": { /* ... */ },
    "memoryLoadProgram": { /* ... */ },
    "assemble": { /* ... */ },
    "terminalWrite": { /* ... */ },
    "terminalRead": { /* ... */ },
    "terminalStatus": { /* ... */ },
    "videoWrite": { /* ... */ },
    "videoRead": { /* ... */ },
    "programLoadSample": { /* ... */ },
    "programUpload": { /* ... */ },
    "debugBreakpointMemory": { /* ... */ },
    "debugBreakpointCpu": { /* ... */ },
    "debugSnapshot": { /* ... */ }
  },
  "properties": {
    "endpoints": {
      "type": "object",
      "patternProperties": {
        ".*": {
          "type": "object",
          "properties": {
            "method": { "type": "string" },
            "path": { "type": "string" },
            "rpc": { "type": "string" },
            "requestSchema": { "type": "object" },
            "responseSchema": { "type": "object" },
            "examples": {
              "type": "object",
              "properties": {
                "request": {},
                "response": {}
              }
            }
          }
        }
      }
    },
    "errorCodes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "code": { "type": "string" },
          "httpStatus": { "type": "integer" },
          "description": { "type": "string" }
        }
      }
    }
  }
}