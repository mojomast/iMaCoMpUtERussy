/**
 * MCP Developer API Adapter
 *
 * Maps iMaCoMpUtERussy's existing APIs to the MCP server interface.
 * This adapter provides a clean separation between the emulator internals
 * and the HTTP API layer.
 */

import { iMaCoMpUtERussyCPU } from '../js/cpu.js';
import { iMaCoMpUtERussyMemory } from '../js/memory.js';
import { assemble } from '../js/assembler.js';
import * as fs from 'fs';
import * as path from 'path';
import { MCPError } from './mcp_errors.js';

// Video display and terminal I/O interfaces (minimal stubs for now)
class VideoDisplay {
  updateDisplay() {
    // TODO: Actually update display when renderer is available
    console.log('Video display update requested');
  }
}

class TerminalHandler {
  constructor(memory) {
    this.memory = memory;
    this.buffer = [];
  }

  writeChars(bytes) {
    // TODO: Implement proper terminal write with memory mapping
    // Memory-mapped I/O at $F1 (OUTPUT_REG)
    if (!this.memory) {
      console.warn('Terminal writeChars - no memory instance available');
      return { bytesWritten: 0 };
    }

    try {
      let bytesWritten = 0;
      // For now, just write the first byte to OUTPUT_REG
      // In a real implementation, this would handle multiple bytes
      if (bytes.length > 0) {
        this.memory.writeByte(0xF1, bytes[0]);
        bytesWritten = 1;
      }

      console.log(`Terminal wrote ${bytesWritten} bytes`);
      return { bytesWritten };
    } catch (error) {
      console.error('Terminal writeChars error:', error.message);
      throw new MCPError('TERMINAL_BUSY', `Terminal write failed: ${error.message}`, { originalError: error.message });
    }
  }

  writeChar(char) {
    // Memory-mapped I/O at $F1
    if (!this.memory) {
      console.warn('Terminal write not yet implemented - requires global memory instance');
      return { bytesWritten: 0 };
    }

    try {
      // Write character code to OUTPUT_REG (0xF1)
      this.memory.writeByte(0xF1, typeof char === 'string' ? char.charCodeAt(0) : char);
      return { bytesWritten: 1 };
    } catch (error) {
      console.error('Terminal writeChar error:', error.message);
      throw error;
    }
  }

  readChars(maxBytes = 256) {
    // TODO: Implement proper terminal read with memory mapping
    // Memory-mapped I/O at $F0 (INPUT_REG)
    if (!this.memory) {
      console.warn('Terminal readChars - no memory instance available');
      return { bytes: [], bytesRead: 0 };
    }

    try {
      // Read from INPUT_REG
      const byte = this.memory.readByte(0xF0);
      const bytes = byte ? [byte] : [];

      return {
        bytes,
        bytesRead: bytes.length,
        text: bytes.length > 0 ? String.fromCharCode(bytes[0]) : ''
      };
    } catch (error) {
      console.error('Terminal readChars error:', error.message);
      return { bytes: [], bytesRead: 0 };
    }
  }

  readChar() {
    // Memory-mapped I/O at $F0
    if (!this.memory) {
      console.warn('Terminal read not yet implemented - requires global memory instance');
      return { hasInput: false, input: '' };
    }

    try {
      // Read from INPUT_REG
      const byte = this.memory.readByte(0xF0);
      if (byte) {
        return {
          hasInput: true,
          input: String.fromCharCode(byte),
          bytesRead: 1
        };
      }
      return {
        hasInput: false,
        input: '',
        bytesRead: 0
      };
    } catch (error) {
      console.error('Terminal readChar error:', error.message);
      return { hasInput: false, input: '' };
    }
  }

