# iMaCoMpUtERussy - Interactive 8-bit CPU Emulator

An educational 8-bit CPU emulator with assembly programming, terminal I/O, video graphics, and MCP (Model Context Protocol) server integration. Created by Kyle Durepos.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm (for MCP server and advanced features)
- Modern web browser with ES6 module support
- Optional: Python 3.8+ (for documentation server)

### Installation & Setup
```bash
# Clone the repository
git clone https://github.com/mojomast/iMaCoMpUtERussy.git
cd iMaCoMpUtERussy

# Install dependencies
npm install

# Start the development server (includes MCP server)
npm start
```

### Basic Usage
1. **Frontend Only**: Open `index.html` in a modern web browser
2. **With MCP Server**: Use `npm start` and navigate to `http://localhost:3000`
3. **Load sample programs** from the dropdown menu
4. **Write assembly code** in the editor panel
5. **Step through execution** or run programs at adjustable speeds

## 🎮 Features

### Core CPU Emulation
- **6502-style instruction set** with custom video and I/O extensions
- **Real-time debugging** with step-by-step execution
- **Memory visualization** with live updates
- **Breakpoint system** for debugging
- **Speed control** from 1 Hz to 1 kHz

### Programming Environment
- **Assembly editor** with syntax highlighting
- **Sample programs** including Fibonacci, Hello World, and graphics demos
- **Memory-mapped I/O** for terminal and video operations
- **Interactive terminal** for bidirectional program communication

### Video System
- **32×24 pixel display** with 16-color palette
- **Memory-mapped framebuffer** at addresses $0200-$05FF
- **Real-time graphics updates** with VLD/VST/VUP instructions
- **Pattern loading** with predefined graphics blocks

### MCP Server Integration
- **REST API** for programmatic control
- **WebSocket events** for real-time monitoring
- **AI integration** for natural language programming
- **Queue system** for batch operations
- **Cross-platform compatibility** (Windows/macOS/Linux)

## 📊 Memory Map

| Address Range | Purpose | Size |
|---------------|---------|------|
| $0000-$00FF | Zero Page (variables, I/O) | 256 bytes |
| $0100-$01FF | Stack | 256 bytes |
| $0200-$05FF | Video Buffer (32×24 pixels) | 1024 bytes |
| $0600-$7FFF | User RAM (programs) | ~32KB |
| $8000-$BFFF | Video ROM | 16KB |
| $C000-$FFFF | System ROM | 16KB |

### I/O Registers
| Address | Name | Purpose |
|---------|------|---------|
| $F0 | INPUT_REG | Read keyboard input |
| $F1 | OUTPUT_REG | Write to terminal |
| $F2 | STATUS_REG | I/O status flags |
| $F5 | BANK_REG | Memory bank selection (0-255) |

## 📝 Instruction Set

### Load/Store Operations
- `LDA #$42` - Load immediate value into accumulator
- `STA $0200` - Store accumulator to memory
- `LDX`, `LDY` - Load X/Y registers
- `STX`, `STY` - Store X/Y registers

### Arithmetic & Logic
- `ADC #$10` - Add with carry
- `SBC #$05` - Subtract with carry
- `INC $0200` - Increment memory
- `DEC $0200` - Decrement memory
- `AND`, `ORA`, `EOR` - Logical operations

### Control Flow
- `JMP $0700` - Jump to address
- `JSR $0800` - Jump to subroutine
- `RTS` - Return from subroutine
- `BEQ`, `BNE` - Branch if equal/not equal
- `CMP #$42` - Compare with accumulator

### Video Instructions (Custom)
- `VLD #$00` - Load predefined pattern to video buffer
- `VST #$FF` - Store accumulator pixel to video buffer
- `VUP` - Update video display
- `VDL #$3C` - Video delay (60Hz timing)

### System Instructions
- `HLT` - Halt execution
- `BRK` - Software interrupt
- `RTI` - Return from interrupt

## 🔧 Development

### Project Structure
```
iMaCoMpUtERussy/
├── index.html              # Main frontend interface
├── js/                     # Core emulator modules
│   ├── cpu.js              # CPU emulation
│   ├── memory.js           # Memory management
│   ├── assembler.js        # Assembly compiler
│   └── mcp-client.js       # MCP client integration
├── server/                 # Backend MCP server
│   ├── mcp_server.js       # Main MCP server
│   ├── mcp_developer_adapter.js # API adapters
│   └── mcp_errors.js       # Error handling
├── samples/                # Example programs
├── docs/                   # Documentation
└── tests/                  # Test suite
```

