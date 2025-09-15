# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Common Development Commands

### Core Development Workflow
- `npm run autonomous-system-start` - Start complete system (MCP server, queue server, autonomous agent)
- `npm start` - Start main UI server only
- `npm run dev` - Start development server
- `npm run dev:full` - Start full development stack with proxy and all servers
- `npm run mcp-server` - Start MCP server on port 8001
- `npm run queue-server` - Start queue server on port 8002
- `npm run autonomous-agent` - Start AI agent for processing queued tasks

### Testing
- `npm test` - Run all Jest tests
- `npm run test:cpu` - Run CPU emulator tests only
- `npm run test:memory` - Run memory management tests
- `npm run test:assembler` - Run assembler tests
- `npm run test:integration` - Run integration tests
- `npm run integration-tests` - Run integration tests from integration/ directory
- `npm run test:all` - Run both Jest and custom tests

### Debugging & Development
- `npm run samples` - List available sample programs
- `npm run setup` - Install all dependencies
- `npm run build` - Build/setup project

### Individual Component Testing
To run a single test: `npx jest tests/cpu.test.js`
To debug specific components: Check logs in `logs/mcp-server.log` and `logs/mcp-server-error.log`

## Architecture Overview

This is an **autonomous coding agent system** built around a retro 8-bit CPU emulator with AI integration. The system generates, tests, and optimizes assembly programs through natural language input.

### Core System Components

#### 1. MCP Server (Model Context Protocol) - Port 8001
- **File**: `server/mcp_server.js`
- **Purpose**: RESTful API bridge between AI agents and the CPU emulator
- **Key endpoints**: CPU control, memory management, assembly operations, program management
- **JSON Schema validation** with comprehensive error handling

#### 2. Autonomous Agent System
- **File**: `agent/autonomous-agent.js`
- **Purpose**: AI-powered task processor that converts natural language to working assembly code
- **Capabilities**: Multi-pipeline workflows (generation → testing → optimization → debugging)
- **Queue management**: Continuous 24/7 processing with priority levels

#### 3. 6502-Compatible CPU Emulator
- **File**: `js/cpu.js` (class: `iMaCoMpUtERussyCPU`)
- **Custom extensions**: Video operations (VLD/VST/VUP/VDL), enhanced I/O, async execution
- **Memory map**: 64KB with defined regions (Zero Page, Stack, Video Buffer, User RAM, ROM)
- **Debugging**: Real-time breakpoints, step execution, register inspection

#### 4. Interactive Web UI
- **Files**: `js/ui/` directory with modular panels
- **Layout**: Draggable, resizable panels with persistent layouts
- **Components**: Assembly editor, debugger, memory viewer, terminal I/O, video display
- **Real-time updates** via WebSocket and MCP events

### Key Architectural Patterns

#### Error Handling
- **MCPError system** with structured error codes and retry logic
- **Circuit breaker pattern** for service resilience
- All errors wrapped with `ErrorHandler.standardizeError()` before throwing

#### Memory Architecture
- **Zero Page (0x0000-0x00FF)**: I/O registers at $F0-$F2 for terminal communication
- **Video Buffer (0x0200-0x05FF)**: 1KB framebuffer for 32×24 pixel graphics
- **User RAM (0x0600-0x7FFF)**: Program execution space (default PC start)
- **ROM regions (0x8000+)**: Protected areas for system routines

#### Code Generation Pipeline
```
Natural Language → AI Model → Assembly Code → Assembler → Machine Code → CPU Execution → Testing → Optimization
```

#### Naming Conventions
- **Classes**: PascalCase with `iMaCoMpUtERussy*` prefix
- **Memory constants**: UPPER_SNAKE_CASE (MEMORY_MAP, FLAGS)
- **Import validation**: Always use `typeof window` checks for browser globals
- **Custom video instructions**: VLD (0x8B), VST (0x9B), VUP (0xAB), VDL (0xBB), HLT (0x3A)

## Development Guidelines

### When Working with CPU/Memory Code
- Memory addresses are validated using `validateMemoryAddress()` from `lib/validators.js`
- Use memory map constants from `js/cpu.js` (MEMORY_MAP.ZERO_PAGE, etc.)
- All memory writes trigger UI updates via event listeners
- Breakpoints are stored in global `window.breakpoints` Set

### When Working with MCP Integration
- All API endpoints use JSON Schema validation with AJV
- Rate limiting applies: 10 intense operations per 15 min, 25 moderate per 5 min
- Use circuit breaker pattern for external service calls
- Errors must be MCPError instances with proper error codes

### When Working with UI Components
- Panels are managed by `LayoutManager` in `js/ui/layout-manager.js`
- Each panel requires initialization function and registration in layout manager
- Use `window.showPanel(id)` / `window.hidePanel(id)` for panel control
- All settings persist via localStorage

### When Working with Assembly Programs
- Assembler supports full 6502 instruction set plus custom video operations
- Two-pass assembly with label resolution and expression evaluation
- Programs typically start at $0600 (USER_RAM)
- Use `.org` directive to specify origin address

### When Working with the Autonomous Agent
- Tasks are classified automatically (generation, testing, debugging, optimization)
- Learning system tracks success/failure patterns for improvement
- Concurrent processing limited by `maxConcurrentTasks` setting
- Queue persistence with atomic operations and backups

## Integration Points

### Adding New MCP Endpoints
1. Define JSON schema in `docs/mcp_schemas/`
2. Implement handler in `server/mcp_server.js` with validation
3. Add client method in `js/mcp-client.js`
4. Update API documentation

### Adding New UI Panels
1. Create initialization function in `js/ui/new-panel.js`
2. Add HTML structure to `index.html`
3. Register in LayoutManager panel list
4. Add sidebar toggle control

### Adding New CPU Instructions
1. Add opcode handler in `cpu.js` `getInstructionHandlers()` method
2. Update assembler opcode table in `assembler.js`
3. Add test cases in `tests/cpu*.test.js`
4. Document instruction in `docs/INSTRUCTION_SET.md`

## Critical Files and Dependencies

### Core Runtime Files
- `server/mcp_server.js` - Main MCP server with all REST endpoints
- `agent/autonomous-agent.js` - AI task processing engine
- `js/cpu.js` - CPU emulator with custom instruction set
- `js/memory.js` - Memory management with I/O mapping
- `js/assembler.js` - Assembly language compiler

### Configuration and Data
- `package.json` - All npm scripts and dependencies
- `logs/` - Runtime logs (mcp-server.log, mcp-server-error.log)
- `data/` - Persistent data, learning models, program storage
- `docs/mcp_schemas/` - JSON Schema definitions for API validation

### Testing Infrastructure
- `tests/` - Jest unit tests for all components
- `integration/` - End-to-end integration tests
- `samples/` - Example assembly programs for testing

This is a production-ready autonomous coding system that combines retro computing concepts with modern AI capabilities. The architecture is designed for extensibility, reliability, and educational value in assembly programming and AI-assisted development.
