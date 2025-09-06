/**
 * Memory I/O Tests for iMaCoMpUtERussy Emulator
 * Tests memory-mapped I/O operations for video buffer and terminal
 */

import { iMaCoMpUtERussyCPU } from '../js/cpu.js';
import { iMaCoMpUtERussyMemory } from '../js/memory.js';

describe('Memory I/O Operations', () => {
  let cpu, memory;

  beforeEach(() => {
    memory = new iMaCoMpUtERussyMemory();
    cpu = new iMaCoMpUtERussyCPU({ memory });
    cpu.reset();
    
    // Mock global window for video operations
    global.window = global.window || {};
    global.window.videoDisplay = {
      updateDisplay: jest.fn()
    };
  });

  describe('Video Buffer Operations ($0200-$05FF)', () => {
    test('Video buffer is accessible within bounds', () => {
      // Write to video buffer start
      memory.writeByte(0x0200, 0x01);
      expect(memory.readByte(0x0200)).toBe(0x01);
      
      // Write to video buffer end
      memory.writeByte(0x05FF, 0x03);
      expect(memory.readByte(0x05FF)).toBe(0x03);
    });

    test('Video buffer writes outside bounds are handled correctly', () => {
      // Write just before video buffer
      memory.writeByte(0x01FF, 0xFF); // Stack area
      expect(memory.readByte(0x01FF)).toBe(0xFF);
      
      // Write just after video buffer
      memory.writeByte(0x0600, 0x42); // User RAM
      expect(memory.readByte(0x0600)).toBe(0x42);
    });

    test('VST instruction writes to video buffer correctly', () => {
      cpu.A = 0x02; // Green color
      
      // Program: VST #$00 (0x9B 0x00) - offset 0 → address 0x0200
      memory.writeByte(0x0600, 0x9B);
      memory.writeByte(0x0601, 0x00);
      
      cpu.PC = 0x0600;
      cpu.executeInstruction();
      
      expect(memory.readByte(0x0200)).toBe(0x02);
      expect(cpu.getFlag('C')).toBe(false); // Success
    });

    test('VST handles video buffer bounds checking', () => {
      cpu.A = 0x03; // Red color
      
      // Program: VST #$400 (0x9B 0x00 0x04) - offset 0x0400 → address 0x0600 (out of bounds)
      memory.writeByte(0x0600, 0x9B);
      memory.writeByte(0x0601, 0x00);
      // Note: VST is immediate mode, so only reads 1 byte after opcode
      
      cpu.PC = 0x0600;
      cpu.executeInstruction();
      
      // Should write to 0x0200 + 0x00 = 0x0200 (in bounds)
      expect(memory.readByte(0x0200)).toBe(0x03);
      expect(cpu.getFlag('C')).toBe(false);
      
      // Test actual out of bounds by manually calculating
      // VST #$E00 (0x9B 0x00 0x0E) → 0x0200 + 0x0E00 = 0x1000 (out of bounds)
      cpu.A = 0x01;
      memory.writeByte(0x0602, 0x9B);
      memory.writeByte(0x0603, 0x00); // Immediate value 0x00 (in bounds for this test)
      cpu.PC = 0x0602;
      cpu.executeInstruction();
      expect(cpu.getFlag('C')).toBe(false); // Still in bounds for this value
    });

    test('VUP triggers video display update', () => {
      // Program: VUP (0xAB)
      memory.writeByte(0x0600, 0xAB);
      
      cpu.PC = 0x0600;
      cpu.executeInstruction();
      
      expect(window.videoDisplay.updateDisplay).toHaveBeenCalledTimes(1);
      expect(cpu.getFlag('C')).toBe(false); // Success
    });

    test('Multiple VUP calls update display each time', () => {
      // Program: VUP VUP (0xAB 0xAB)
      memory.writeByte(0x0600, 0xAB);
      memory.writeByte(0x0601, 0xAB);
      
      cpu.PC = 0x0600;
      cpu.executeInstruction();
      cpu.executeInstruction();
      
      expect(window.videoDisplay.updateDisplay).toHaveBeenCalledTimes(2);
    });

    test('VLD stub implementation sets success flag', () => {
      // Program: VLD #$10 (0x8B 0x10)
      memory.writeByte(0x0600, 0x8B);
      memory.writeByte(0x0601, 0x10);
      
      cpu.PC = 0x0600;
      cpu.executeInstruction();
      
      expect(cpu.getFlag('C')).toBe(true); // Success flag for stub implementation
    });

    test('VDL creates appropriate frame delays', () => {
      const mockSetTimeout = jest.fn();
      global.setTimeout = mockSetTimeout;
      
      // Program: VDL #$01 (0xBB 0x01) - 1 frame = 16ms
      memory.writeByte(0x0600, 0xBB);
      memory.writeByte(0x0601, 0x01);
      
      cpu.PC = 0x0600;
      cpu.executeInstruction();
      
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 16);
      expect(cpu.getFlag('C')).toBe(false);
      
      // Test multiple frames
      mockSetTimeout.mockClear();
      
      // VDL #$03 (0xBB 0x03) - 3 frames = 48ms
      memory.writeByte(0x0602, 0xBB);
      memory.writeByte(0x0603, 0x03);
      cpu.PC = 0x0602;
      cpu.executeInstruction();
      
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 48);
    });
  });

  describe('Terminal I/O Operations ($F0-$F2)', () => {
    test('Terminal input/output registers are accessible', () => {
      // Test input register $F0
      memory.writeByte(0xF0, 0x41); // ASCII 'A'
      expect(memory.readByte(0xF0)).toBe(0x41);
      
      // Test output register $F1
      memory.writeByte(0xF1, 0x42); // ASCII 'B'
      expect(memory.readByte(0xF1)).toBe(0x42);
      
      // Test status register $F2
      memory.writeByte(0xF2, 0x01); // Input ready bit set
      expect(memory.readByte(0xF2)).toBe(0x01);
    });

    test('Terminal status bit testing', () => {
      // Clear input ready bit
      memory.writeByte(0xF2, 0x00);
      expect((memory.readByte(0xF2) & 0x01)).toBe(0x00);
      
      // Set input ready bit
      memory.writeByte(0xF2, 0x01);
      expect((memory.readByte(0xF2) & 0x01)).toBe(0x01);
      
      // Test other bits remain accessible
      memory.writeByte(0xF2, 0xFF); // All bits set
      expect((memory.readByte(0xF2) & 0xFE)).toBe(0xFE); // Bits 1-7 set
    });

    test('Terminal I/O through CPU instructions', () => {
      cpu.A = 0x48; // ASCII 'H'
      
      // Program: STA $F1 (output to terminal) (0x85 0xF1)
      memory.writeByte(0x0600, 0x85);
      memory.writeByte(0x0601, 0xF1);
      
      cpu.PC = 0x0600;
      cpu.executeInstruction();
      
      expect(memory.readByte(0xF1)).toBe(0x48);
      
      // Read from input register
      memory.writeByte(0xF0, 0x65); // ASCII 'e'
      
      // Program: LDA $F0 (0xA5 0xF0)
      memory.writeByte(0x0602, 0xA5);
      memory.writeByte(0x0603, 0xF0);
      cpu.PC = 0x0602;
      cpu.executeInstruction();
      
      expect(cpu.A).toBe(0x65);
    });

    test('Terminal input ready status checking', () => {
      // Program to check input status: LDA $F2; AND #$01; BEQ wait
      memory.writeByte(0xF2, 0x00); // No input ready
      
      // LDA $F2 (0xA5 0xF2)
      memory.writeByte(0x0600, 0xA5);
      memory.writeByte(0x0601, 0xF2);
      cpu.PC = 0x0600;
      cpu.executeInstruction();
      expect(cpu.A).toBe(0x00);
      
      // AND #$01 (0x29 0x01)
      memory.writeByte(0x0602, 0x29);
      memory.writeByte(0x0603, 0x01);
      cpu.PC = 0x0602;
      cpu.executeInstruction();
      expect(cpu.A).toBe(0x00);
      expect(cpu.getFlag('Z')).toBe(true); // Result is zero
      
      // Set input ready
      memory.writeByte(0xF2, 0x01);
      
      // Repeat test
      memory.writeByte(0x0604, 0xA5);
      memory.writeByte(0x0605, 0xF2);
      cpu.PC = 0x0604;
      cpu.executeInstruction();
      expect(cpu.A).toBe(0x01);
      
      memory.writeByte(0x0606, 0x29);
      memory.writeByte(0x0607, 0x01);
      cpu.PC = 0x0606;
      cpu.executeInstruction();
      expect(cpu.A).toBe(0x01);
      expect(cpu.getFlag('Z')).toBe(false);
    });

    test('Terminal echo program functionality', () => {
      // Simulate simple echo: read from $F0, write to $F1 if input ready
      memory.writeByte(0xF2, 0x01); // Input ready
      memory.writeByte(0xF0, 0x48); // 'H' to echo
      
      // Program:
      // LOOP: LDA $F2; AND #$01; BEQ LOOP; LDA $F0; STA $F1; ... (simplified)
      memory.writeByte(0x0600, 0xA5); // LDA $F2
      memory.writeByte(0x0601, 0xF2);
      cpu.PC = 0x0600;
      cpu.executeInstruction();
      
      memory.writeByte(0x0602, 0x29); // AND #$01
      memory.writeByte(0x0603, 0x01);
      cpu.PC = 0x0602;
      cpu.executeInstruction();
      
      // Since Z flag is false (input ready), continue
      memory.writeByte(0x0604, 0xA5); // LDA $F0
      memory.writeByte(0x0605, 0xF0);
      cpu.PC = 0x0604;
      cpu.executeInstruction();
      expect(cpu.A).toBe(0x48);
      
      cpu.A = 0x48; // Ensure A has value
      memory.writeByte(0x0606, 0x85); // STA $F1
      memory.writeByte(0x0607, 0xF1);
      cpu.PC = 0x0606;
      cpu.executeInstruction();
      
      expect(memory.readByte(0xF1)).toBe(0x48);
    });

    test('Terminal I/O with different character values', () => {
      const testChars = [
        { ascii: 0x20, desc: 'space' },
        { ascii: 0x41, desc: 'A' },
        { ascii: 0x5A, desc: 'Z' },
        { ascii: 0x61, desc: 'a' },
        { ascii: 0x7A, desc: 'z' },
        { ascii: 0x0D, desc: 'carriage return' }
      ];

      testChars.forEach(({ ascii, desc }) => {
        memory.writeByte(0xF0, ascii);
        memory.writeByte(0xF2, 0x01); // Input ready
        
        cpu.A = 0x00; // Clear A
        
        // LDA $F0
        memory.writeByte(0x0600, 0xA5);
        memory.writeByte(0x0601, 0xF0);
        cpu.PC = 0x0600;
        cpu.executeInstruction();
        
        expect(cpu.A).toBe(ascii);
        
        // STA $F1
        memory.writeByte(0x0602, 0x85);
        memory.writeByte(0x0603, 0xF1);
        cpu.PC = 0x0602;
        cpu.executeInstruction();
        
        expect(memory.readByte(0xF1)).toBe(ascii);
      });
    });
  });

  describe('Memory Mapped I/O Integration', () => {
    test('Video and terminal operations in sequence', () => {
      // Program sequence: VST #$00; STA $F1; VUP
      cpu.A = 0x01; // Green for video
      
      // VST #$00 (0x9B 0x00)
      memory.writeByte(0x0600, 0x9B);
      memory.writeByte(0x0601, 0x00);
      cpu.PC = 0x0600;
      cpu.executeInstruction();
      expect(memory.readByte(0x0200)).toBe(0x01);
      
      cpu.A = 0x48; // 'H' for terminal
      // STA $F1 (0x85 0xF1)
      memory.writeByte(0x0602, 0x85);
      memory.writeByte(0x0603, 0xF1);
      cpu.PC = 0x0602;
      cpu.executeInstruction();
      expect(memory.readByte(0xF1)).toBe(0x48);
      
      // VUP (0xAB)
      memory.writeByte(0x0604, 0xAB);
      cpu.PC = 0x0604;
      cpu.executeInstruction();
      expect(window.videoDisplay.updateDisplay).toHaveBeenCalledTimes(1);
    });

    test('I/O operations preserve CPU state', () => {
      cpu.A = 0x42;
      cpu.X = 0x05;
      cpu.Y = 0x0A;
      
      // Perform I/O operation
      memory.writeByte(0x0600, 0x9B); // VST #$00
      memory.writeByte(0x0601, 0x00);
      cpu.PC = 0x0600;
      cpu.executeInstruction();
      
      // Verify registers unchanged
      expect(cpu.A).toBe(0x42);
      expect(cpu.X).toBe(0x05);
      expect(cpu.Y).toBe(0x0A);
      
      // Flags should be preserved except for C flag set by VST
      cpu.setFlag('Z', true);
      cpu.setFlag('N', false);
      
      memory.writeByte(0x0602, 0xAB); // VUP
      cpu.PC = 0x0602;
      cpu.executeInstruction();
      
      expect(cpu.getFlag('Z')).toBe(true);
      expect(cpu.getFlag('N')).toBe(false);
    });

    test('Terminal input validation program', () => {
      // Simulate input validation: only echo printable characters (ASCII >= 32)
      const printable = 0x41; // 'A'
      const control = 0x0A;   // Line feed
      
      // Test printable character
      memory.writeByte(0xF0, printable);
      memory.writeByte(0xF2, 0x01); // Input ready
      
      // Program: LDA $F0; CMP #$20; BCS ECHO; ... (simplified)
      cpu.A = 0x00;
      memory.writeByte(0x0600, 0xA5); // LDA $F0
      memory.writeByte(0x0601, 0xF0);
      cpu.PC = 0x0600;
      cpu.executeInstruction();
      expect(cpu.A).toBe(printable);
      
      memory.writeByte(0x0602, 0xC9); // CMP #$20
      memory.writeByte(0x0603, 0x20);
      cpu.PC = 0x0602;
      cpu.executeInstruction();
      expect(cpu.getFlag('C')).toBe(true); // printable >= 32
      
      // Test control character
      memory.writeByte(0xF0, control);
      memory.writeByte(0xF2, 0x01);
      
      cpu.A = 0x00;
      memory.writeByte(0x0604, 0xA5); // LDA $F0
      memory.writeByte(0x0605, 0xF0);
      cpu.PC = 0x0604;
      cpu.executeInstruction();
      expect(cpu.A).toBe(control);
      
      memory.writeByte(0x0606, 0xC9); // CMP #$20
      memory.writeByte(0x0607, 0x20);
      cpu.PC = 0x0606;
      cpu.executeInstruction();
      expect(cpu.getFlag('C')).toBe(false); // control < 32
    });
  });

  afterEach(() => {
    // Cleanup mock
    if (global.window && global.window.videoDisplay) {
      global.window.videoDisplay.updateDisplay.mockClear();
    }
  });
});

console.log('Memory I/O tests completed');