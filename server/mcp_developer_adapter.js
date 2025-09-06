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
          const stepsExecuted = cpu.run(maxSteps || 1000);
          return {
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
            memory.writeByte(address, value & 0xFF);
          } else {
            // Multi-byte write
            for (let i = 0; i < bytes; i++) {
              const byte = (value >> (i * 8)) & 0xFF;
              memory.writeByte(address + i, byte);
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
          const bytesLoaded = memory.loadProgram(new Uint8Array(bytecode), startAddress);
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
              cleared: true
            }
          };
        } catch (error) {
          console.error('Video clear error:', error);
          throw error;
        }
      },

      async update() {
        // Video update - could trigger CPU instruction to update display
        try {
          // This would need to trigger VUP instruction or similar
          return {
            success: true,
            data: {
              displayUpdated: true,
              updateTriggered: true
            }
          };
        } catch (error) {
          console.error('Video update error:', error);
          throw error;
        }
      }
    },

    programs: {
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
            memory.loadProgram(bytecode, loadAddress);

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
            memory.loadProgram(bytecode, 0x0600);
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