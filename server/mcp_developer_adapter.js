// Server-side MCP Developer Adapters
// Real implementation connecting to actual emulator components

import { iMaCoMpUtERussyCPU } from '../js/cpu.js';
import { iMaCoMpUtERussyMemory } from '../js/memory.js';
import { assemble } from '../js/assembler.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global instances
let cpu = null;
let memory = null;

function createDeveloperAdapters() {
  // Initialize real emulator components
  if (!cpu) {
    memory = new iMaCoMpUtERussyMemory();
    cpu = new iMaCoMpUtERussyCPU({ memory });
    console.log('Initialized real CPU and Memory emulator components');
  }

  // Install a global MMIO logging hook usable by ESM modules that cannot require('fs')
  try {
    if (typeof globalThis.__MMIO_LOG !== 'function') {
      const logsDir = path.join(__dirname, '..', 'logs');
      if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
      globalThis.__MMIO_LOG = (addr, val) => {
        try {
          const p = path.join(logsDir, 'mmio-debug.log');
          const line = `${new Date().toISOString()} MMIO addr=0x${(addr & 0xFFFF).toString(16)} val=0x${(val & 0xFF).toString(16)}\n`;
          fs.appendFileSync(p, line, { encoding: 'utf8' });
        } catch (e) {
          // swallow
        }
      };
    }
  } catch (e) {
    // ignore global hook installation errors
  }

  // Expose server terminal helper globally so low-level memory code can call it
  try {
    if (typeof globalThis !== 'undefined' && typeof globalThis.__SERVER_TERMINAL === 'undefined') {
      import('./terminal.js').then(module => {
        globalThis.__SERVER_TERMINAL = module;
      }).catch(e => {
        // ignore if import fails; adapter will still use its local getServerTerminal
      });
    }
  } catch (e) {
    // swallow
  }

  // Server-side terminal buffer (captures writes to $F1 when no browser terminal is present)
  // Some test runs execute in Node where window.terminal is not available; capture output here
  // so that /mcp/terminal/read can return the program output.
  const serverTerminalBuffer = [];
  // Terminal helper for server-side terminal capture (shared access)
  // Lazily import to avoid circular deps in some environments
  let serverTerminal = null;
  async function getServerTerminal() {
    if (!serverTerminal) {
      try {
        const module = await import('./terminal.js');
        serverTerminal = module.default || module;
        return serverTerminal;
      } catch (e) {
        // Fallback to inline minimal terminal shim
        serverTerminal = {
          write: (v) => { serverTerminalBuffer.push(typeof v === 'number' ? v & 0xFF : String(v).charCodeAt(0) & 0xFF); },
          readAll: () => serverTerminalBuffer.splice(0, serverTerminalBuffer.length)
        };
        return serverTerminal;
      }
    }
    return serverTerminal;
  }
  try {
    // If memory exposes addWriteListener, use it to capture writes to $F1
    if (typeof memory.addWriteListener === 'function') {
      memory.addWriteListener((addr, value) => {
        try {
          if ((addr & 0xFFFF) === 0xF1) {
            // push byte value into server-side buffer
            serverTerminalBuffer.push(value & 0xFF);
            // Also set input ready flag on memory so reads may see it if implemented
            if (typeof memory.inputReadyFlag !== 'undefined') memory.inputReadyFlag = 1;
          }
        } catch (e) {
          // swallow
        }
      });
    }
  } catch (e) {
    // ignore
  }

  return {
    cpu: {
      async reset(hardReset = false) {
        try {
          cpu.reset();
          return {
            success: true,
            data: {
              pc: cpu.PC,
              a: cpu.A,
              x: cpu.X,
              y: cpu.Y,
              running: cpu.running,
              flags: {
                carry: cpu.getFlag('C'),
                zero: cpu.getFlag('Z'),
                interrupt: cpu.getFlag('I'),
                decimal: cpu.getFlag('D'),
                overflow: cpu.getFlag('V'),
                negative: cpu.getFlag('N')
              }
            }
          };
        } catch (error) {
          console.error('CPU reset error:', error);
          throw error;
        }
      },

      async step(timeout = 1000) {
        try {
          const startTime = Date.now();
          const pcBefore = cpu.PC;
          const cycles = cpu.step();
          const instruction = this._disassembleAt(pcBefore);

          return {
            success: true,
            data: {
              pc: cpu.PC,
              instruction: instruction,
              cycles: cycles,
              halted: !cpu.running,
              cpuState: {
                a: cpu.A,
                x: cpu.X,
                y: cpu.Y,
                flags: {
                  carry: cpu.getFlag('C'),
                  zero: cpu.getFlag('Z'),
                  interrupt: cpu.getFlag('I'),
                  decimal: cpu.getFlag('D'),
                  overflow: cpu.getFlag('V'),
                  negative: cpu.getFlag('N')
                }
              }
            }
          };
        } catch (error) {
          console.error('CPU step error:', error);
          throw error;
        }
      },

      async run(maxSteps, stepDelay = 1, breakOnHalt = true) {
        try {
          // Defensive reset of CPU registers/flags before running, but preserve PC
          // so that loadProgram can control start address.
          try {
            if (cpu) {
              const preservedPC = cpu.PC;
              if (typeof cpu.reset === 'function') cpu.reset();
              cpu.PC = preservedPC;
              cpu.running = true;
              if (typeof cpu.setPendingIRQ === 'function') cpu.setPendingIRQ(false);
            }
          } catch (e) {
            // ignore reset errors
          }
          const stepsExecuted = await cpu.run(maxSteps || 1000);
          const result = {
            success: true,
            data: {
              stepsExecuted: stepsExecuted,
              totalCycles: stepsExecuted * 2, // approximate
              halted: !cpu.running,
              finalState: {
                pc: cpu.PC,
                a: cpu.A,
                x: cpu.X,
                y: cpu.Y
              },
              executionTrace: [] // Could implement later
            }
          };
          // Temporary debug log to help diagnose empty response seen by client
          try {
            const debugPath = path.join(__dirname, '..', 'logs', 'adapter-debug.log');
            const logLine = `[${new Date().toISOString()}] DEBUG adapter.cpu.run result: ` + JSON.stringify(result) + '\n';
            // Ensure logs directory exists
            const logsDir = path.dirname(debugPath);
            if (!fs.existsSync(logsDir)) {
              fs.mkdirSync(logsDir, { recursive: true });
            }
            fs.appendFileSync(debugPath, logLine, { encoding: 'utf8' });
          } catch (dbgErr) {
            // swallow logging errors to avoid affecting adapter behavior
            console.error('adapter debug log failed:', dbgErr && dbgErr.message ? dbgErr.message : dbgErr);
          }

          return result;
        } catch (error) {
          console.error('CPU run error:', error);
          throw error;
        }
      },

      async status() {
        try {
          return {
            success: true,
            data: {
              pc: cpu.PC,
              a: cpu.A,
              x: cpu.X,
              y: cpu.Y,
              running: cpu.running,
              flags: {
                carry: cpu.getFlag('C'),
                zero: cpu.getFlag('Z'),
                interrupt: cpu.getFlag('I'),
                decimal: cpu.getFlag('D'),
                overflow: cpu.getFlag('V'),
                negative: cpu.getFlag('N')
              }
            }
          };
        } catch (error) {
          console.error('CPU status error:', error);
          throw error;
        }
      },

      _disassembleAt(address) {
        // Simple disassembler for instruction display
        try {
          const opcode = memory.readByte(address);
          // Basic opcode to name mapping (incomplete)
          const opcodes = {
            0xA9: 'LDA', 0xAD: 'LDA', 0xA5: 'LDA',
            0x8D: 'STA', 0x85: 'STA',
            0x69: 'ADC', 0x6D: 'ADC'
          };
          return opcodes[opcode] || `UNK_${opcode.toString(16)}`;
        } catch {
          return 'UNK';
        }
      }
    },

    memory: {
      async read(address, bytes = 1) {
        try {
          if (bytes === 1) {
            // If reading keyboard input register $F0, prefer server-side terminal helper if available
            const addr16 = address & 0xFFFF;
            if (addr16 === 0xF0) {
              try {
                const tPromise = getServerTerminal();
                const t = await tPromise; // Wait for the terminal module to load
                if (t && typeof t.peekBytes === 'function') {
                  const bytesAvail = t.peekBytes();
                  if (bytesAvail && bytesAvail.length > 0) {
                    const v = bytesAvail.shift();
                    // consume via readAll by rebuilding buffer (peek returned copy) - fallback to adapter buffer
                    try {
                      // If terminal exposes readAll, use that to consume
                      if (typeof t.readAll === 'function') {
                        const s = t.readAll();
                        const consumed = s.length > 0 ? s.charCodeAt(0) : v;
                        if (typeof memory.inputReadyFlag !== 'undefined') memory.inputReadyFlag = t.peekBytes().length > 0 ? 1 : 0;
                        return { success: true, data: { address, bytes: 1, value: consumed, hexValue: (consumed & 0xFF).toString(16).padStart(2, '0').toUpperCase() } };
                      }
                    } catch (e) {
                      // ignore, fall back
                    }
                  }
                }
              } catch (e) {
                // ignore terminal helper errors
              }

              // Fallback: adapter local buffer
              if (serverTerminalBuffer.length > 0) {
                const v = serverTerminalBuffer.shift();
                if (serverTerminalBuffer.length === 0 && typeof memory.inputReadyFlag !== 'undefined') memory.inputReadyFlag = 0;
                return { success: true, data: { address, bytes: 1, value: v, hexValue: v.toString(16).padStart(2, '0').toUpperCase() } };
              }
            }

            const value = memory.readByte(address);
            return {
              success: true,
              data: {
                address,
                bytes: 1,
                value: value,
                hexValue: value.toString(16).padStart(2, '0').toUpperCase()
              }
            };
          } else {
            // Multi-byte read
            let value = 0;
            let hexValue = '';
            for (let i = 0; i < bytes; i++) {
              const byte = memory.readByte(address + i);
              value |= (byte << (i * 8));
              hexValue = byte.toString(16).padStart(2, '0').toUpperCase() + hexValue; // Big-endian hex
            }
            return {
              success: true,
              data: {
                address,
                bytes,
                value,
                hexValue: hexValue.padStart(4, '0') // Pad for word size
              }
            };
          }
        } catch (error) {
          console.error('Memory read error:', error);
          throw error;
        }
      },

      async write(address, value, bytes = 1) {
        try {
          const previous = bytes === 1 ? memory.readByte(address) : null;

          if (bytes === 1) {
            // Debug: log MMIO-range writes
            try { if ((address & 0xFFFF) >= 0xF0) console.log(`[adapter] memory.write addr=0x${(address&0xFFFF).toString(16)} value=0x${(value&0xFF).toString(16)}`); } catch(e){}
            memory.writeByte(address, value & 0xFF);
            // If this is a terminal output write ($F1), capture on server terminal helper
            try {
              if ((address & 0xFFFF) === 0xF1) {
                const term = await getServerTerminal();
                if (term && typeof term.write === 'function') {
                  try { term.write(value & 0xFF); } catch(e){}
                } else {
                  serverTerminalBuffer.push(value & 0xFF);
                }
                if (typeof memory.inputReadyFlag !== 'undefined') memory.inputReadyFlag = 1;
              }
            } catch (e) {
              // swallow
            }
          } else {
            // Multi-byte write
            for (let i = 0; i < bytes; i++) {
              const byte = (value >> (i * 8)) & 0xFF;
              memory.writeByte(address + i, byte);
              // Capture multi-byte writes if they overlap $F1
              try {
                if (((address + i) & 0xFFFF) === 0xF1) {
                  serverTerminalBuffer.push(byte & 0xFF);
                  if (typeof memory.inputReadyFlag !== 'undefined') memory.inputReadyFlag = 1;
                }
              } catch (e) {
                // swallow
              }
            }
          }

          return {
            success: true,
            data: {
              address,
              bytes,
              value,
              previous
            }
          };
        } catch (error) {
          console.error('Memory write error:', error);
          throw error;
        }
      },

      async loadProgram(bytecode, startAddress, validate = true) {
        try {
          // js/memory.loadProgram expects (addr, byteArray)
          const bytesLoaded = memory.loadProgram(startAddress, new Uint8Array(bytecode));
          // Reset CPU state and set PC to start of loaded program to ensure fresh execution
          try {
            if (cpu && typeof cpu.reset === 'function') {
              cpu.reset();
            }
            if (cpu) {
              cpu.PC = startAddress;
              cpu.running = true;
              if (typeof cpu.setPendingIRQ === 'function') cpu.setPendingIRQ(false);
            }
          } catch (resetErr) {
            console.warn('Failed to reset CPU during loadProgram:', resetErr && resetErr.message ? resetErr.message : resetErr);
          }
          // Debug: record CPU state after reset/load
          try {
            const debugPath = path.join(__dirname, '..', 'logs', 'adapter-debug.log');
            const stateLine = `[${new Date().toISOString()}] DEBUG adapter.loadProgram cpuStateAfterReset: ` + JSON.stringify({ pc: cpu && cpu.PC, a: cpu && cpu.A, x: cpu && cpu.X, y: cpu && cpu.Y, running: cpu && cpu.running }) + '\n';
            fs.appendFileSync(debugPath, stateLine, { encoding: 'utf8' });
          } catch (e) {
            // ignore logging errors
          }
          return {
            success: true,
            data: {
              startAddress,
              bytesLoaded,
              endAddress: startAddress + bytesLoaded - 1,
              programSize: bytesLoaded
            }
          };
        } catch (error) {
          console.error('Memory loadProgram error:', error);
          throw error;
        }
      }
    },

    debug: {
      // In-memory breakpoints storage
      _breakpoints: [],

      async setBreakpoint(address) {
        const newId = `bp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const breakpoint = {
          id: newId,
          address,
          enabled: true,
          hitCount: 0,
          createdAt: new Date().toISOString()
        };
        this._breakpoints.push(breakpoint);
        console.log('Debug setBreakpoint called at address:', address, 'id:', newId);
        return newId;
      },

      async listBreakpoints() {
        return [...this._breakpoints];
      },

      async removeBreakpoint(identifier) {
        const index = this._breakpoints.findIndex(bp =>
          bp.id === identifier || bp.address === parseInt(identifier)
        );
        if (index >= 0) {
          const removedBp = this._breakpoints.splice(index, 1)[0];
          return { removed: true, address: removedBp.address, id: removedBp.id };
        }
        return { removed: false };
      },

      async trace(steps, options = {}) {
        const trace = [];
        let stepsExecuted = 0;
        let halted = false;
        let haltReason = null;
        const { until } = options;
        const originalPC = cpu.PC;

        try {
          for (let i = 0; i < steps; i++) {
            // Check breakpoints
            if (this._breakpoints.some(bp => bp.address === cpu.PC && bp.enabled)) {
              halted = true;
              haltReason = 'breakpoint_hit';
              break;
            }

            const pcBefore = cpu.PC;
            const cycles = cpu.step();

            trace.push({
              pc: pcBefore,
              opcode: memory.readByte(pcBefore),
              instruction: this._disassembleAt(pcBefore),
              registers: {
                a: cpu.A,
                x: cpu.X,
                y: cpu.Y
              },
              flags: {
                carry: cpu.getFlag('C'),
                zero: cpu.getFlag('Z'),
                interrupt: cpu.getFlag('I'),
                decimal: cpu.getFlag('D'),
                overflow: cpu.getFlag('V'),
                negative: cpu.getFlag('N')
              },
              cycles
            });

            stepsExecuted++;

            // Check halt conditions
            if (!cpu.running) {
              halted = true;
              haltReason = 'cpu_halted';
              break;
            }

            if (until === 'halt' && !cpu.running) {
              halted = true;
              haltReason = 'cpu_halted';
              break;
            }
          }

          if (!halted && stepsExecuted === steps) {
            haltReason = 'max_steps_reached';
          }

          return {
            stepsExecuted,
            halted,
            haltReason: haltReason || null,
            trace
          };
        } catch (error) {
          console.error('Debug trace error:', error);
          throw error;
        }
      },

      async memoryView(address, size = 256) {
        try {
          const bytes = [];
          for (let i = 0; i < size; i++) {
            bytes.push(memory.readByte(address + i));
          }
          return {
            address,
            size,
            bytes,
            format: 'hex',
            endAddress: address + size - 1
          };
        } catch (error) {
          console.error('Debug memoryView error:', error);
          throw error;
        }
      },

      async snapshot() {
        try {
          return {
            success: true,
            data: {
              timestamp: new Date().toISOString(),
              cpu: {
                pc: cpu.PC,
                a: cpu.A,
                x: cpu.X,
                y: cpu.Y,
                flags: {
                  carry: cpu.getFlag('C'),
                  zero: cpu.getFlag('Z'),
                  interrupt: cpu.getFlag('I'),
                  decimal: cpu.getFlag('D'),
                  overflow: cpu.getFlag('V'),
                  negative: cpu.getFlag('N')
                }
              },
              memory: {
                zeroPage: Array.from({length: 256}, (_, i) => memory.readByte(i)),
                programArea: Array.from({length: 256}, (_, i) => memory.readByte(0x600 + i))
              },
              breakpoints: this._breakpoints
            }
          };
        } catch (error) {
          console.error('Debug snapshot error:', error);
          throw error;
        }
      },

      _disassembleAt(address) {
        try {
          const opcode = memory.readByte(address);
          // Basic opcode to name mapping (simplified)
          const opcodes = {
            0xA9: 'LDA', 0xAD: 'LDA', 0xA5: 'LDA',
            0x8D: 'STA', 0x85: 'STA',
            0x69: 'ADC', 0x6D: 'ADC'
          };
          return opcodes[opcode] || `UNK_${opcode.toString(16)}`;
        } catch {
          return 'UNK';
        }
      }
    },

    video: {
      async write(data, startAddress = 0x0200, validate = true) {
        try {
          // Write to video buffer (0x0200-0x05FF)
          const bytesWritten = Math.min(data.length, 0x400); // Limit to video buffer size
          for (let i = 0; i < bytesWritten; i++) {
            const addr = (startAddress + i) & 0xFFFF;
            memory.writeByte(addr, data[i] & 0xFF);
          }

          return {
            success: true,
            data: {
              startAddress,
              bytesWritten,
              endAddress: startAddress + bytesWritten - 1,
              displayUpdated: true
            }
          };
        } catch (error) {
          console.error('Video write error:', error);
          throw error;
        }
      },

      async read(startAddress = 0x0200, length = 1024) {
        try {
          const bytes = [];
          const maxLength = Math.min(length, 0x400); // Limit to video buffer size
          for (let i = 0; i < maxLength; i++) {
            const addr = (startAddress + i) & 0xFFFF;
            bytes.push(memory.readByte(addr));
          }

          return {
            success: true,
            data: {
              startAddress,
              bytes,
              length: bytes.length
            }
          };
        } catch (error) {
          console.error('Video read error:', error);
          throw error;
        }
      },

      async setPixel(x, y, color) {
        try {
          const width = 32; // Video width
          const address = 0x0200 + (y * width) + x;
          memory.writeByte(address, color & 0xFF);

          return {
            success: true,
            data: {
              address,
              x,
              y,
              color
            }
          };
        } catch (error) {
          console.error('Video setPixel error:', error);
          throw error;
        }
      },

      async clear(color = 0) {
        try {
          for (let addr = 0x0200; addr <= 0x05FF; addr++) {
            memory.writeByte(addr, color & 0xFF);
          }

          return {
            success: true,
            data: {
              startAddress: 0x0200,
              endAddress: 0x05FF,
              color,
              bytesCleared: 0x400
            }
          };
        } catch (error) {
          console.error('Video clear error:', error);
          throw error;
        }
      },
    },

    programs: {
      async list() {
        try {
          const samplesDir = path.join(__dirname, '..', 'samples');
          if (!fs.existsSync(samplesDir)) return { success: true, data: [] };
          const files = fs.readdirSync(samplesDir).filter(f => f.endsWith('.asm'));
          const programs = files.map(f => path.parse(f).name);
          return { success: true, data: programs };
        } catch (error) {
          console.error('Programs list error:', error);
          throw error;
        }
      },

      async loadSample(sampleName, assembled = true, resetCPU = true) {
        try {
          const samplesDir = path.join(__dirname, '..', 'samples');
          const samplePath = path.join(samplesDir, `${sampleName}.asm`);

          if (!fs.existsSync(samplePath)) {
            throw new Error(`Sample program '${sampleName}' not found`);
          }

          const source = fs.readFileSync(samplePath, 'utf8');
          let bytecode = null;

          if (assembled) {
            bytecode = assemble(source, { origin: 0x0600 });
            const loadAddress = 0x0600;
            // memory.loadProgram expects (addr, byteArray)
            memory.loadProgram(loadAddress, new Uint8Array(bytecode));

            if (resetCPU) {
              cpu.reset();
              cpu.PC = loadAddress;
            }

            return {
              success: true,
              data: {
                sampleName,
                programSize: bytecode.length,
                loadAddress: 0x0600,
                source,
                bytecode: Array.from(bytecode)
              }
            };
          } else {
            return {
              success: true,
              data: {
                sampleName,
                programSize: source.length,
                loadAddress: null,
                source,
                bytecode: null
              }
            };
          }
        } catch (error) {
          console.error('Programs loadSample error:', error);
          throw error;
        }
      },

      async loadProgram(name, assembled = true, resetCPU = true) {
        return this.loadSample(name, assembled, resetCPU); // Alias for compatibility
      },

      async saveProgram(name, source, overwrite = false) {
        try {
          const programsDir = path.join(__dirname, '..', 'samples');
          const filePath = path.join(programsDir, `${name}.asm`);

          if (!overwrite && fs.existsSync(filePath)) {
            throw new Error('Program already exists and overwrite=false');
          }

          fs.writeFileSync(filePath, source, 'utf8');
          return {
            success: true,
            data: {
              name,
              size: source.length,
              overwrite,
              path: filePath
            }
          };
        } catch (error) {
          console.error('Programs save error:', error);
          throw error;
        }
      },

      async upload(filename, content, assemble = true, autoLoad = true) {
        try {
          const name = path.parse(filename).name;
          const result = await this.saveProgram(name, content, true);

          if (assemble && autoLoad) {
            const bytecode = assemble(content, { origin: 0x0600 });
            // memory.loadProgram expects (addr, byteArray)
            memory.loadProgram(0x0600, new Uint8Array(bytecode));
            cpu.reset();
            cpu.PC = 0x0600;
          }

          return {
            success: true,
            data: {
              filename,
              size: content.length,
              loaded: autoLoad && assemble,
              bytecode: assemble ? Array.from(assemble(content)) : null
            }
          };
        } catch (error) {
          console.error('Programs upload error:', error);
          throw error;
        }
      }
    }
  };
}

export { createDeveloperAdapters };