  clear() {
    // Clear terminal buffers
    if (!this.memory) {
      console.warn('Terminal clear - no memory instance available');
      return { cleared: false };
    }

    try {
      // Clear INPUT_REG and STATUS_REG
      this.memory.writeByte(0xF0, 0); // Clear input
      this.memory.writeByte(0xF2, 0); // Clear status
      this.buffer = []; // Clear any internal buffer
      return { cleared: true, bufferSize: 0 };
    } catch (error) {
      console.error('Terminal clear error:', error.message);
      return { cleared: false };
    }
  }
}

// Sample program loader
class ProgramManager {
  constructor() {
    this.samplesDir = path.join(process.cwd(), 'samples');
  }

  listSamples() {
    try {
      const files = fs.readdirSync(this.samplesDir)
        .filter(f => f.endsWith('.asm'))
        .map(filename => {
          const name = filename.replace('.asm', '');
          const filePath = path.join(this.samplesDir, filename);

          // Read first few lines for description heuristic
          let description = `Assembly program: ${filename}`;
          let size = 0;

          try {
            const stat = fs.statSync(filePath);
            size = stat.size;

            // Try to extract description from comments
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n').slice(0, 10); // First 10 lines
            for (const line of lines) {
              const comment = line.match(/^\s*[;*]\s*(.+)$/);
              if (comment && comment[1].trim().length > 5) {
                description = comment[1].trim();
                break;
              }
            }
          } catch (error) {
            console.warn(`Could not read sample file ${filename}:`, error.message);
          }

          return { name, description, size, path: filename };
        });

      return files;
    } catch (error) {
      console.error('Error listing samples:', error);
      return [];
    }
  }

  async loadSample(sampleName) {
    const filePath = path.join(this.samplesDir, `${sampleName}.asm`);
    if (!fs.existsSync(filePath)) {
      throw new MCPError('PROGRAM_NOT_FOUND', `Sample program '${sampleName}' not found`);
    }

    const source = fs.readFileSync(filePath, 'utf-8');
    const bytecode = assemble(source);

    return {
      sampleName,
      programSize: bytecode.length,
      loadAddress: 0x0600, // Default USER RAM start
      source,
      bytecode: Array.from(bytecode)
    };
  }

  // New method: Save program to samples directory
  async saveProgram(name, source, overwrite = false) {
    // Sanitize filename to prevent directory traversal
    const safeName = name.replace(/[^a-zA-Z0-9_\-]/g, '');
    if (!safeName || safeName !== name) {
      throw new Error('Invalid program name - use only alphanumeric characters, hyphens, and underscores');
    }

    const filename = `${safeName}.asm`;
    const filePath = path.join(this.samplesDir, filename);

    // Check if file exists and overwrite is not allowed
    if (fs.existsSync(filePath) && !overwrite) {
      throw new MCPError('PROGRAM_EXISTS', `Program '${safeName}' already exists. Use overwrite=true to replace it.`);
    }

    // Limit source size
    if (source.length > 64000) {
      throw new Error('Program source exceeds 64KB limit');
    }

    // Write the file
    fs.writeFileSync(filePath, source, 'utf8');

    return {
      name: safeName,
      path: filename,
      bytesWritten: Buffer.byteLength(source, 'utf8'),
      savedAt: new Date().toISOString()
    };
  }

  // New method: Load program from samples directory by name and assemble/load to memory
  async loadProgramByName(programName, startAddress = 0x0600) {
    const filePath = path.join(this.samplesDir, `${programName}.asm`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`PROGRAM_NOT_FOUND: Program '${programName}' not found`);
    }

    // Validate memory address
    if (isNaN(startAddress) || startAddress < 0 || startAddress > 0xFFFF) {
      throw new MCPError('MEMORY_OUT_OF_RANGE', 'Invalid start address');
    }

    try {
      const source = fs.readFileSync(filePath, 'utf8');
      console.log(`Loading program ${programName} from ${filePath}`);

      // Assemble the program
      const bytecode = assemble(source);

      // Validate program fits in memory
      const programSize = bytecode.length;
      if (startAddress + programSize - 1 > 0xFFFF) {
        throw new MCPError('MEMORY_OUT_OF_RANGE', 'Program would exceed memory bounds');
      }

      return {
        name: programName,
        loadAddress: startAddress,
        byteCount: bytecode.length,
        source: source,
        bytecode: Array.from(bytecode)
      };
    } catch (error) {
      if (error.message.includes('assemble') || error.message.includes('syntax')) {
        throw new Error(`INVALID_ASSEMBLY: ${error.message}`);
      }
      throw error;
    }
  }
}

