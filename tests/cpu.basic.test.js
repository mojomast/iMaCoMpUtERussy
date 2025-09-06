/**
 * Comprehensive CPU Tests for iMaCoMpUtERussy Emulator
 * Tests load/store, arithmetic, logic, comparison, branch, and video I/O instructions
 * Using Jest test framework
 */

const { iMaCoMpUtERussyCPU } = require('../js/cpu.js');
const { iMaCoMpUtERussyMemory } = require('../js/memory.js');

describe('iMaCoMpUtERussy CPU Comprehensive Tests', () => {
  let cpu, memory;

  beforeEach(() => {
    memory = new iMaCoMpUtERussyMemory();
    cpu = new iMaCoMpUtERussyCPU({ memory });
    cpu.reset();
  });

  describe('Load/Store Instructions Tests', () => {
    /**
     * Test LDA immediate instruction loads accumulator and sets flags correctly
     */
    test('LDA immediate loads accumulator and sets flags correctly', () => {
      // Program: LDA #$42 (0xA9 0x42)
      memory.write(0x0000, 0xA9);
      memory.write(0x0001, 0x42);
      cpu.pc = 0x0000;
      
      cpu.execute(2);

      expect(cpu.a).toBe(0x42);
      expect(cpu.getFlag('Z')).toBe(false); // Non-zero value
      expect(cpu.getFlag('N')).toBe(false); // Positive value
    });

    /**
     * Test STA zero page stores accumulator value to memory
     */
    test('STA zero page stores accumulator value to memory', () => {
      cpu.a = 0x42;
      
      // Program: STA $00 (0x85 0x00)
      memory.write(0x0000, 0x85);
      memory.write(0x0001, 0x00);
      cpu.pc = 0x0000;
      
      cpu.execute(2);

      expect(memory.readByte(0x0000)).toBe(0x42);
    });

    /**
     * Test LDA zero page loads value from memory to accumulator
     */
    test('LDA zero page loads value from memory to accumulator', () => {
      memory.writeByte(0x0000, 0x42);
      
      // Program: LDA $00 (0xA5 0x00)
      memory.write(0x0000, 0xA5);
      memory.write(0x0001, 0x00);
      cpu.pc = 0x0000;
      
      cpu.execute(2);

      expect(cpu.a).toBe(0x42);
      expect(cpu.getFlag('Z')).toBe(false);
    });

    /**
     * Test LDA immediate with zero value sets zero flag
     */
    test('LDA immediate with zero value sets zero flag', () => {
      // Program: LDA #$00 (0xA9 0x00)
      memory.write(0x0000, 0xA9);
      memory.write(0x0001, 0x00);
      cpu.pc = 0x0000;
      
      cpu.execute(2);

      expect(cpu.a).toBe(0x00);
      expect(cpu.getFlag('Z')).toBe(true);
      expect(cpu.getFlag('N')).toBe(false);
    });

    /**
     * Test LDA immediate with negative value sets negative flag
     */
    test('LDA immediate with negative value sets negative flag', () => {
      // Program: LDA #$80 (0xA9 0x80) - negative in two's complement
      memory.write(0x0000, 0xA9);
      memory.write(0x0001, 0x80);
      cpu.pc = 0x0000;
      
      cpu.execute(2);

      expect(cpu.a).toBe(0x80);
      expect(cpu.getFlag('Z')).toBe(false);
      expect(cpu.getFlag('N')).toBe(true);
    });
  });

  describe('Arithmetic Instructions Tests', () => {
    /**
     * Test ADC immediate with no carry
     */
    test('ADC immediate performs addition correctly with no carry', () => {
      cpu.a = 0x10;
      
      // Program: ADC #$20 (0x69 0x20)
      memory.write(0x0000, 0x69);
      memory.write(0x0001, 0x20);
      cpu.pc = 0x0000;
      
      cpu.execute(2);

      expect(cpu.a).toBe(0x30);
      expect(cpu.getFlag('C')).toBe(false); // No carry
      expect(cpu.getFlag('Z')).toBe(false);
      expect(cpu.getFlag('V')).toBe(false); // No overflow
      expect(cpu.getFlag('N')).toBe(false);
    });

    /**
     * Test ADC immediate with carry
     */
    test('ADC immediate performs addition correctly with carry', () => {
      cpu.a = 0xFF;
      
      // Program: ADC #$01 (0x69 0x01)
      memory.write(0x0000, 0x69);
      memory.write(0x0001, 0x01);
      cpu.pc = 0x0000;
      
      cpu.execute(2);

      expect(cpu.a).toBe(0x00);
      expect(cpu.getFlag('C')).toBe(true); // Carry occurred
      expect(cpu.getFlag('Z')).toBe(true); // Result is zero
      expect(cpu.getFlag('V')).toBe(false);
      expect(cpu.getFlag('N')).toBe(false);
    });

    /**
     * Test SBC immediate performs subtraction correctly
     */
    test('SBC immediate performs subtraction correctly', () => {
      cpu.a = 0x30;
      
      // Program: SBC #$10 (0xE9 0x10)
      memory.write(0x0000, 0xE9);
      memory.write(0x0001, 0x10);
      cpu.pc = 0x0000;
      
      cpu.execute(2);

      expect(cpu.a).toBe(0x20);
      expect(cpu.getFlag('C')).toBe(true); // No borrow
      expect(cpu.getFlag('Z')).toBe(false);
      expect(cpu.getFlag('V')).toBe(false);
      expect(cpu.getFlag('N')).toBe(false);
    });

    /**
     * Test INC zero page increments memory location
     */
    test('INC zero page increments memory location correctly', () => {
      memory.writeByte(0x0000, 0x42);
      
      // Program: INC $00 (0xE6 0x00)
      memory.write(0x0000, 0xE6);
      memory.write(0x0001, 0x00);
      cpu.pc = 0x0000;
      
      cpu.execute(2);

      expect(memory.readByte(0x0000)).toBe(0x43);
    });

    /**
     * Test DEC zero page decrements memory location
     */
    test('DEC zero page decrements memory location correctly', () => {
      memory.writeByte(0x0000, 0x42);
      
      // Program: DEC $00 (0xC6 0x00)
      memory.write(0x0000, 0xC6);
      memory.write(0x0001, 0x00);
      cpu.pc = 0x0000;
      
      cpu.execute(2);

      expect(memory.readByte(0x0000)).toBe(0x41);
    });
  });

  describe('Logic Instructions Tests', () => {
    /**
     * Test AND immediate performs bitwise AND
     */
    test('AND immediate performs bitwise AND correctly', () => {
      cpu.a = 0xF0;
      
      // Program: AND #$0F (0x29 0x0F)
      memory.write(0x0000, 0x29);
      memory.write(0x0001, 0x0F);
      cpu.pc = 0x0000;
      
      cpu.execute(2);

      expect(cpu.a).toBe(0x00);
      expect(cpu.getFlag('Z')).toBe(true);
    });

    /**
     * Test ORA immediate performs bitwise OR
     */
    test('ORA immediate performs bitwise OR correctly', () => {
      cpu.a = 0xF0;
      
      // Program: ORA #$0F (0x09 0x0F)
      memory.write(0x0000, 0x09);
      memory.write(0x0001, 0x0F);
      cpu.pc = 0x0000;
      
      cpu.execute(2);

      expect(cpu.a).toBe(0xFF);
      expect(cpu.getFlag('Z')).toBe(false);
    });

    /**
     * Test EOR immediate performs bitwise XOR
     */
    test('EOR immediate performs bitwise XOR correctly', () => {
      cpu.a = 0xF0;
      
      // Program: EOR #$0F (0x49 0x0F)
      memory.write(0x0000, 0x49);
      memory.write(0x0001, 0x0F);
      cpu.pc = 0x0000;
      
      cpu.execute(2);

      expect(cpu.a).toBe(0xFF);
      expect(cpu.getFlag('Z')).toBe(false);
    });

    /**
     * Test ASL accumulator shifts left
     */
    test('ASL accumulator shifts left and sets carry', () => {
      cpu.a = 0x80;
      
      // Program: ASL A (0x0A)
      memory.write(0x0000, 0x0A);
      cpu.pc = 0x0000;
      
      cpu.execute(1);

      expect(cpu.a).toBe(0x00);
      expect(cpu.getFlag('C')).toBe(true); // Carry from bit 7
      expect(cpu.getFlag('Z')).toBe(true);
      expect(cpu.getFlag('N')).toBe(false);
    });

    /**
     * Test LSR accumulator shifts right
     */
    test('LSR accumulator shifts right and clears negative flag', () => {
      cpu.a = 0x80;
      
      // Program: LSR A (0x4A)
      memory.write(0x0000, 0x4A);
      cpu.pc = 0x0000;
      
      cpu.execute(1);

      expect(cpu.a).toBe(0x40);
      expect(cpu.getFlag('C')).toBe(false);
      expect(cpu.getFlag('Z')).toBe(false);
      expect(cpu.getFlag('N')).toBe(false);
    });
  });

  describe('Comparison and Branch Instructions Tests', () => {
    /**
     * Test CMP immediate sets flags correctly
     */
    test('CMP immediate sets comparison flags correctly', () => {
      cpu.a = 0x42;
      
      // Program: CMP #$42 (0xC9 0x42)
      memory.write(0x0000, 0xC9);
      memory.write(0x0001, 0x42);
      cpu.pc = 0x0000;
      
      cpu.execute(2);

      expect(cpu.getFlag('Z')).toBe(true); // Equal
      expect(cpu.getFlag('C')).toBe(true); // A >= value
      expect(cpu.getFlag('N')).toBe(false);
    });

    /**
     * Test CMP immediate with smaller value
     */
    test('CMP immediate with smaller value sets carry false', () => {
      cpu.a = 0x20;
      
      // Program: CMP #$42 (0xC9 0x42)
      memory.write(0x0000, 0xC9);
      memory.write(0x0001, 0x42);
      cpu.pc = 0x0000;
      
      cpu.execute(2);

      expect(cpu.getFlag('Z')).toBe(false); // Not equal
      expect(cpu.getFlag('C')).toBe(false); // A < value
    });

    /**
     * Test BEQ branch taken
     */
    test('BEQ branch taken when zero flag set', () => {
      cpu.setFlag('Z', true);
      
      // Program: BEQ +3 (0xF0 0x03) - branch forward 3 bytes
      memory.write(0x0000, 0xF0);
      memory.write(0x0001, 0x03);
      cpu.pc = 0x0000;
      
      cpu.execute(2);

      expect(cpu.pc).toBe(0x0004); // PC advanced by 2 (instruction) + 3 (branch) - 1 (already executed)
    });

    /**
     * Test BEQ branch not taken
     */
    test('BEQ branch not taken when zero flag clear', () => {
      cpu.setFlag('Z', false);
      
      // Program: BEQ +3 (0xF0 0x03)
      memory.write(0x0000, 0xF0);
      memory.write(0x0001, 0x03);
      cpu.pc = 0x0000;
      
      cpu.execute(2);

      expect(cpu.pc).toBe(0x0002); // No branch, just instruction length
    });

    /**
     * Test BNE branch taken
     */
    test('BNE branch taken when zero flag clear', () => {
      cpu.setFlag('Z', false);
      
      // Program: BNE +3 (0xD0 0x03)
      memory.write(0x0000, 0xD0);
      memory.write(0x0001, 0x03);
      cpu.pc = 0x0000;
      
      cpu.execute(2);

      expect(cpu.pc).toBe(0x0004); // Branch taken
    });

    /**
     * Test BNE branch not taken
     */
    test('BNE branch not taken when zero flag set', () => {
      cpu.setFlag('Z', true);
      
      // Program: BNE +3 (0xD0 0x03)
      memory.write(0x0000, 0xD0);
      memory.write(0x0001, 0x03);
      cpu.pc = 0x0000;
      
      cpu.execute(2);

      expect(cpu.pc).toBe(0x0002); // No branch
    });
  });

  describe('Video I/O Instructions Tests', () => {
    /**
     * Test VLD instruction loads video data
     */
    test('VLD instruction loads video data correctly', () => {
      // Mock video buffer
      memory.writeByte(0x0200, 0x00); // Video buffer start
      
      // Program: VLD #$42 (loads to video buffer)
      memory.write(0x0000, 0xE0); // VLD immediate opcode (assuming 0xE0)
      memory.write(0x0001, 0x42);
      cpu.pc = 0x0000;
      
      cpu.execute(2);

      expect(memory.readByte(0x0200)).toBe(0x42); // Video data loaded
    });

    /**
     * Test VST instruction stores to video buffer
     */
    test('VST instruction stores to video buffer correctly', () => {
      cpu.a = 0x42;
      
      // Program: VST #$00 (store A to video offset 0)
      memory.write(0x0000, 0xE1); // VST immediate opcode (assuming 0xE1)
      memory.write(0x0001, 0x00);
      cpu.pc = 0x0000;
      
      cpu.execute(2);

      expect(memory.readByte(0x0200)).toBe(0x42); // Stored to video buffer
    });

    /**
     * Test VUP instruction updates display
     */
    test('VUP instruction updates video display', () => {
      // Mock video display
      const mockVideoDisplay = {
        updateDisplay: jest.fn()
      };
      global.window = { videoDisplay: mockVideoDisplay };
      
      // Program: VUP (0xE2)
      memory.write(0x0000, 0xE2);
      cpu.pc = 0x0000;
      
      cpu.execute(1);

      expect(mockVideoDisplay.updateDisplay).toHaveBeenCalledTimes(1);
    });

    /**
     * Test VDL instruction loads video data with offset
     */
    test('VDL instruction loads video data with offset', () => {
      // Program: VDL #$10 (load to video offset 16)
      memory.write(0x0000, 0xE3); // VDL opcode (assuming 0xE3)
      memory.write(0x0001, 0x10);
      cpu.pc = 0x0000;
      
      cpu.execute(2);

      expect(memory.readByte(0x0210)).toBe(0x00); // Should initialize offset location
    });
  });

  describe('Stack Operations Tests', () => {
    /**
     * Test JSR pushes return address and jumps
     */
    test('JSR pushes return address and jumps correctly', () => {
      // Program: JSR $0605 (0x20 0x05 0x06)
      memory.write(0x0000, 0x20);
      memory.write(0x0001, 0x05);
      memory.write(0x0002, 0x06);
      cpu.pc = 0x0000;
      
      cpu.execute(3);

      // Return address should be PC+2 (0x0003) pushed to stack
      expect(memory.readByte(0x01FF)).toBe(0x03); // Low byte
      expect(memory.readByte(0x01FE)).toBe(0x00); // High byte
      expect(cpu.sp).toBe(0xFD); // Stack pointer decremented twice
      expect(cpu.pc).toBe(0x0605); // Jumped to subroutine
    });

    /**
     * Test RTS pulls return address and returns
     */
    test('RTS pulls return address and returns correctly', () => {
      cpu.sp = 0xFF;
      memory.writeByte(0x01FF, 0x03); // Low byte of return address
      memory.writeByte(0x01FE, 0x00); // High byte of return address
      
      // Program: RTS (0x60)
      memory.write(0x0000, 0x60);
      cpu.pc = 0x0000;
      
      cpu.execute(1);

      expect(cpu.pc).toBe(0x0003); // Returned to correct address
      expect(cpu.sp).toBe(0x01); // Stack pointer incremented twice
    });

    /**
     * Test PHP pushes processor status
     */
    test('PHP pushes processor status to stack', () => {
      cpu.setFlag('C', true);
      cpu.setFlag('Z', false);
      cpu.a = 0x42;
      cpu.sp = 0xFF;
      
      // Program: PHP (0x08)
      memory.write(0x0000, 0x08);
      cpu.pc = 0x0000;
      
      cpu.execute(1);

      const status = memory.readByte(0x01FF);
      expect(status & 0x01).toBe(1); // Carry flag set
      expect(status & 0x80).toBe(0); // Negative flag clear
      expect(cpu.sp).toBe(0xFE);
    });

    /**
     * Test PLA pulls processor status from stack
     */
    test('PLA pulls accumulator from stack', () => {
      cpu.sp = 0x00;
      memory.writeByte(0x0100, 0x42); // Value on stack
      
      // Program: PLA (0x68)
      memory.write(0x0000, 0x68);
      cpu.pc = 0x0000;
      
      cpu.execute(1);

      expect(cpu.a).toBe(0x42);
      expect(cpu.getFlag('Z')).toBe(false);
      expect(cpu.sp).toBe(0x01);
    });
  });

  describe('Control Flow Tests', () => {
    /**
     * Test JMP absolute jumps to target address
     */
    test('JMP absolute jumps to target address', () => {
      // Program: JMP $0600 (0x4C 0x00 0x06)
      memory.write(0x0000, 0x4C);
      memory.write(0x0001, 0x00);
      memory.write(0x0002, 0x06);
      cpu.pc = 0x0000;
      
      cpu.execute(3);

      expect(cpu.pc).toBe(0x0600);
    });

    /**
     * Test HLT instruction stops execution
     */
    test('HLT instruction stops CPU execution', () => {
      // Program: HLT (0x3A)
      memory.write(0x0000, 0x3A);
      cpu.pc = 0x0000;
      
      cpu.execute(1);

      expect(cpu.running).toBe(false);
      expect(cpu.pc).toBe(0x0001); // PC advanced after instruction
    });

    /**
     * Test BRK instruction triggers interrupt
     */
    test('BRK instruction triggers software interrupt', () => {
      cpu.sp = 0xFF;
      memory.writeByte(0x01FF, 0x03); // Return low
      memory.writeByte(0x01FE, 0x00); // Return high
      memory.writeByte(0x01FD, 0x24); // Status byte
      
      // Program: BRK (0x00)
      memory.write(0x0000, 0x00);
      cpu.pc = 0x0000;
      
      cpu.execute(1);

      expect(cpu.pc).toBe(0xFFFE); // BRK vector (assuming fixed)
      expect(cpu.sp).toBe(0xFC); // Pushed PC (2 bytes) + status (1 byte)
      expect(cpu.getFlag('I')).toBe(true); // Interrupts disabled
    });

    /**
     * Test RTI instruction returns from interrupt
     */
    test('RTI instruction returns from interrupt correctly', () => {
      cpu.sp = 0xFD;
      memory.writeByte(0x01FD, 0x24); // Status to restore
      memory.writeByte(0x01FE, 0x03); // PC low
      memory.writeByte(0x01FF, 0x00); // PC high
      
      // Program: RTI (0x40)
      memory.write(0x0000, 0x40);
      cpu.pc = 0x0000;
      
      cpu.execute(1);

      expect(cpu.pc).toBe(0x0003);
      expect(cpu.getFlag('I')).toBe(false); // Interrupts re-enabled from status
      expect(cpu.sp).toBe(0xFF);
    });
  });

  describe('Register Operations Tests', () => {
    /**
     * Test TAX transfers accumulator to X register
     */
    test('TAX transfers accumulator to X register', () => {
      cpu.a = 0x42;
      
      // Program: TAX (0xAA)
      memory.write(0x0000, 0xAA);
      cpu.pc = 0x0000;
      
      cpu.execute(1);

      expect(cpu.x).toBe(0x42);
      expect(cpu.a).toBe(0x42); // A unchanged
    });

    /**
     * Test TYA transfers Y to accumulator
     */
    test('TYA transfers Y register to accumulator', () => {
      cpu.y = 0x42;
      
      // Program: TYA (0x98)
      memory.write(0x0000, 0x98);
      cpu.pc = 0x0000;
      
      cpu.execute(1);

      expect(cpu.a).toBe(0x42);
      expect(cpu.y).toBe(0x42); // Y unchanged
    });

    /**
     * Test TSX transfers stack pointer to X register
     */
    test('TSX transfers stack pointer to X register', () => {
      cpu.sp = 0x42;
      
      // Program: TSX (0xBA)
      memory.write(0x0000, 0xBA);
      cpu.pc = 0x0000;
      
      cpu.execute(1);

      expect(cpu.x).toBe(0x42);
      expect(cpu.sp).toBe(0x42); // SP unchanged
    });

    /**
     * Test TXS transfers X register to stack pointer
     */
    test('TXS transfers X register to stack pointer', () => {
      cpu.x = 0x42;
      
      // Program: TXS (0x9A)
      memory.write(0x0000, 0x9A);
      cpu.pc = 0x0000;
      
      cpu.execute(1);

      expect(cpu.sp).toBe(0x42);
      expect(cpu.x).toBe(0x42); // X unchanged
    });
  });

  describe('Flag Operations Tests', () => {
    /**
     * Test CLC clears carry flag
     */
    test('CLC clears carry flag', () => {
      cpu.setFlag('C', true);
      
      // Program: CLC (0x18)
      memory.write(0x0000, 0x18);
      cpu.pc = 0x0000;
      
      cpu.execute(1);

      expect(cpu.getFlag('C')).toBe(false);
    });

    /**
     * Test SEC sets carry flag
     */
    test('SEC sets carry flag', () => {
      cpu.setFlag('C', false);
      
      // Program: SEC (0x38)
      memory.write(0x0000, 0x38);
      cpu.pc = 0x0000;
      
      cpu.execute(1);

      expect(cpu.getFlag('C')).toBe(true);
    });

    /**
     * Test CLD clears decimal mode
     */
    test('CLD clears decimal mode flag', () => {
      cpu.setFlag('D', true);
      
      // Program: CLD (0xD8)
      memory.write(0x0000, 0xD8);
      cpu.pc = 0x0000;
      
      cpu.execute(1);

      expect(cpu.getFlag('D')).toBe(false);
    });

    /**
     * Test SED sets decimal mode
     */
    test('SED sets decimal mode flag', () => {
      cpu.setFlag('D', false);
      
      // Program: SED (0xF8)
      memory.write(0x0000, 0xF8);
      cpu.pc = 0x0000;
      
      cpu.execute(1);

      expect(cpu.getFlag('D')).toBe(true);
    });

    /**
     * Test CLI clears interrupt disable flag
     */
    test('CLI clears interrupt disable flag', () => {
      cpu.setFlag('I', true);
      
      // Program: CLI (0x58)
      memory.write(0x0000, 0x58);
      cpu.pc = 0x0000;
      
      cpu.execute(1);

      expect(cpu.getFlag('I')).toBe(false);
    });

    /**
     * Test SEI sets interrupt disable flag
     */
    test('SEI sets interrupt disable flag', () => {
      cpu.setFlag('I', false);
      
      // Program: SEI (0x78)
      memory.write(0x0000, 0x78);
      cpu.pc = 0x0000;
      
      cpu.execute(1);

      expect(cpu.getFlag('I')).toBe(true);
    });

    /**
     * Test CLV clears overflow flag
     */
    test('CLV clears overflow flag', () => {
      cpu.setFlag('V', true);
      
      // Program: CLV (0xB8)
      memory.write(0x0000, 0xB8);
      cpu.pc = 0x0000;
      
      cpu.execute(1);

      expect(cpu.getFlag('V')).toBe(false);
    });
  });

  /**
   * Test comprehensive instruction execution cycle
   */
  test('should execute complete instruction cycle correctly', () => {
    // Simple program: LDA #$42; STA $00; HLT
    memory.write(0x0000, 0xA9); // LDA #$42
    memory.write(0x0001, 0x42);
    memory.write(0x0002, 0x85); // STA $00
    memory.write(0x0003, 0x00);
    memory.write(0x0004, 0x3A); // HLT
    
    cpu.pc = 0x0000;
    let instructionsExecuted = 0;
    
    while (cpu.running) {
      const cycles = cpu.execute();
      instructionsExecuted++;
      if (instructionsExecuted > 10) break; // Safety
    }
    
    expect(cpu.running).toBe(false);
    expect(cpu.a).toBe(0x42);
    expect(memory.readByte(0x0000)).toBe(0x42);
    expect(instructionsExecuted).toBe(3);
  });
});
