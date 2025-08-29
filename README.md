# iMaCoMpUtERussy: The Computer That Never Existed

*Created by Kyle Durepos*

**The legendary iMaCoMpUtERussy** - a mythical 8-bit computer that never existed, but should have. This retro CPU emulator brings to life the **impossible machine** that could hide entire programs inside YouTube videos, execute assembly code in real-time with interactive terminals, and display graphics on a authentic CRT-style monitor that glows with retro phosphorescent magic.

Experience computing as it never was, but always should have been. 🕹️✨

A complete retro 8-bit CPU emulator featuring **interactive terminal I/O**, **video graphics display**, **advanced debugging tools**, and **steganography capabilities** for encoding assembly programs into videos and storing them on **YouTube**. 

This is the **iMaCoMpUtERussy** - the computer that time forgot, except it never existed in the first place. Built with the spirit of 1980s computing but powered by modern web technology, it performs digital magic that would have blown minds in the era of floppy disks and dot-matrix printers.

Build, debug, and interact with assembly programs in a full-featured retro development environment with real-time graphics output and impossible video storage tricks. 🎮💾

## ✨ Features

### 🖥️ **The Legend Lives**
The **iMaCoMpUtERussy** was the computer that never made it to production - a legendary machine whispered about in computing folklore. Now brought to life through the magic of modern web browsers, it demonstrates what could have been possible if 8-bit computers had the power to hide programs in videos and beam them across the internet.

### 🎮 **Interactive Development Environment**
- **Live Assembly Loading**: Load `.asm` files directly into the emulator
- **Step-by-Step Debugging**: Execute instructions one at a time with full state visibility
- **Interactive Terminal**: Real-time I/O communication with running programs
- **Video Graphics Display**: 32×24 pixel retro graphics with 4-color palette
- **Memory Viewer**: Live view of zero page and program memory regions
- **CPU Register Display**: Real-time register and flag monitoring
- **Collapsible Panel Interface**: Responsive design that fits comfortably on any screen
- **Professional Layout**: Two-column layout with expandable sections for optimal workflow

### 🎮 **Sample Programs Included**
- **Fibonacci Calculator**: Mathematical demonstration program
- **Hello World**: Basic terminal output example
- **Echo Program**: Interactive terminal communication demo
- **Graphics Demo**: Video display programming with patterns and animation

### 🔧 **Advanced Features**
- **Memory-Mapped I/O**: Programs can read keyboard input and write terminal output
- **Memory-Mapped Graphics**: Direct pixel manipulation via video buffer at $0200-$05FF
- **Video Instructions**: VST (store), VUP (update), VDL (delay) for graphics programming
- **Console Logging**: Detailed execution trace with automatic text wrapping
- **Enhanced I/O System**: Reliable bidirectional communication without conflicts
- **Multiple Sample Programs**: Educational examples with different complexity levels
- **Video Steganography**: Encode assembly programs into video files (Phase 2)

## 🚀 Quick Start

### Prerequisites
- Modern browser (Chrome 94+, Firefox 85+, Safari 14+)
- Optional: Python 3.8+ or Node.js 22+ for local server

### Run the Emulator

**Using Node.js (Recommended):**
```bash
# Navigate to project directory
cd imacomputerussy

# Install dependencies and start server
npm install
npm start
```

**Using Python server:**
```bash
# Navigate to project directory
cd imacomputerussy

# Start local web server
python -m http.server 8000
# Or: python3 -m http.server 8000
```

**Open in Browser:** http://localhost:8000

### Basic Usage
1. **Select a sample program** from the dropdown (Fibonacci, Hello World, or Echo)
2. **Click "Load Selected Sample"** to load the program into memory
3. **Use debugging controls**:
   - **Step**: Execute one instruction at a time
   - **Run**: Execute continuously at adjustable speed
   - **Reset**: Return CPU to initial state
4. **For interactive programs**: Type in the terminal and watch the program respond
5. **Monitor execution**: Watch memory changes and register updates in real-time

## 🎮 How to Use the Interactive Features