/**
 * MCP Developer Adapter
 *
 * Provides the expected API interface for the MCP server.
 * Manages shared instances of emulator components.
 */
export class MCPDeveloperAdapter {
  constructor() {
    this.memory = null;
    this.cpu = null;
    this.videoDisplay = new VideoDisplay();
    this.terminalHandler = null; // Will be initialized with memory
    this.programManager = new ProgramManager();

    this.initializeEmulator();
  }

  initializeEmulator() {
    // Create shared memory instance
    this.memory = new iMaCoMpUtERussyMemory();

    // Initialize terminal handler with memory instance
    this.terminalHandler = new TerminalHandler(this.memory);

    // Create CPU instance with memory
    this.cpu = new iMaCoMpUtERussyCPU({ memory: this.memory });

    console.log('Emulator initialized for MCP');
  }

  // CPU Adapter
  createCPUAdapter() {
    return {
      reset: (hardReset = false) => {
        this.cpu.reset();
        return {
          pc: this.cpu.PC,
          a: this.cpu.A,
          x: this.cpu.X,
          y: this.cpu.Y,
          running: this.cpu.running,
          flags: {
            carry: this.cpu.getFlag('C'),
            zero: this.cpu.getFlag('Z'),
            interrupt: this.cpu.getFlag('I'),
            decimal: this.cpu.getFlag('D'),
            overflow: this.cpu.getFlag('V'),
            negative: this.cpu.getFlag('N')
          }
        };
      },

      step: (timeout = 1000) => {
        const cycles = this.cpu.step();

        // Get instruction info from disassembled code
        const instruction = this.getInstructionAt(this.cpu.PC);

        return {
          pc: this.cpu.PC,
          instruction,
          cycles,
          halted: !this.cpu.running,
          cpuState: {
            a: this.cpu.A,
            x: this.cpu.X,
            y: this.cpu.Y,
            flags: {
              zero: this.cpu.getFlag('Z'),
              negative: this.cpu.getFlag('N')
            }
          }
        };
      },

      run: (maxSteps) => {
        const steps = this.cpu.run(maxSteps);
        return {
          stepsExecuted: steps,
          totalCycles: 2 * steps, // Rough estimate
          halted: !this.cpu.running,
          finalState: {
            pc: this.cpu.PC,
            a: this.cpu.A,
            x: this.cpu.X,
            y: this.cpu.Y
          },
          executionTrace: [] // TODO: Implement tracing
        };
      },

      getState: () => {
        return {
          pc: this.cpu.PC,
          a: this.cpu.A,
          x: this.cpu.X,
          y: this.cpu.Y,
          running: this.cpu.running,
          flags: {
            carry: this.cpu.getFlag('C'),
            zero: this.cpu.getFlag('Z'),
            interrupt: this.cpu.getFlag('I'),
            decimal: this.cpu.getFlag('D'),
            overflow: this.cpu.getFlag('V'),
            negative: this.cpu.getFlag('N')
          }
        };
      }
    };
  }

  // Memory Adapter
  createMemoryAdapter() {
    return {
      read: (address, bytes = 1) => {
        const value = bytes === 2 ? this.memory.readWord(address) : this.memory.readByte(address);
        return {
          address,
          bytes,
          value,
          hexValue: bytes === 2 ? value.toString(16).padStart(4, '0') : value.toString(16).padStart(2, '0')
        };
      },

      write: (address, value, bytes = 1) => {
        const previous = bytes === 2 ? this.memory.readWord(address) : this.memory.readByte(address);

        if (bytes === 2) {
          this.memory.writeWord(address, value);
        } else {
          this.memory.writeByte(address, value);
        }

        return { address, bytes, value, previous };
      },

      loadProgram: (startAddress, bytecode) => {
        const bytesLoaded = this.memory.loadProgram(startAddress, bytecode);
        return {
          startAddress,
          bytesLoaded,
          endAddress: startAddress + bytesLoaded - 1,
          programSize: bytecode.length
        };
      }
    };
  }

