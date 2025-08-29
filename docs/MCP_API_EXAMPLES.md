# iMaCoMpUtERussy MCP API Examples

This document provides complete end-to-end usage examples showing how to leverage the MCP API for common emulator workflows. All examples include concrete curl commands, JavaScript fetch examples, and cross-references to schema files.

## Base URL
All examples assume the server runs on `http://localhost:8001`. Adjust the hostname and port as needed for your deployment.

## Example 1: Assemble + Run Hello World

This example demonstrates the complete workflow of assembling source code, loading it into memory, and running it to produce terminal output.

### Assembly Source
Using the provided [`samples/hello-terminal.asm`](samples/hello-terminal.asm:1) sample:

```asm
; Hello World Program for VideoStorage-8 Interactive Terminal
; Outputs "HELLO WORLD!" to the terminal

.org $0600

START:
    ; Output "HELLO WORLD!" character by character
    LDA #$48       ; 'H'
    STA $F1        ; Send to output

    LDA #$45       ; 'E'
    STA $F1

    LDA #$4C       ; 'L'
    STA $F1

    LDA #$4C       ; 'L'
    STA $F1

    LDA #$4F       ; 'O'
    STA $F1

    LDA #$20       ; ' ' (space)
    STA $F1

    LDA #$57       ; 'W'
    STA $F1

    LDA #$4F       ; 'O'
    STA $F1

    LDA #$52       ; 'R'
    STA $F1

    LDA #$4C       ; 'L'
    STA $F1

    LDA #$44       ; 'D'
    STA $F1

    LDA #$21       ; '!'
    STA $F1

    LDA #$0A       ; Line feed
    STA $F1

    HLT            ; Halt program
```

### Step-by-step Workflow

#### 1. Reset CPU (Optional)
**Endpoint:** `POST /mcp/cpu/reset`

```bash
curl -X POST http://localhost:8001/mcp/cpu/reset \
  -H "Content-Type: application/json" \
  -d '{"hardReset": false}'
```

**Response:**
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

**JavaScript:**
```javascript
const response = await fetch('/mcp/cpu/reset', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ hardReset: false })
});
const result = await response.json();
```

#### 2. Assemble Source Code
**Endpoint:** `POST /mcp/assemble/source`

```bash
curl -X POST http://localhost:8001/mcp/assemble/source \
  -H "Content-Type: application/json" \
  -d '{
    "source": ".org $0600\n\nSTART:\n    ; Output \"HELLO WORLD!\" character by character\n    LDA #$48       ; '\''H'\''\n    STA $F1        ; Send to output\n    \n    LDA #$45       ; '\''E'\''\n    STA $F1\n    \n    LDA #$4C       ; '\''L'\''\n    STA $F1\n    \n    LDA #$4C       ; '\''L'\''\n    STA $F1\n    \n    LDA #$4F       ; '\''O'\''\n    STA $F1\n    \n    LDA #$20       ; '\'' '\'' (space)\n    STA $F1\n    \n    LDA #$57       ; '\''W'\''\n    STA $F1\n    \n    LDA #$4F       ; '\''O'\''\n    STA $F1\n    \n    LDA #$52       ; '\''R'\''\n    STA $F1\n    \n    LDA #$4C       ; '\''L'\''\n    STA $F1\n    \n    LDA #$44       ; '\''D'\''\n    STA $F1\n    \n    LDA #$21       ; '\''!'\''\n    STA $F1\n    \n    LDA #$0A       ; Line feed\n    STA $F1\n    \n    HLT            ; Halt program",
    "optimize": false,
    "orgAddress": 1536
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bytecode": [169, 72, 133, 241, 169, 69, 133, 241, 169, 76, 133, 241, 169, 76, 133, 241, 169, 79, 133, 241, 169, 32, 133, 241, 169, 87, 133, 241, 169, 79, 133, 241, 169, 82, 133, 241, 169, 76, 133, 241, 169, 68, 133, 241, 169, 33, 133, 241, 169, 10, 133, 241, 0, 0, 0],
    "hexBytes": ["A9", "48", "85", "F1", "A9", "45", "85", "F1", "A9", "4C", "85", "F1", "A9", "4C", "85", "F1", "A9", "4F", "85", "F1", "A9", "20", "85", "F1", "A9", "57", "85", "F1", "A9", "4F", "85", "F1", "A9", "52", "85", "F1", "A9", "4C", "85", "F1", "A9", "44", "85", "F1", "A9", "21", "85", "F1", "A9", "0A", "85", "F1", "00", "00", "00"],
    "instructionCount": 12,
    "sizeBytes": 51,
    "program": [
      {
        "address": 1536,
        "machineCode": [169, 72],
        "size": 2,
        "source": "LDA #$48       ; 'H'"
      }
    ]
  }
}
```