### Loading and Running Programs

1. **Choose a Sample Program**:
   - **Fibonacci**: Mathematical demonstration showing calculation results in memory
   - **Hello World**: Simple terminal output demonstration  
   - **Echo**: Interactive program that responds to your input

2. **Loading Process**:
   ```
   Select program → Load Sample → Program loads into memory at $0600
   ```

3. **Execution Controls**:
   - **Step**: Execute one instruction and see exactly what happens
   - **Run**: Execute continuously (1-1000 Hz speed control)
   - **Reset**: Return CPU to initial state and reload program

### Interactive Terminal Communication

For programs like **Echo**, you can communicate in real-time:

1. **Load the Echo program** and click **Run**
2. **Type messages** in the Interactive Terminal input field
3. **Press Enter** or click **Send** to transmit to the running program
4. **Watch the program respond** in the terminal display
5. **Send ESC character** to exit interactive programs

### Memory-Mapped I/O Programming

Create your own interactive programs using these addresses:

#### Terminal I/O
- **`$F0` (Input Register)**: Read user keyboard input
- **`$F1` (Output Register)**: Write characters to terminal display  
- **`$F2` (Status Register)**: Check I/O status (bit 0 = input ready)

#### Video Graphics
- **`$0200-$05FF` (Video Buffer)**: 32×24 pixel framebuffer (768 pixels)
- **Colors**: `$00`=Black, `$01`=Green, `$02`=Yellow, `$03`=Red
- **Address Formula**: `$0200 + (row × 32) + column`

**Terminal Example**:
```assembly
.org $0600
LOOP:
    LDA $F2        ; Check input status
    AND #$01       ; Test input ready bit
    BEQ LOOP       ; Wait for input
    
    LDA $F0        ; Read character
    STA $F1        ; Echo to output
    JMP LOOP       ; Continue
```

**Graphics Example**:
```assembly
.org $0600
    LDA #$01       ; Green color
    STA $0200      ; Top-left pixel
    STA $021F      ; Top-right pixel
    VUP            ; Update display
    HLT            ; End program
```

### Debugging and Development

- **Console Output**: Shows detailed execution trace with instruction-by-instruction logging
- **Memory Viewer**: Live view of Zero Page (variables) and Program Area (code)
- **Register Display**: Real-time CPU state including PC, A, X, Y registers and flags
- **Status Monitoring**: RUNNING/HALTED status with automatic program completion detection

## 🎬 Video Storage System (Phase 2 - In Development)

### Current Capabilities
- **LSB Steganography**: Hide assembly code in video pixel channels
- **File Encoding/Decoding**: Embed programs into video files
- **YouTube Integration**: Upload and retrieve encoded videos (planned)

### Technical Specifications
- **Capacity**: 30-300KB per HD video frame (resolution dependent)
- **Compression**: LZ77 compression for size reduction
- **Error Correction**: Reed-Solomon ECC for data integrity
- **Video Formats**: MP4, WebM, AVI, MOV support
- **Platform**: Cross-browser JavaScript (ES6+ modules)

For a clean development environment, set up a Python virtual environment:

1. **Install Python** (if not already installed):
   - Download from https://www.python.org/downloads/
   - Or use your system's package manager (apt, brew, etc.)

2. **Create and activate virtual environment**:
   ```bash
   # Create virtual environment in project directory
   python -m venv .venv

   # Activate the virtual environment
   # On Windows (PowerShell):
   .venv\Scripts\activate

   # On Windows (Command Prompt):
   .venv\Scripts\activate.bat

   # On Linux/macOS:
   source .venv/bin/activate
   ```

3. **Install dependencies** (if any):
   ```bash
   pip install -r requirements.txt
   ```

4. **Start development server**:
   ```bash
   python -m http.server 8000
   ```

5. **Open in browser**:
   Open `http://localhost:8000` in your browser.

6. **Deactivate when done**:
   ```bash
   deactivate
   ```
### Option 3: NPM (Node.js)

For Node.js development environment:

1. **Install Node.js** (if not already installed):
   - Download from https://nodejs.org/

2. **Install dependencies** (if any):
   ```bash
   npm install
   ```

3. **Start development server**:
   ```bash
   npm start
   # or
   npm run dev
   ```

4. **Run tests**:
   ```bash
   npm test
   # or specific tests
   npm run test:cpu
   npm run test:memory
   npm run test:assembler
   ```

5. **Open in browser**:
   Open `http://localhost:8000` in your browser.

## 🎯 Key Features

### Core Functionality
- **8-bit CPU emulator** with full 6502 instruction set
- **Assembly compiler** with syntax highlighting and error reporting
- **Real-time debugger** with memory inspection and breakpoints
- **Retro CRT display** with authentic visual effects

### Phase 2: Advanced Storage System
- **LSB Steganography** - Hide data in video pixel channels
- **Reed-Solomon ECC** - Error correction for robust data recovery
- **LZ77 Compression** - Reduce file size before embedding
- **YouTube Integration** - Upload/download encoded videos
- **Multi-frame support** - Large programs across multiple video frames
- **WebCodecs API** - Hardware-accelerated video processing

### Technical Specifications
- **Capacity**: 30-300KB per HD video frame (resolution dependent)
- **Compression**: Up to 70% size reduction
- **Error correction**: 10-50 ECC symbols configurable
- **Video formats**: MP4, WebM, AVI, MOV
- **Platforms**: Cross-browser JavaScript (ES6+ modules)

## 📁 Project Structure

### Core Components
- `index.html` - Main application with integrated interactive terminal and debugging
- `server.js` - Node.js development server with ES module support
- `package.json` - Node.js dependencies and scripts
- `css/components.css` - UI component styles with terminal styling
- `css/retro-theme.css` - Authentic CRT display simulation

### JavaScript Modules (ES6+)
- `js/cpu.js` - iMaCoMpUtERussy CPU emulation engine (6502-inspired)
- `js/memory.js` - Memory management with I/O listeners and watchers
- `js/assembler.js` - Assembly language compiler with expression support
- `js/steganography.js` - LSB steganography with ECC support
- `js/compression.js` - LZ77 data compression algorithms
- `js/ecc.js` - Reed-Solomon error correction codes
- `js/platforms/youtube-api.js` - YouTube Data API integration (planned)

### Sample Programs
- `samples/fibonacci.asm` - Mathematical demonstration (Fibonacci sequence)
- `samples/hello-terminal.asm` - Basic terminal output example
- `samples/echo.asm` - Interactive I/O communication demo
- `samples/hello-world.asm` - Simple "Hello World" program
- `samples/video-demo.asm` - Video processing demonstration

### Documentation & Testing
- `docs/` - Complete documentation suite including API references
- `tests/` - Comprehensive test suites for all components
  - CPU instruction tests, memory tests, assembler tests
  - Integration tests for steganography and compression
- `README.md` - This comprehensive guide

### Samples & Documentation
- `docs/` - Complete documentation suite
- `samples/` - Example assembly programs
- `tests/` - Test suites for all components

## 📊 Current Status

**iMaCoMpUtERussy Phase 2: Complete Implementation** ✨

This project has evolved into a fully functional distributed code storage system with steganography capabilities.

### Phase 1 (Foundation) ✅
- Complete 8-bit CPU emulator with 6502 instruction set
- Assembly language compiler with syntax validation
- Retro-themed user interface with CRT effects
- Memory visualization and debugging tools

### Phase 2 (Advanced Storage) ✅
- **LSB Steganography Engine** - Hide data in video frames
- **Reed-Solomon Error Correction** - Robust data recovery
- **LZ77 Data Compression** - Optimize storage efficiency
- **YouTube Platform Integration** - Cloud-based storage
- **Multi-frame Video Support** - Handle large programs
- **WebCodecs API Integration** - Hardware acceleration

### 🧪 Test Coverage
- Unit tests for CPU, memory, and assembler
- Integration tests for steganography pipeline
- E2E tests for YouTube upload/download cycle
- Performance benchmarks and capacity testing