  // Assemble Adapter
  createAssemblerAdapter() {
    return {
      assemble: (source, options = {}) => {
        const bytecode = assemble(source, options);

        return {
          bytecode: Array.from(bytecode),
          hexBytes: Array.from(bytecode).map(b => b.toString(16).padStart(2, '0')),
          instructionCount: 0, // TODO: Calculate from bytecode
          sizeBytes: bytecode.length,
          program: [] // TODO: Generate detailed program info
        };
      },

      loadAndRun: (source, options = {}) => {
        const assembler = this.createAssemblerAdapter();
        const compiled = assembler.assemble(source);

        const resetCPU = options.resetCPU !== false;
        if (resetCPU) {
          this.cpu.reset();
        }

        this.memory.loadProgram(options.orgAddress || 0x0600, compiled.bytecode);

        const maxSteps = options.maxSteps || 1000;
        const cpuAdapter = this.createCPUAdapter();
        const runResult = cpuAdapter.run(maxSteps);

        return {
          programSize: compiled.bytecode.length,
          stepsExecuted: runResult.stepsExecuted,
          finalState: runResult.finalState
        };
      }
    };
  }

  // Terminal Adapter
  createTerminalAdapter() {
    return {
      // Legacy method for backward compatibility
      write: (text, addNewline = true) => {
        let fullText = text;
        if (addNewline) {
          fullText += '\n';
        }

        const bytes = Buffer.from(fullText, 'utf8');
        return this.terminalHandler.writeChars(bytes);
      },

      // New methods required by server implementation
      writeChars: (bytes) => {
        return this.terminalHandler.writeChars(bytes);
      },

      read: (maxLength = 256, timeout = 5000) => {
        const result = this.terminalHandler.readChars(maxLength);
        return {
          input: result.text || '',
          bytesRead: result.bytesRead,
          hasInput: result.bytesRead > 0
        };
      },

      readChars: (maxBytes = 256) => {
        return this.terminalHandler.readChars(maxBytes);
      },

      clear: () => {
        return this.terminalHandler.clear();
      },

      getStatus: () => {
        const status = this.memory.readByte(0xF2);
        return {
          inputReady: (status & 0x01) !== 0,
          outputReady: true,
          bufferSize: 0,
          lastInput: '',
          lastOutput: ''
        };
      }
    };
  }

  // Video Adapter
  createVideoAdapter() {
    return {
      setPixel: (x, y, color) => {
        // Store pixel in video buffer range 0x0200-0x05FF
        const addr = 0x0200 + (y * 32) + x; // Assuming 32x32 display
        if (addr >= 0x0200 && addr <= 0x05FF) {
          this.memory.writeByte(addr, color);
          return { address: addr, value: color };
        } else {
          throw new Error('Pixel coordinates out of bounds');
        }
      },

      update: (flush = true) => {
        if (flush) {
          this.videoDisplay.updateDisplay();
        }
        return { displayUpdated: true };
      },

      clear: (color = 0) => {
        // Clear video buffer
        for (let addr = 0x0200; addr <= 0x05FF; addr++) {
          this.memory.writeByte(addr, color);
        }
        return { cleared: true, startAddr: 0x0200, endAddr: 0x05FF };
      },

      read: (startAddress = 0x0200, length = 1024) => {
        if (startAddress < 0x0200 || startAddress > 0x05FF) {
          throw new Error('Invalid video buffer address');
        }

        const bytes = [];
        const maxLength = Math.min(length, 0x05FF - startAddress + 1);

        for (let i = 0; i < maxLength; i++) {
          bytes.push(this.memory.readByte(startAddress + i));
        }

        return { startAddress, bytes, length: bytes.length };
      },

      write: (data, startAddress = 0x0200, validate = true) => {
        if (startAddress < 0x0200 || startAddress >= 0x05FF) {
          throw new Error('Invalid video buffer address');
        }

        let bytesWritten = 0;
        for (let i = 0; i < data.length; i++) {
          const addr = startAddress + i;
          if (addr > 0x05FF) break;

          this.memory.writeByte(addr, data[i]);
          bytesWritten++;
        }

        return {
          startAddress,
          bytesWritten,
          endAddress: startAddress + bytesWritten - 1,
          displayUpdated: false
        };
      }
    };
  }