#### 3. Load Program into Memory
**Endpoint:** `POST /mcp/memory/loadProgram`

```bash
curl -X POST http://localhost:8001/mcp/memory/loadProgram \
  -H "Content-Type: application/json" \
  -d '{
    "bytecode": [169, 72, 133, 241, 169, 69, 133, 241, 169, 76, 133, 241, 169, 76, 133, 241, 169, 79, 133, 241, 169, 32, 133, 241, 169, 87, 133, 241, 169, 79, 133, 241, 169, 82, 133, 241, 169, 76, 133, 241, 169, 68, 133, 241, 169, 33, 133, 241, 169, 10, 133, 241, 0, 0, 0],
    "startAddress": 1536,
    "validate": true
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "startAddress": 1536,
    "bytesLoaded": 51,
    "endAddress": 1586,
    "programSize": 51
  }
}
```

#### 4. Run the Program
**Endpoint:** `POST /mcp/cpu/run`

```bash
curl -X POST http://localhost:8001/mcp/cpu/run \
  -H "Content-Type: application/json" \
  -d '{
    "maxSteps": 100,
    "stepDelay": 10,
    "breakOnHalt": true
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "stepsExecuted": 48,
    "totalCycles": 96,
    "halted": true,
    "finalState": {
      "pc": 1587,
      "a": 0,
      "x": 0,
      "y": 0
    },
    "executionTrace": [
      { "step": 1, "pc": 1536, "instruction": "LDA #$48" },
      { "step": 2, "pc": 1538, "instruction": "STA $F1" },
      { "step": 3, "pc": 1540, "instruction": "LDA #$45" }
    ]
  }
}
```

#### 5. Verify Terminal Output
**Endpoint:** `POST /mcp/terminal/read`

```bash
curl -X POST http://localhost:8001/mcp/terminal/read \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "input": "",
    "bytesRead": 0,
    "hasInput": false
  }
}
```

> **Note**: The terminal output is written character-by-character during program execution, so you may see it through status register polling (address 0xF2) or by the program completing successfully.

### Alternative: Load-And-Run in One Step
**Endpoint:** `POST /mcp/assemble/loadAndRun`

```bash
curl -X POST http://localhost:8001/mcp/assemble/loadAndRun \
  -H "Content-Type: application/json" \
  -d '{
    "source": ".org $0600\n\nSTART:\n    ; Output \"HELLO WORLD!\" character by character\n    LDA #$48\n    STA $F1\n    LDA #$45\n    STA $F1\n    LDA #$4C\n    STA $F1\n    HLT",
    "resetCPU": true,
    "maxSteps": 100
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "assembledByteCount": 11,
    "loadAddress": 1536,
    "runOutcome": {
      "stepsExecuted": 6,
      "halted": true,
      "finalState": {
        "pc": 1547,
        "a": 0,
        "x": 0,
        "y": 0,
        "running": false
      }
    }
  }
}
```

## Example 2: Load Echo Demo via Samples

This example shows how to use pre-built sample programs for interactive scenarios.

### Using the Echo Sample
The [`samples/echo.asm`](samples/echo.asm:1) sample creates an interactive echo program that reads input and echoes it back.

