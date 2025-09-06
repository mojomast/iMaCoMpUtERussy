# iMaCoMpUtERussy Architecture Documentation

## Overview

The iMaCoMpUtERussy project is a web-based 6502-compatible CPU emulator with an interactive development environment, AI integration via MCP (Model Context Protocol), and modular UI components. The system supports assembly programming, real-time debugging, terminal I/O, video graphics, and autonomous code generation.

The architecture follows a modular design with clear separation of concerns:
- **Core Emulator**: CPU and memory emulation (js/cpu.js, js/memory.js)
- **Frontend UI**: Modular panels and interactive components (js/ui/)
- **MCP Integration**: AI communication and remote control (js/mcp-client.js)
- **Assembler**: Source code compilation (js/assembler.js)
- **Samples and Documentation**: Educational examples and guides (samples/, docs/)

## Code Structure

### Directory Organization

```
videostorage-8/
├── js/                          # Core JavaScript modules
│   ├── cpu.js                   # 6502-compatible CPU emulator
│   ├── memory.js                # Memory management with regions and I/O
│   ├── assembler.js             # Assembly language compiler
│   ├── mcp-client.js            # MCP API client for AI integration
│   └── ui/                      # User interface components
│       ├── layout-manager.js    # Panel management and layout
│       ├── debugger.js          # CPU debugging interface
│       ├── assembly-panel.js    # Assembly editor and loader
│       ├── console.js           # Terminal I/O display
│       └── memory-viewer.js     # Memory inspection tool
├── samples/                     # Example assembly programs
├── docs/                        # Documentation and schemas
├── css/                         # Stylesheets and themes
└── index.html                   # Main application entry point
```

### Core Components

#### 1. CPU Emulator (js/cpu.js)

**Class**: [`iMaCoMpUtERussyCPU`](js/cpu.js)

The CPU emulator implements a 6502-compatible instruction set with custom extensions for video operations and enhanced I/O. Key features:

- **Registers**: A (Accumulator), X, Y (Index registers), SP (Stack Pointer), PC (Program Counter), P (Status flags)
- **Memory Mapping**: 64KB address space with defined regions (see Memory Architecture below)
- **Addressing Modes**: Immediate, Absolute, Zero Page, Zero Page X, Absolute X/Y, Indirect Y, Implied
- **Interrupt Handling**: IRQ/BRK with vector table at 0xFFFE-0xFFFF
- **Custom Instructions**: VLD/VST/VUP/VDL for video graphics, HLT for program termination

**Key Methods**:
- `reset()`: Initialize CPU state and vectors
- `step()`: Execute single instruction with breakpoint checking
- `run(maxSteps)`: Execute multiple instructions asynchronously
- `loadProgramMCP(bytes, origin)`: Load program with MCP event logging
- `handleInterrupt(isBRK)`: Common interrupt handler for IRQ/BRK

**Custom Differences from Standard 6502**:
- **Video Instructions**: VLD (0x8B) loads video blocks, VST (0x9B) stores pixels, VUP (0xAB) updates display, VDL (0xBB) adds frame delays
- **Memory-Mapped I/O**: $F0 (input), $F1 (output), $F2 (status) for terminal communication
- **Enhanced Breakpoints**: Integration with UI debugger for step-through execution
- **Async Execution**: Non-blocking run loop with yield points for UI responsiveness

#### 2. Memory Management (js/memory.js)

**Class**: [`iMaCoMpUtERussyMemory`](js/memory.js)

The memory system provides 64KB RAM with defined regions and memory-mapped I/O. Key features:

- **Address Space**: 0x0000-0xFFFF (65536 bytes)
- **Region Protection**: ROM regions (0x8000+) with configurable write protection
- **Event Listeners**: Read/write notifications for debugging and UI updates
- **I/O Integration**: Terminal and video operations via memory-mapped registers

**Memory Regions**:
| Address Range | Purpose | Access | Description |
|---------------|---------|--------|-------------|
| 0x0000-0x00FF | Zero Page | Read/Write | Fast access variables, I/O registers ($F0-$F2) |
| 0x0100-0x01FF | Stack | Read/Write | Push/pop operations, interrupt handling |
| 0x0200-0x05FF | Video Buffer | Read/Write | 1KB framebuffer for 32×24 pixel graphics (4 colors) |
| 0x0600-0x7FFF | User RAM | Read/Write | Program code and data storage |
| 0x8000-0xBFFF | Video ROM | Read-Only | Built-in video routines and graphics primitives |
| 0xC000-0xFFFF | System ROM | Read-Only | Operating system, interrupt vectors, BIOS |