### Running Tests
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:cpu
npm run test:memory
npm run test:assembler
npm run test:integration
```

### MCP Server Development
```bash
# Start MCP server only
npm run mcp-server

# Start with queue server
npm run dev:full

# Test MCP endpoints
curl http://localhost:8001/health
```

## 📋 Sample Programs

| Program | Description | Features |
|---------|-------------|----------|
| `hello-world.asm` | Basic terminal output | Memory-mapped I/O demo |
| `fibonacci.asm` | Mathematical computation | Zero-page addressing |
| `graphics-demo.asm` | Video display patterns | Video buffer manipulation |
| `echo.asm` | Interactive I/O | Keyboard input handling |
| `video-demo.asm` | Advanced graphics | Pattern loading, animations |

### Example: Hello World
```assembly
.org $0600                  ; Start at user RAM
LDA #72                     ; Load 'H' (ASCII 72)
STA $F1                     ; Output to terminal
LDA #101                    ; Load 'e' (ASCII 101)
STA $F1                     ; Output to terminal
; ... continue for "Hello World!"
HLT                         ; Halt execution
```

## 🌐 MCP API Integration

### Basic API Usage
```bash
# Reset CPU
curl -X POST http://localhost:8001/mcp/cpu/reset \
  -H "Content-Type: application/json" \
  -d '{"hardReset": false}'

# Load and run assembly
curl -X POST http://localhost:8001/mcp/assemble/loadAndRun \
  -H "Content-Type: application/json" \
  -d '{
    "source": ".org $0600\nLDA #$42\nSTA $00\nHLT",
    "run": true,
    "maxSteps": 100
  }'

# Set video pixel
curl -X POST http://localhost:8001/mcp/video/setPixel \
  -H "Content-Type: application/json" \
  -d '{"x": 10, "y": 5, "color": 15}'
```

### JavaScript Client Library
```javascript
import { MCPClient } from './lib/mcp-client.js';

const client = new MCPClient('http://localhost:8001');

// Test connectivity
const health = await client.healthCheck();
console.log('Server status:', health.healthy ? '🟢 Online' : '🔴 Offline');

// Assemble and run code
const result = await client.assembleAndRun(`
  .org $0600
  LDA #$42    ; Load 42 into accumulator
  STA $00     ; Store at memory location 0
  HLT         ; Halt execution
`);
```

## 🐛 Known Issues & Limitations

### Current Limitations
- Video display is simulated (no actual CRT output)
- Some 6502 instructions not yet implemented
- WebSocket server disabled in current build
- Limited to 64KB memory space
- No persistent storage for programs

### Planned Improvements
- Complete 6502 instruction set implementation
- Enhanced video capabilities and steganography
- Improved MCP server stability
- Better error handling and validation
- Performance optimizations

## 🔗 API Reference

### MCP Endpoints
- `POST /mcp/cpu/reset` - Reset CPU state
- `POST /mcp/cpu/step` - Execute single instruction
- `POST /mcp/cpu/run` - Execute multiple instructions
- `GET /mcp/cpu/state` - Get current CPU state
- `POST /mcp/memory/read` - Read memory contents
- `POST /mcp/memory/write` - Write to memory
- `POST /mcp/programs/load` - Load sample program
- `POST /mcp/programs/save` - Save program to file
- `POST /mcp/video/setPixel` - Set pixel color
- `POST /mcp/video/update` - Refresh display
- `POST /mcp/terminal/write` - Write to terminal
- `GET /mcp/terminal/read` - Read terminal input

### Response Format
```json
{
  "success": true,
  "data": {
    // endpoint-specific data
  }
}
```

## 📞 Support & Contributing

### Getting Help
1. Check the [troubleshooting guide](docs/TROUBLESHOOTING.md)
2. Review [API documentation](docs/MCP_API_DOCS.md)
3. Examine sample programs in the `samples/` directory
4. Run tests with `npm test` to verify installation

### Contributing
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

### Development Commands
```bash
npm run dev:proxy      # Start development proxy
npm run mcp-server     # Start MCP server only
npm run docs:serve     # Serve documentation
npm run test:all       # Run all tests
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**iMaCoMpUtERussy** - The computer that never existed, but should have! 🎮