  // Programs Adapter
  createProgramsAdapter() {
    return {
      listPrograms: () => {
        return this.programManager.listSamples();
      },

      list: () => {
        // Keep backward compatibility with existing code
        return this.programManager.listSamples();
      },

      saveProgram: async (name, source, overwrite = false) => {
        return await this.programManager.saveProgram(name, source, overwrite);
      },

      loadProgramFromSource: async (name, startAddress = 0x0600) => {
        const programData = await this.programManager.loadProgramByName(name, startAddress);

        // Actually load the bytecode into memory
        const bytesLoaded = this.memory.loadProgram(programData.loadAddress, programData.bytecode);

        return {
          loadAddress: programData.loadAddress,
          byteCount: bytesLoaded
        };
      },

      load: async (sampleName, assembled = true, resetCPU = true) => {
        // Keep existing load method for backward compatibility
        const programData = await this.programManager.loadSample(sampleName);

        if (assembled && programData.bytecode) {
          this.memory.loadProgram(programData.loadAddress, programData.bytecode);
        }

        if (resetCPU) {
          this.cpu.reset();
        }

        return programData;
      }
    };
  }

  // Debug Adapter - STUB IMPLEMENTATION WITH TODO COMMENTS
  createDebugAdapter() {
    // In-memory breakpoint storage
    this.breakpoints = new Map(); // Map<id, {id, address, hitCount, enabled, createdAt}>
    this.nextBreakpointId = 1;

    return {
      trace: async (steps = 100, options = {}) => {
        // TODO: Replace with proper CPU trace integration
        // This is a stub implementation that simulates tracing by stepping the CPU
        console.warn('DEBUG TRACE: Using stub implementation - replace with proper integration');

        const maxSteps = Math.min(steps || 100, 10000); // Cap at sensible default
        const trace = [];
        let stepCount = 0;

        while (stepCount < maxSteps && this.cpu.running) {
          // Check if we hit a breakpoint
          const currentPC = this.cpu.PC;
          let hitBreakpoint = false;

          for (const bp of this.breakpoints.values()) {
            if (bp.enabled && bp.address === currentPC) {
              bp.hitCount++;
              hitBreakpoint = true;
              break;
            }
          }

          if (hitBreakpoint && options.until === 'breakpoint') {
            break;
          }

          // Execute the instruction
          const cycles = this.cpu.step();

          // Create trace entry (simplified)
          const traceEntry = {
            pc: currentPC,
            opcode: this.memory.readByte(currentPC), // Approximate opcode
            operands: [], // TODO: Parse actual operands
            instruction: this.getInstructionAt(currentPC) || 'Unknown',
            registers: {
              a: this.cpu.A,
              x: this.cpu.X,
              y: this.cpu.Y
            },
            flags: {
              carry: this.cpu.getFlag('C'),
              zero: this.cpu.getFlag('Z'),
              interrupt: this.cpu.getFlag('I'),
              decimal: this.cpu.getFlag('D'),
              overflow: this.cpu.getFlag('V'),
              negative: this.cpu.getFlag('N')
            },
            cycles
          };

          trace.push(traceEntry);

          if (!this.cpu.running && options.until === 'halt') {
            break;
          }

          stepCount++;

          // Prevent infinite loops in stub
          if (stepCount > 1000) {
            console.warn('DEBUG TRACE: Emergency stop - possible infinite loop detected');
            break;
          }
        }

        return Promise.resolve({
          stepsExecuted: stepCount,
          halted: !this.cpu.running,
          haltReason: !this.cpu.running ? 'cpu_halted' :
                      stepCount >= maxSteps ? 'max_steps_reached' :
                      'breakpoint_hit',
          trace
        });
      },

      setBreakpoint: (address) => {
        // TODO: Replace with proper CPU breakpoint integration
        console.warn('DEBUG BREAKPOINT: Using stub implementation - replace with proper integration');

        if (isNaN(address) || address < 0 || address > 0xFFFF) {
          throw new Error('INVALID_BREAKPOINT: Invalid address for breakpoint');
        }

        // Check if breakpoint already exists at this address
        for (const bp of this.breakpoints.values()) {
          if (bp.address === address) {
            throw new Error('INVALID_BREAKPOINT: Breakpoint already exists at this address');
          }
        }

        const id = `bp_${this.nextBreakpointId++}`;

        this.breakpoints.set(id, {
          id,
          address,
          hitCount: 0,
          enabled: true,
          createdAt: new Date().toISOString()
        });

        return id;
      },

      listBreakpoints: () => {
        // TODO: Replace with proper CPU breakpoint integration
        console.warn('DEBUG BREAKPOINT: Using stub implementation - replace with proper integration');

        return Array.from(this.breakpoints.values());
      },

      removeBreakpoint: (idOrAddress) => {
        // TODO: Replace with proper CPU breakpoint integration
        console.warn('DEBUG BREAKPOINT: Using stub implementation - replace with proper integration');

        let removed = false;
        let removedId = null;

        // Try to interpret as address first
        const asAddress = parseInt(idOrAddress, 10);
        if (!isNaN(asAddress)) {
          for (const [id, bp] of this.breakpoints.entries()) {
            if (bp.address === asAddress) {
              this.breakpoints.delete(id);
              removed = true;
              removedId = id;
              break;
            }
          }
        } else {
          // Treat as ID
          if (this.breakpoints.has(idOrAddress)) {
            this.breakpoints.delete(idOrAddress);
            removed = true;
            removedId = idOrAddress;
          }
        }

        if (!removed) {
          throw new Error('NOT_FOUND: Breakpoint not found');
        }

        return { removed: true, id: removedId };
      }
    };
  }