**Key Methods**:
- `readByte(addr)` / `writeByte(addr, value)`: Basic memory access with event notification
- `loadProgram(addr, byteArray)`: Load assembled program into memory
- `addWriteListener(callback)`: Register for memory write events (used by UI)
- `searchBytes(pattern, startAddr)`: Find byte sequences in memory
- `toHexDump(startAddr, length)`: Generate formatted memory dump for display

**I/O Registers**:
- **$F0**: Input register - Read characters from terminal
- **$F1**: Output register - Write characters to terminal  
- **$F2**: Status register - Bit 0: Input ready (1=available), other bits reserved

#### 3. Assembler (js/assembler.js)

The assembler compiles human-readable assembly source into machine code bytes. Supports:

- **Directives**: `.org address` for origin specification
- **Instructions**: Full 6502 instruction set plus custom video ops
- **Expressions**: Simple numeric constants and labels
- **Error Reporting**: Syntax errors with line numbers

**Usage**:
```javascript
import { assemble } from './assembler.js';
const result = assemble(sourceCode, { origin: 0x0600 });
console.log(result.bytes); // Uint8Array of machine code
console.log(result.errors); // Array of compilation errors
```

#### 4. User Interface (js/ui/)

The UI is built with modular, draggable panels using a layout manager. Each panel is independent and can be toggled, resized, and repositioned.

**Layout Manager (js/ui/layout-manager.js)**:
- **Class**: [`LayoutManager`](js/ui/layout-manager.js)
- **Features**: Drag-and-drop reordering, resize handles, persistent layout, sidebar controls
- **Panels**: Assembly editor, debugger, memory viewer, console, terminal, MCP input

**Key UI Components**:
- **Debugger Panel (js/ui/debugger.js)**: CPU controls (Run/Step/Reset), register display, breakpoint management
- **Assembly Panel**: Source code editor with syntax highlighting and sample loading
- **Memory Viewer**: Hex dump display with live updates and search
- **Interactive Terminal**: Bidirectional I/O with real-time program communication
- **Console**: System messages, execution trace, error reporting
- **MCP Panel**: Natural language input for AI code generation

**Panel Extension**:
To add a new UI panel:
1. Create `js/ui/new-panel.js` with initialization function
2. Add panel HTML structure to `index.html` (hidden by default)
3. Register in LayoutManager: `panels.push({ id: 'new-panel', element: document.getElementById('new-panel') })`
4. Import and call `initializeNewPanel()` in layout init
5. Add sidebar toggle in `createSidebar()`

#### 5. MCP Integration (js/mcp-client.js)

**MCP Client**: Provides RESTful API communication with the backend MCP server for AI integration and remote control.

**Key Features**:
- **Auto-Discovery**: Detects MCP server via health checks (localhost:8001, proxy)
- **CPU Control**: resetCPU(), stepCPU(), runCPU() with timeout handling
- **Memory Access**: readMemory(), writeMemory(), saveState(), loadState()
- **Assembly Pipeline**: assembleAndLoad(), assembleAndRun() for source-to-execution
- **AI Generation**: aiGenerate() for natural language to assembly code
- **WebSocket Events**: Real-time updates for debug events, memory changes, video updates
- **Error Handling**: Structured MCP error parsing with retry logic

**Data Flow**:
```
User Input (UI) → MCP Client → REST API → MCP Server → Emulator Core
     ↑                                              ↓
WebSocket Events ← Real-time Updates ← Execution Trace ← CPU/Memory
```

**MCP Extension**:
To add new MCP endpoints:
1. Define JSON schema in `docs/mcp_schemas/`
2. Implement server handler in `server/mcp_server.js`
3. Add client method in `mcp-client.js` with request/response handling
4. Update API documentation in `docs/MCP_API_DESIGN.md`

## Data Flow

### Program Execution Pipeline

1. **Assembly Loading**:
   ```
   User .asm file → assemble() → machine code bytes → memory.loadProgram() → CPU PC set
   ```

2. **Interactive Execution**:
   ```
   UI Step/Run → cpu.step()/cpu.run() → memory read/write → UI register/memory update
   ```

3. **Terminal I/O**:
   ```
   Program writes $F1 → memory.writeByte() → write listener → terminal display update
   User types → terminal input → memory.writeByte($F0) → program reads $F0
   ```

4. **Video Graphics**:
   ```
   Program VST $0200-$05FF → memory write → video buffer update → canvas render
   Program VUP → cpu.executeInstruction() → videoDisplay.updateDisplay()
   ```

5. **MCP/AI Integration**:
   ```
   Natural language prompt → mcpClient.aiGenerate() → REST API → AI model → assembly code
   Generated code → assembleAndLoad() → memory/CPU → execution/debugging
   ```

