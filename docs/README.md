# iMaCoMpUtERussy Documentation Index

Welcome to the iMaCoMpUtERussy documentation! This interactive 8-bit emulator provides a complete development environment for assembly programming with modern debugging tools.

## 📖 Documentation Overview

### 🚀 Getting Started
- **[Quick Start Guide](./QUICK_START.md)** - Get running in 5 minutes
  - Installation options (Node.js and Python)
  - First program execution
  - Interface walkthrough
  - Basic programming examples

### 🛠️ Development References
- **[Instruction Set Reference](./INSTRUCTION_SET.md)** - Complete CPU instruction guide
  - All available instructions with examples
  - Addressing modes and opcodes
  - Programming patterns and best practices
  - CMP instruction and comparison operations

- **[Interactive Terminal API](./INTERACTIVE_TERMINAL_API.md)** - Complete I/O programming guide
  - Memory-mapped I/O system ($F0-$F2)
  - Programming examples and best practices
  - Character handling and control codes
  - Debugging tips and common issues

- **[Developer API Reference](./DEVELOPER_API.md)** - Full system API
  - CPU emulation API (iMaCoMpUtERussyCPU)
  - Memory system API (iMaCoMpUtERussyMemory)
  - Assembly compiler API (assemble)
  - Steganography engine API (Phase 2)

### 📊 Project Information
- **[Development Progress](./DEVELOPMENT_PROGRESS.md)** - Current status and roadmap
  - Completed features and milestones
  - Current development phase status
  - Testing results and statistics
  - Next development priorities

- **[Phase 2 Next Steps](./PHASE2_NEXT_STEPS.md)** - Upcoming features
  - Video steganography completion
  - YouTube integration roadmap
  - Advanced I/O system plans

### 🎮 Interactive Features
- **[Setup and Deployment](./SETUP_DEPLOYMENT.md)** - Production deployment guide
- **[Video Embedding Guide](./VIDEO_EMBEDDING_GUIDE.md)** - Steganography usage
- **[Troubleshooting](./TROUBLESHOOTING.md)** - Common issues and solutions

## 🎯 Choose Your Path

### 👨‍🎓 New to the Project?
Start with the **[Quick Start Guide](./QUICK_START.md)** to get the emulator running and try your first program.

### 🔧 Want to Program Assembly?
Check out the **[Interactive Terminal API](./INTERACTIVE_TERMINAL_API.md)** for complete programming examples and the I/O system reference.

### 👨‍💻 Developer Integration?
See the **[Developer API Reference](./DEVELOPER_API.md)** for JavaScript API documentation and system architecture.

### 📈 Project Status?
Visit **[Development Progress](./DEVELOPMENT_PROGRESS.md)** to see what's implemented and what's coming next.

## 🔍 Key Features Documentation

### Interactive Development Environment
- **Real-time Assembly Loading**: Load `.asm` files directly into memory
- **Step-by-Step Debugging**: Execute instructions with full state visibility  
- **Interactive Terminal**: Bidirectional I/O with running programs
- **Memory Viewer**: Live visualization of zero page and program areas
- **Console Logging**: Detailed execution traces and debugging info

### Educational Sample Programs
- **Fibonacci Calculator**: Mathematical operations demonstration
- **Hello World Terminal**: Basic output programming example
- **Echo Program**: Interactive input/output communication
- **Custom Program Support**: Load your own assembly files

### Advanced Features
- **Memory-Mapped I/O**: Programs interact through memory addresses
- **CPU Status Monitoring**: RUNNING/HALTED with automatic detection
- **Speed Control**: Adjustable execution from 1-1000 Hz
- **Comprehensive Testing**: Full test suite with 90+ tests

## 📋 Quick Reference

### Memory Map
| Address Range | Purpose |
|---------------|---------|
| $0000-$00FF | Zero Page (variables, I/O) |
| $0100-$01FF | Stack |
| $0200-$05FF | Video Buffer |
| $0600-$7FFF | User RAM (programs) |
| $8000-$BFFF | Video ROM |
| $C000-$FFFF | System ROM |

### I/O Registers
| Address | Name | Purpose |
|---------|------|---------|
| $F0 | INPUT_REG | Read keyboard input |
| $F1 | OUTPUT_REG | Write to terminal |
| $F2 | STATUS_REG | I/O status flags |

### Sample Programs
| File | Description | Features |
|------|-------------|----------|
| `fibonacci.asm` | Math demo | Memory usage, calculations |
| `hello-terminal.asm` | Output demo | Terminal output |
| `echo.asm` | Interactive demo | Input/output, user interaction |

## 🔗 External Resources

- **Project Repository**: Source code and issues
- **Live Demo**: Try the emulator online
- **Community**: Discussion and user programs
- **Contributing**: How to contribute to the project

## 📞 Support

If you need help:

1. **Check [Troubleshooting](./TROUBLESHOOTING.md)** for common issues
2. **Review [Quick Start](./QUICK_START.md)** for basic setup
3. **Examine sample programs** in the `samples/` directory
4. **Run tests** with `npm test` to verify installation
5. **Check console output** for detailed error messages

Happy coding with iMaCoMpUtERussy! 🎮