  // Helper method
  getInstructionAt(address) {
    // Simple instruction decoder - in real implementation this could be more sophisticated
    try {
      const opcode = this.memory.readByte(address);
      // This is a placeholder - real implementation would need instruction decoding
      const instructions = {
        0xA9: 'LDA #$nn',
        0x8D: 'STA $nnnn',
        0x3A: 'HLT',
        0x88: 'DEY',
        0xE8: 'INX',
        0x4C: 'JMP $nnnn',
        0xF0: 'BEQ $nn'
      };
      return instructions[opcode] || `Unknown (0x${opcode.toString(16)})`;
    } catch (e) {
      return 'Invalid instruction';
    }
  }
}

// Export convenience functions
export const createDeveloperAdapters = () => {
  const adapter = new MCPDeveloperAdapter();
  return {
    cpu: adapter.createCPUAdapter(),
    memory: adapter.createMemoryAdapter(),
    assembler: adapter.createAssemblerAdapter(),
    assemble: (source) => {
      try {
        return assemble(source);
      } catch (error) {
        throw new Error(`Assembler error: ${error.message}`);
      }
    },
    terminal: adapter.createTerminalAdapter(),
    video: adapter.createVideoAdapter(),
    programs: adapter.createProgramsAdapter(),
    debug: adapter.createDebugAdapter(), // STUB DEBUG ADAPTER - Replace with proper CPU debug integration
    adapter // For direct access if needed
  };
};