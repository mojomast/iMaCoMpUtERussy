import { iMaCoMpUtERussyCPU } from './js/cpu.js';
import { iMaCoMpUtERussyMemory } from './js/memory.js';

const memory = new iMaCoMpUtERussyMemory();
const cpu = new iMaCoMpUtERussyCPU({ memory });

// Test ADC absolute debug
console.log('=== ADC Absolute Debug ===');

// Set up memory
memory.writeByte(0x1234, 0x05);
console.log('Memory at 0x1234:', memory.readByte(0x1234));

// Load program: LDA #$10; ADC $1234
memory.loadProgram(0x0600, [0xA9, 0x10, 0x6D, 0x00, 0x12]);
cpu.PC = 0x0600;

// Debug: Check what opcodes are actually in memory
console.log('Memory at 0x0600:', memory.readByte(0x0600).toString(16)); // Should be A9
console.log('Memory at 0x0601:', memory.readByte(0x0601).toString(16)); // Should be 10
console.log('Memory at 0x0602:', memory.readByte(0x0602).toString(16)); // Should be 6D
console.log('Memory at 0x0603:', memory.readByte(0x0603).toString(16)); // Should be 00
console.log('Memory at 0x0604:', memory.readByte(0x0604).toString(16)); // Should be 12

// Reset CPU state
cpu.A = 0;
cpu.X = 0;
cpu.Y = 0;
cpu.SP = 0xFF;
cpu.P = 0x20; // Bit 5 set
cpu.running = true;

console.log('Before execution:');
console.log('PC:', cpu.PC.toString(16));
console.log('A:', cpu.A.toString(16));
console.log('C flag:', cpu.getFlag('C'));

// Execute LDA #$10
cpu.step();
console.log('After LDA #$10:');
console.log('PC:', cpu.PC.toString(16));
console.log('A:', cpu.A.toString(16));
console.log('C flag:', cpu.getFlag('C'));

// Execute ADC $1234
const opcodeBefore = memory.readByte(cpu.PC);
console.log('Opcode at PC before ADC step:', opcodeBefore.toString(16));
cpu.step();
console.log('After ADC $1234:');
console.log('PC:', cpu.PC.toString(16));
console.log('A:', cpu.A.toString(16));
console.log('C flag:', cpu.getFlag('C'));

// What value did ADC read from memory?
const addr = 0x1234;
const operand = memory.readByte(addr);
console.log('ADC read from address', addr.toString(16), ':', operand.toString(16));
console.log('Calculation: 0x10 +', operand.toString(16), '+ carry(0) =', (0x10 + operand).toString(16));

// Check if ADC absolute opcode exists
console.log('Does CPU have ADC absolute (0x6D) handler?',
  cpu.executeInstruction.toString().includes('case 0x6D'));
