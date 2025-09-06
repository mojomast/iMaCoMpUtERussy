/**
 * Assembler Basic Tests
 * Tests basic assembly functionality using Jest
 */

const { assemble } = require('../js/assembler.js');

describe('Assembler Basic Tests', () => {
  /**
   * Test that assembling a basic program returns a Uint8Array with length > 0
   */
  test('should assemble basic program and return Uint8Array with length > 0', () => {
    const source = `
.org 0x0600
LDA #10
STA 0x00
HLT
    `;
    const bytes = assemble(source);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  /**
   * Test that inline assembly produces expected byte sequence
   */
  test('should assemble inline program and produce expected byte sequence', () => {
    const source = 'LDA #10\nSTA 0x00\nHLT';
    const bytes = assemble(source, { origin: 0x0600 });
    const expected = [0xA9, 10, 0x85, 0x00, 0x3A]; // LDA #10, STA $00 zp, HLT
    expect(bytes.length).toBe(expected.length);
    expect(Array.from(bytes)).toEqual(expected);
  });

  /**
   * Test that assembly handles labels and branching instructions
   */
  test('should handle labels and branching instructions correctly', () => {
    const source = `
.org 0x0600
start:
  LDA #5
  CMP #10
  BNE start
  HLT
    `;
    const result = assemble(source);
    expect(result.errors).toHaveLength(0);
    expect(result.memory).toBeInstanceOf(Uint8Array);
    expect(result.memory.length).toBeGreaterThan(0);
  });

  /**
   * Test error handling for invalid syntax
   */
  test('should report errors for invalid syntax', () => {
    const source = 'INVALID_OPCODE #42';
    const result = assemble(source);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('INVALID_OPCODE');
  });

  /**
   * Test directive handling (.org)
   */
  test('should handle .org directive correctly', () => {
    const source = `
.org 0x0800
LDA #42
STA 0x00
    `;
    const result = assemble(source);
    expect(result.errors).toHaveLength(0);
    expect(result.memory.length).toBeGreaterThan(0);
    // The assembled code should start at offset 0x0800 - 0x0600 = 0x0200 in the memory array
  });

  /**
   * Test multiple instructions and addressing modes
   */
  test('should assemble multiple instructions with different addressing modes', () => {
    const source = `
LDA #42        ; Immediate
STA $00        ; Zero page
LDA $01,X      ; Zero page X
    `;
    const result = assemble(source);
    expect(result.errors).toHaveLength(0);
    expect(result.memory).toBeInstanceOf(Uint8Array);
  });
});