```asm
; Echo Program for VideoStorage-8 Interactive Terminal
; Reads characters from input and echoes them to output

.org $0600

ECHO_LOOP:
    ; Check if input is available
    LDA $F2        ; Load status register
    AND #$01       ; Check bit 0 (input ready)
    BEQ ECHO_LOOP  ; If no input, keep waiting

    ; Read character from input
    LDA $F0        ; Load character from input register

    ; Check for special characters
    CMP #$0D       ; Is it carriage return (Enter)?
    BEQ NEWLINE    ; If yes, handle newline

    CMP #$1B       ; Is it ESC character?
    BEQ EXIT       ; If yes, exit program

    ; Echo character to output
    STA $F1        ; Store character to output register
    JMP ECHO_LOOP  ; Continue loop

NEWLINE:
    LDA #$0A       ; Load line feed character
    STA $F1        ; Send to output
    JMP ECHO_LOOP  ; Continue loop

EXIT:
    ; Send goodbye message
    LDA #$42       ; 'B'
    STA $F1
    LDA #$59       ; 'Y'
    STA $F1
    LDA #$45       ; 'E'
    STA $F1
    LDA #$0A       ; Line feed
    STA $F1

    HLT            ; Halt program
```

#### 1. Load Echo Sample
**Endpoint:** `POST /mcp/programs/load-sample`

```bash
curl -X POST http://localhost:8001/mcp/programs/load-sample \
  -H "Content-Type: application/json" \
  -d '{
    "sampleName": "echo",
    "assembled": true,
    "resetCPU": true
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sampleName": "echo",
    "programSize": 43,
    "loadAddress": 1536,
    "source": ".org $0600\n\nECHO_LOOP:\n    ; Check if input is available...",
    "bytecode": [165, 242, 41, 1, 240, 253, 165, 240, 201, 13, 240, 3, 201, 27, 240, 10, 133, 241, 76, 0, 6, 169, 10, 133, 241, 76, 0, 6, 169, 66, 133, 241, 169, 89, 133, 241, 169, 69, 133, 241, 169, 10, 133, 241, 0]
  }
}
```

#### 2. Start Execution
**Endpoint:** `POST /mcp/cpu/run`

```bash
curl -X POST http://localhost:8001/mcp/cpu/run \
  -H "Content-Type: application/json" \
  -d '{
    "maxSteps": 1000,
    "breakOnHalt": false
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "stepsExecuted": 1000,
    "totalCycles": 2000,
    "halted": false,
    "finalState": {
      "pc": 1536,
      "a": 0,
      "x": 0,
      "y": 0
    }
  }
}
```

The program will now be waiting for input at the ECHO_LOOP.

#### 3. Send Input
**Endpoint:** `POST /mcp/terminal/write`

```bash
curl -X POST http://localhost:8001/mcp/terminal/write \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, World!",
    "addNewline": true
  }'
```

#### 4. Exit Program
```bash
curl -X POST http://localhost:8001/mcp/terminal/write \
  -H "Content-Type: application/json" \
  -d '{
    "text": "\u001b",
    "addNewline": false
  }'
```

## Example 3: Draw a Pixel and Trigger Video Update

This example demonstrates video framebuffer manipulation and the VUP (Video Update Pending) mechanism.

#### 1. Clear Video Framebuffer
**Endpoint:** `POST /mcp/video/clear`

```bash
curl -X POST http://localhost:8001/mcp/video/clear \
  -H "Content-Type: application/json" \
  -d '{
    "color": 0
  }'
```

**Response:**
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

#### 2. Set a Pixel
**Endpoint:** `POST /mcp/video/setPixel`

```bash
curl -X POST http://localhost:8001/mcp/video/setPixel \
  -H "Content-Type: application/json" \
  -d '{
    "x": 10,
    "y": 5,
    "color": 15
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "address": 536,
    "value": 15
  }
}
```

#### 3. Trigger Video Update (VUP)
**Endpoint:** `POST /mcp/video/update`

```bash
curl -X POST http://localhost:8001/mcp/video/update \
  -H "Content-Type: application/json" \
  -d '{
    "timeout": 5000,
    "flush": true
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "durationMs": 150,
    "status": "updated"
  }
}
```

#### 4. Read Back Framebuffer for Verification
**Endpoint:** `POST /mcp/memory/read`