### Component Communication

- **CPU ↔ Memory**: Direct method calls for readByte/writeByte during instruction execution
- **UI ↔ Core**: Event listeners on memory writes, periodic polling for register updates
- **MCP Client ↔ Server**: HTTP requests for operations, WebSocket for real-time events
- **Layout Manager ↔ Panels**: DOM manipulation and event delegation for panel controls

## Extension Guide

### Adding a New CPU Instruction

1. **Define Opcode** in `js/cpu.js` instruction handlers:
```javascript
0xXX: () => {
    // Implementation logic
    const operand = this.getAddressOrValue('imm');
    // Update registers/flags
    this.updateZN(result);
    return cycles;
}
```

2. **Update Assembler** in `js/assembler.js` to recognize mnemonic:
```javascript
// Add to instruction table
'NEW_INSTR': { opcode: 0xXX, modes: ['imm', 'abs'], cycles: [2, 4] }
```

3. **Document** in `docs/INSTRUCTION_SET.md` with syntax, cycles, flags affected

4. **Test** with new sample program in `samples/`

### Adding a New UI Panel

1. **Create Panel HTML** in `index.html`:
```html
<div id="new-panel" class="panel" style="display: none;">
    <div class="panel-header">
        <span>New Panel</span>
        <div class="drag-handle">⋮⋮</div>
    </div>
    <div class="panel-content">
        <!-- Panel content here -->
    </div>
</div>
```

2. **Create Module** `js/ui/new-panel.js`:
```javascript
export function initializeNewPanel() {
    const panel = document.getElementById('new-panel');
    // Initialize panel functionality
    console.log('New panel initialized');
}
```

3. **Register in LayoutManager** `js/ui/layout-manager.js`:
```javascript
// In init() method
this.panels.push({
    element: document.getElementById('new-panel'),
    id: 'new-panel',
    visible: false,
    title: 'New Panel'
});

// Import and initialize
import('./new-panel.js').then(module => {
    if (module.initializeNewPanel) module.initializeNewPanel();
});
```

4. **Add Sidebar Control** in `createSidebar()`:
```javascript
<div class="panel-control">
    <label>
        <input type="checkbox" data-panel-id="new-panel" class="panel-toggle">
        New Panel
    </label>
    <button class="reset-panel" data-panel-id="new-panel">Reset</button>
</div>
```

5. **Add CSS** in `css/components.css` for panel styling

### Adding MCP Endpoint

1. **Define Schema** `docs/mcp_schemas/new-endpoint.request.json`:
```json
{
    "type": "object",
    "properties": {
        "param1": { "type": "string" },
        "param2": { "type": "integer" }
    }
}
```

2. **Implement Server Handler** `server/mcp_server.js`:
```javascript
app.post('/mcp/new-endpoint', validateSchema('new-endpoint'), async (req, res) => {
    const { param1, param2 } = req.body;
    // Implementation logic
    res.json({ success: true, data: { result: processedData } });
});
```

3. **Add Client Method** `js/mcp-client.js`:
```javascript
async newEndpoint(param1, param2) {
    const options = this.createFetchOptions({ param1, param2 });
    const response = await this.timeoutFetch(`${this.serverUrl}/mcp/new-endpoint`, options);
    return await this.handleMCPResponse(response, 'newEndpoint');
}
```

4. **Update Documentation** `docs/MCP_API_DESIGN.md` with endpoint details

### Adding Sample Program

1. **Create File** `samples/new-program.asm` with comments and documentation
2. **Test Program** using UI loader or manual assembly
3. **Add to Sample Loader** in `js/ui/assembly-panel.js`:
```javascript
const samples = {
    'new-program': {
        name: 'New Program',
        file: 'samples/new-program.asm',
        description: 'Description of program functionality'
    }
};
```

4. **Update README** with new example reference

## Performance Considerations

- **CPU Execution**: Async run loop with yield every 100 steps prevents UI blocking
- **Memory Access**: Direct Uint8Array access for speed, event listeners only for UI updates
- **UI Updates**: Throttled rendering during continuous execution
- **MCP Requests**: Timeout handling and error recovery for network operations
- **Assembly Compilation**: Single-pass assembler optimized for small programs (<1KB)

## Security Model

- **Memory Isolation**: Emulator memory separate from browser memory
- **Input Validation**: Assembly source sanitized, memory bounds checking
- **API Security**: MCP endpoints with rate limiting and API key validation
- **File Loading**: Only .asm/.txt files, client-side processing only
- **WebSocket Security**: Same-origin policy, message validation

This architecture provides a solid foundation for extension while maintaining clear separation of concerns and performance optimization for the interactive emulator experience.