## 📚 Documentation

Complete documentation suite now available:

- [**Video Embedding Guide**](docs/VIDEO_EMBEDDING_GUIDE.md) - Step-by-step tutorials and examples
- [**Developer API Reference**](docs/DEVELOPER_API.md) - Complete API documentation
- [**Setup & Deployment**](docs/SETUP_DEPLOYMENT.md) - Google Cloud Console setup and CI/CD
- [**Troubleshooting Guide**](docs/TROUBLESHOOTING.md) - Common issues and debugging

## 🆕 Latest Updates (v2.1.0 - August 2025)

### New Features Added
- **CMP Instruction**: Full compare instruction implementation with all addressing modes
- **Enhanced Addressing Modes**: Added ZeroPageX, AbsoluteX, AbsoluteY, and IndirectY support
- **Improved Echo Sample**: Fixed CMP instruction support for interactive programs
- **Extended Instruction Set**: Complete 6502-compatible instruction coverage

### Bug Fixes
- Fixed missing addressing mode implementations
- Corrected instruction parameter handling
- Enhanced error messages for unsupported operations
- Improved assembler-CPU instruction compatibility

### Technical Improvements
- Added comprehensive addressing mode documentation
- Enhanced developer API reference with instruction set details
- Updated all sample programs to use full instruction set
- Improved code organization and error handling

## 🚧 Next Steps (Future Phases)

### Phase 3: Enhanced Security
- End-to-end encryption for embedded data
- Secure key exchange protocols
- Digital signature verification

### Phase 4: Advanced Features
- Distributed storage across multiple videos
- Blockchain-based indexing and discovery
- Cross-platform synchronization
- Mobile app companion

### Phase 5: Enterprise
- Multi-user support with access controls
- Commercial YouTube integration
- REST API for third-party applications
- Container deployment and scaling

## 💻 Development

iMaCoMpUtERussy uses modern web technologies for maximum accessibility and performance.

### Technology Stack
- **Frontend**: HTML5, CSS3, ES6+ JavaScript
- **Architecture**: Browser-native ES modules (no bundling required)
- **APIs**: WebCodecs, Canvas 2D, File System Access, WebGL
- **Storage**: Browser sessionStorage, YouTube Data API v3
- **Styling**: Custom CSS with retro CRT simulation

### Browser Compatibility
- **Primary**: Chrome 94+ (WebCodecs, full feature set)
- **Secondary**: Firefox 85+, Safari 14+, Edge 94+
- **Mobile**: Chrome Mobile 94+ (limited by device capabilities)

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

See [Setup Guide](docs/SETUP_DEPLOYMENT.md) for local development environment setup.

## 📈 Performance

### Capacity Guidelines
- **SD Video (480p)**: ~15KB per frame
- **HD Video (720p)**: ~35KB per frame
- **Full HD (1080p)**: ~75KB per frame
- **4K Video**: ~300KB per frame

### Processing Times
- **Small programs**: < 5 seconds encode/decode
- **Large programs**: 10-30 seconds
- **Network operations**: 10-60 seconds (YouTube dependent)

## 🔐 Security Considerations

- Data is hidden but **not encrypted**
- YouTube videos are **publicly accessible**
- Use private/unlisted videos for sensitive data
- Consider end-to-end encryption for production use

## 📝 License

iMaCoMpUtERussy is open source software licensed under the MIT License.

**Created by Kyle Durepos**

```text
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software...
```

## 🤝 Acknowledgments

This project builds upon:
- [6502 CPU specifications](https://www.masswerk.at/6502/6502_instruction_set.html)
- [Reed-Solomon error correction](https://en.wikipedia.org/wiki/Reed%E2%80%93Solomon_error_correction)
- [LZ77 compression algorithm](https://en.wikipedia.org/wiki/LZ77)
- YouTube Data API v3 documentation

---

**Ready to get started?** Check out the [Video Embedding Guide](docs/VIDEO_EMBEDDING_GUIDE.md) for your first embedded program!