```bash
curl -X POST http://localhost:8001/mcp/memory/read \
  -H "Content-Type: application/json" \
  -d '{
    "address": 536,
    "bytes": 1
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "address": 536,
    "bytes": 1,
    "value": 15,
    "hexValue": "0F"
  }
}
```

## Example 4: Program Creation and Saving

This example shows the full workflow for creating, testing, and saving a new assembly program.

#### 1. Create Test Program
We'll create a simple counter program that counts from 0 to 10 and outputs each value.

**Source code:**
```asm
.org $0600

    LDX #0          ; Initialize counter

COUNT_LOOP:
    TXA             ; Transfer X to A for output
    STA $F1         ; Output current count
    INX             ; Increment counter
    CPX #11          ; Compare with 11
    BCC COUNT_LOOP  ; Branch if less than 11

    HLT             ; Halt program
```

#### 2. Assemble and Test
**Endpoint:** `POST /mcp/assemble/loadAndRun`

```bash
curl -X POST http://localhost:8001/mcp/assemble/loadAndRun \
  -H "Content-Type: application/json" \
  -d '{
    "source": ".org $0600\n\n    LDX #0          ; Initialize counter\n\nCOUNT_LOOP:\n    TXA             ; Transfer X to A for output\n    STA $F1         ; Output current count\n    INX             ; Increment counter\n    CPX #11          ; Compare with 11\n    BCC COUNT_LOOP  ; Branch if less than 11\n\n    HLT             ; Halt program",
    "resetCPU": true,
    "maxSteps": 200
  }'
```

#### 3. Save the Program
**Endpoint:** `POST /mcp/programs/save`

```bash
curl -X POST http://localhost:8001/mcp/programs/save \
  -H "Content-Type: application/json" \
  -d '{
    "name": "counter-demo",
    "source": ".org $0600\n\n    LDX #0          ; Initialize counter\n\nCOUNT_LOOP:\n    TXA             ; Transfer X to A for output\n    STA $F1         ; Output current count\n    INX             ; Increment counter\n    CPX #11          ; Compare with 11\n    BCC COUNT_LOOP  ; Branch if less than 11\n\n    HLT             ; Halt program",
    "overwrite": false
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "counter-demo",
    "path": "counter-demo.asm",
    "bytesWritten": 234,
    "savedAt": "2023-12-01T12:45:30Z"
  }
}
```

#### 4. Verify It Was Saved
**Endpoint:** `GET /mcp/programs/list`

```bash
curl -X GET http://localhost:8001/mcp/programs/list
```

## Example 5: Debug Workflow with Breakpoints

This example shows advanced debugging features including breakpoints and memory inspection.

### Setup Debug Program
**Source code:**
```asm
.org $0600

    LDA #$00    ; Initialize accumulator
    STA $00     ; Store in zero page
    LDA #$42    ; Load answer to life
    STA $01     ; Store
    CLC         ; Clear carry (good practice)
    ADC #$0A    ; Should result in $4C
    STA $02     ; Store result
    HLT         ; Finished
```

#### 1. Load Debug Program
**Endpoint:** `POST /mcp/assemble/loadAndRun`

```bash
curl -X POST http://localhost:8001/mcp/assemble/loadAndRun \
  -H "Content-Type: application/json" \
  -d '{
    "source": ".org $0600\n\n    LDA #$00    ; Initialize accumulator\n    STA $00     ; Store in zero page\n    LDA #$42    ; Load answer to life\n    STA $01     ; Store\n    CLC         ; Clear carry (good practice)\n    ADC #$0A    ; Should result in $4C\n    STA $02     ; Store result\n    HLT         ; Finished",
    "resetCPU": true,
    "maxSteps": 0
  }'
```

#### 2. Set Breakpoint
**Endpoint:** `POST /mcp/debug/breakpoints`

```bash
curl -X POST http://localhost:8001/mcp/debug/breakpoints \
  -H "Content-Type: application/json" \
  -d '{
    "action": "set",
    "address": 1542
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "operationResult": {
      "action": "set",
      "success": true,
      "id": "bp_1",
      "address": 1542
    }
  }
}
```

#### 3. Run with Tracing
**Endpoint:** `POST /mcp/debug/trace`

```bash
curl -X POST http://localhost:8001/mcp/debug/trace \
  -H "Content-Type: application/json" \
  -d '{
    "steps": 20,
    "until": "breakpoint"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "stepsExecuted": 10,
    "halted": false,
    "haltReason": "breakpoint_hit",
    "trace": [
      {
        "pc": 1536,
        "instruction": "LDA #$00",
        "registers": { "a": 0, "x": 0, "y": 0 },
        "cycles": 2
      }
    ]
  }
}
```

#### 4. Inspect Memory After Breakpoint
**Endpoint:** `POST /mcp/debug/memoryView`

```bash
curl -X POST http://localhost:8001/mcp/debug/memoryView \
  -H "Content-Type: application/json" \
  -d '{
    "address": 0,
    "size": 16
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "address": 0,
    "size": 16,
    "bytes": [0, 66, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "format": "numeric"
  }
}
```

## JavaScript Client Example

Here's a complete JavaScript client that demonstrates programmatic usage:

```javascript
class MCPClient {
  constructor(baseUrl = 'http://localhost:8001') {
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    if (options.body) {
      config.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, config);
    return await response.json();
  }

  // High-level operations
  async assembleAndRun(source, maxSteps = 1000) {
    // Assemble
    const assembleResult = await this.request('/mcp/assemble/source', {
      method: 'POST',
      body: { source, optimize: false }
    });

    if (!assembleResult.success) {
      throw new Error(`Assembly failed: ${assembleResult.error.message}`);
    }

    // Load and run
    const runResult = await this.request('/mcp/assemble/loadAndRun', {
      method: 'POST',
      body: { source, resetCPU: true, maxSteps }
    });

    if (!runResult.success) {
      throw new Error(`Execution failed: ${runResult.error.message}`);
    }

    return runResult.data;
  }

  async listPrograms() {
    const result = await this.request('/mcp/programs/list');
    return result.success ? result.data : [];
  }

  async setPixel(x, y, color) {
    const result = await this.request('/mcp/video/setPixel', {
      method: 'POST',
      body: { x, y, color }
    });
    return result.success ? result.data : null;
  }
}

// Usage example
const client = new MCPClient();

// Run hello world
const result = await client.assembleAndRun(`
  .org $0600
  LDA #$48   ; 'H'
  STA $F1
  LDA #$45   ; 'E'
  STA $F1
  HLT
`, 100);

console.log('Execution completed:', result.runOutcome);

// List available programs
const programs = await client.listPrograms();
console.log('Available programs:', programs);

// Set pixel
await client.setPixel(5, 5, 15);
```

## Error Handling Patterns

All MCP endpoints follow consistent error patterns:

```javascript
// Always check success field
const response = await fetch('/mcp/cpu/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ maxSteps: 100 })
});

const result = await response.json();

if (!result.success) {
  const error = result.error;
  console.error(`Error ${error.code}: ${error.message}`);

  // Handle specific error types
  switch (error.code) {
    case 'MEMORY_OUT_OF_BOUNDS':
      // Adjust memory address
      break;
    case 'CPU_NOT_READY':
      // Wait and retry or reset CPU
      break;
    case 'INVALID_ASSEMBLY':
      // Fix assembly source
      break;
    default:
      // Generic error handling
      break;
  }
}
```

## Schema Validation

For production use, validate all requests and responses against schemas:

```javascript
import Ajv from 'ajv';
import schemas from './docs/mcp_schemas.json';

const ajv = new Ajv({ allErrors: true });

// Compile validators
const validateCpuRun = ajv.compile(schemas.schemas.cpu.run.request);

// Validate before sending
const requestData = { maxSteps: 100 };
if (!validateCpuRun(requestData)) {
  throw new Error(`Invalid request: ${JSON.stringify(validateCpuRun.errors)}`);
}
```

All examples in this document are tested against the MCP server implementation and will work with the provided schemas.