/* global console */
/* eslint-env node */
/**
 * iMaCoMpUtERussy CPU Instruction Tests
 * Kyle Durepos - iMaCoMpUtERussy Project
 * ES module testing CPU instructions beyond basic LDA/STA
 */

// TODO: Add cycle-accurate timing tests
// TODO: Test interrupt handling when implemented
// TODO: Add decimal mode tests when implemented
// TODO: Test indexed addressing modes when implemented
// TODO: Add performance benchmarks for instruction execution

import { iMaCoMpUtERussyCPU } from '../js/cpu.js';
import { iMaCoMpUtERussyMemory } from '../js/memory.js';

let testsPassed = 0;
let testsFailed = 0;

function test(name, testFn) {
  try {
    testFn();
    console.log(`PASS: ${name}`);
    testsPassed++;
  } catch (e) {
    console.error(`FAIL: ${name} - ${e.message}`);
    testsFailed++;
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message} Expected ${expected}, got ${actual}`);
  }
}

// Helper to create CPU with memory
function createCPU() {
  const memory = new iMaCoMpUtERussyMemory();
  const cpu = new iMaCoMpUtERussyCPU({ memory });
  return { cpu, memory };
}

// Helper to load program and reset CPU
function loadProgram(cpu, memory, program, startAddr = 0x0600) {
  memory.loadProgram(startAddr, program);
  cpu.PC = startAddr;
  cpu.reset();
  cpu.PC = startAddr; // Override reset PC
}

// Test arithmetic instructions
test('ADC immediate no carry', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xA9, 0x10, 0x69, 0x20]); // LDA #$10; ADC #$20

  cpu.step(); // LDA
  cpu.step(); // ADC
  assertEqual(cpu.A, 0x30);
  assertEqual(cpu.getFlag('C'), false);
  assertEqual(cpu.getFlag('Z'), false);
  assertEqual(cpu.getFlag('N'), false);
});

test('ADC immediate with carry', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xA9, 0xFF, 0x69, 0x01]); // LDA #$FF; ADC #$01

  cpu.step(); // LDA
  cpu.step(); // ADC
  assertEqual(cpu.A, 0x00);
  assertEqual(cpu.getFlag('C'), true);
  assertEqual(cpu.getFlag('Z'), true);
  assertEqual(cpu.getFlag('N'), false);
});

test('ADC immediate with carry in', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xA9, 0x10, 0x69, 0x20]); // LDA #$10; ADC #$20

  cpu.setFlag('C', true);
  cpu.step(); // LDA
  cpu.step(); // ADC
  assertEqual(cpu.A, 0x31);
  assertEqual(cpu.getFlag('C'), false);
});

test('ADC absolute', () => {
  const { cpu, memory } = createCPU();
  memory.writeByte(0x1234, 0x05);
  loadProgram(cpu, memory, [0xA9, 0x10, 0x6D, 0x34, 0x12]); // LDA #$10; ADC $1234

  cpu.step(); // LDA
  cpu.step(); // ADC
  assertEqual(cpu.A, 0x15);
});

test('SBC immediate', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xA9, 0x20, 0xE9, 0x10]); // LDA #$20; SBC #$10

  cpu.setFlag('C', true); // Set carry to indicate no borrow initially
  cpu.step(); // LDA
  cpu.step(); // SBC
  assertEqual(cpu.A, 0x10);
  assertEqual(cpu.getFlag('C'), true); // No borrow
});

test('SBC immediate with borrow', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xA9, 0x10, 0xE9, 0x20]); // LDA #$10; SBC #$20

  cpu.setFlag('C', true); // Set carry to indicate no borrow initially
  cpu.step(); // LDA
  cpu.step(); // SBC
  assertEqual(cpu.A, 0xF0);
  assertEqual(cpu.getFlag('C'), false); // Borrow occurred
});

test('INC absolute', () => {
  const { cpu, memory } = createCPU();
  memory.writeByte(0x0700, 0x42);
  loadProgram(cpu, memory, [0xEE, 0x00, 0x07]); // INC $0700

  cpu.step();
  assertEqual(memory.readByte(0x0700), 0x43);
  assertEqual(cpu.getFlag('Z'), false);
  assertEqual(cpu.getFlag('N'), false);
});

test('INC zero page', () => {
  const { cpu, memory } = createCPU();
  memory.writeByte(0x42, 0xFF);
  loadProgram(cpu, memory, [0xE6, 0x42]); // INC $42

  cpu.step();
  assertEqual(memory.readByte(0x42), 0x00);
  assertEqual(cpu.getFlag('Z'), true);
  assertEqual(cpu.getFlag('N'), false);
});

test('DEC absolute', () => {
  const { cpu, memory } = createCPU();
  memory.writeByte(0x0700, 0x42);
  loadProgram(cpu, memory, [0xCE, 0x00, 0x07]); // DEC $0700

  cpu.step();
  assertEqual(memory.readByte(0x0700), 0x41);
  assertEqual(cpu.getFlag('Z'), false);
  assertEqual(cpu.getFlag('N'), false);
});

test('DEC zero page', () => {
  const { cpu, memory } = createCPU();
  memory.writeByte(0x42, 0x01);
  loadProgram(cpu, memory, [0xC6, 0x42]); // DEC $42

  cpu.step();
  assertEqual(memory.readByte(0x42), 0x00);
  assertEqual(cpu.getFlag('Z'), true);
  assertEqual(cpu.getFlag('N'), false);
});

// Test logic instructions
test('AND immediate', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xA9, 0x0F, 0x29, 0xF0]); // LDA #$0F; AND #$F0

  cpu.step(); // LDA
  cpu.step(); // AND
  assertEqual(cpu.A, 0x00);
  assertEqual(cpu.getFlag('Z'), true);
  assertEqual(cpu.getFlag('N'), false);
});

test('AND absolute', () => {
  const { cpu, memory } = createCPU();
  memory.writeByte(0x0700, 0xAA);
  loadProgram(cpu, memory, [0xA9, 0x55, 0x2D, 0x00, 0x07]); // LDA #$55; AND $0700

  cpu.step(); // LDA
  cpu.step(); // AND
  assertEqual(cpu.A, 0x00);
  assertEqual(cpu.getFlag('Z'), true);
});

test('ORA immediate', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xA9, 0x0F, 0x09, 0xF0]); // LDA #$0F; ORA #$F0

  cpu.step(); // LDA
  cpu.step(); // ORA
  assertEqual(cpu.A, 0xFF);
  assertEqual(cpu.getFlag('Z'), false);
  assertEqual(cpu.getFlag('N'), true);
});

test('EOR immediate', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xA9, 0xAA, 0x49, 0x55]); // LDA #$AA; EOR #$55

  cpu.step(); // LDA
  cpu.step(); // EOR
  assertEqual(cpu.A, 0xFF);
  assertEqual(cpu.getFlag('Z'), false);
  assertEqual(cpu.getFlag('N'), true);
});

// Test control flow
test('JMP absolute', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0x4C, 0x00, 0x08]); // JMP $0800

  cpu.step();
  assertEqual(cpu.PC, 0x0800);
});

test('BEQ taken', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xA9, 0x00, 0xF0, 0x05]); // LDA #$00; BEQ +5

  cpu.step(); // LDA (sets Z=1)
  cpu.step(); // BEQ taken
  assertEqual(cpu.PC, 0x0604 + 0x05); // PC was at 0x0604 after BEQ opcode
});

test('BEQ not taken', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xA9, 0x01, 0xF0, 0x05]); // LDA #$01; BEQ +5

  cpu.step(); // LDA (sets Z=0)
  cpu.step(); // BEQ not taken
  assertEqual(cpu.PC, 0x0604); // PC at next instruction
});

test('BNE taken', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xA9, 0x01, 0xD0, 0x05]); // LDA #$01; BNE +5

  cpu.step(); // LDA (sets Z=0)
  cpu.step(); // BNE taken
  assertEqual(cpu.PC, 0x0604 + 0x05);
});

test('BNE not taken', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xA9, 0x00, 0xD0, 0x05]); // LDA #$00; BNE +5

  cpu.step(); // LDA (sets Z=1)
  cpu.step(); // BNE not taken
  assertEqual(cpu.PC, 0x0604);
});

test('BCS taken', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xB0, 0x05]); // BCS +5

  cpu.setFlag('C', true);
  cpu.step();
  assertEqual(cpu.PC, 0x0602 + 0x05);
});

test('BCS not taken', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xB0, 0x05]); // BCS +5

  cpu.setFlag('C', false);
  cpu.step();
  assertEqual(cpu.PC, 0x0602);
});

// Test stack operations
test('PHA PLA', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xA9, 0x42, 0x48, 0xA9, 0x00, 0x68]); // LDA #$42; PHA; LDA #$00; PLA

  cpu.step(); // LDA #$42
  assertEqual(cpu.A, 0x42);
  cpu.step(); // PHA
  assertEqual(memory.readByte(0x01FF), 0x42); // Stack top
  assertEqual(cpu.SP, 0xFE);
  cpu.step(); // LDA #$00
  assertEqual(cpu.A, 0x00);
  cpu.step(); // PLA
  assertEqual(cpu.A, 0x42);
  assertEqual(cpu.SP, 0xFF);
  assertEqual(cpu.getFlag('Z'), false);
  assertEqual(cpu.getFlag('N'), false);
});

test('PLA zero flag', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xA9, 0x00, 0x48, 0xA9, 0xFF, 0x68]); // LDA #$00; PHA; LDA #$FF; PLA

  cpu.step(); // LDA #$00
  cpu.step(); // PHA
  cpu.step(); // LDA #$FF
  cpu.step(); // PLA
  assertEqual(cpu.A, 0x00);
  assertEqual(cpu.getFlag('Z'), true);
  assertEqual(cpu.getFlag('N'), false);
});

test('PLA negative flag', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xA9, 0x80, 0x48, 0xA9, 0x00, 0x68]); // LDA #$80; PHA; LDA #$00; PLA

  cpu.step(); // LDA #$80
  cpu.step(); // PHA
  cpu.step(); // LDA #$00
  cpu.step(); // PLA
  assertEqual(cpu.A, 0x80);
  assertEqual(cpu.getFlag('Z'), false);
  assertEqual(cpu.getFlag('N'), true);
});

// Test video instructions (stubs)
test('VLD stub', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0x8B, 0x01]); // VLD #$01

  cpu.step();
  assertEqual(cpu.getFlag('C'), true); // Success flag
});

test('VST stub', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0x9B, 0x01]); // VST #$01

  cpu.step();
  assertEqual(cpu.getFlag('C'), true); // Success flag
});

test('VUP stub', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xAB]); // VUP

  cpu.step();
  assertEqual(cpu.getFlag('C'), true); // Success flag
});

test('VDL stub', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xBB, 0x10]); // VDL #$10

  cpu.step();
  assertEqual(cpu.getFlag('C'), true); // Success flag
});

// Test HLT
test('HLT stops execution', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0x3A]); // HLT

  assertEqual(cpu.running, true);
  cpu.step();
  assertEqual(cpu.running, false);
});

// Test flag operations
test('setFlag and getFlag', () => {
  const { cpu } = createCPU();

  cpu.setFlag('C', true);
  assertEqual(cpu.getFlag('C'), true);

  cpu.setFlag('Z', true);
  assertEqual(cpu.getFlag('Z'), true);

  cpu.setFlag('N', true);
  assertEqual(cpu.getFlag('N'), true);

  cpu.setFlag('V', true);
  assertEqual(cpu.getFlag('V'), true);

  cpu.setFlag('C', false);
  assertEqual(cpu.getFlag('C'), false);
});

// Test register operations
test('LDX immediate', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xA2, 0x42]); // LDX #$42

  cpu.step();
  assertEqual(cpu.X, 0x42);
  assertEqual(cpu.getFlag('Z'), false);
  assertEqual(cpu.getFlag('N'), false);
});

test('LDX zero', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xA2, 0x00]); // LDX #$00

  cpu.step();
  assertEqual(cpu.X, 0x00);
  assertEqual(cpu.getFlag('Z'), true);
  assertEqual(cpu.getFlag('N'), false);
});

test('LDY immediate', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xA0, 0x42]); // LDY #$42

  cpu.step();
  assertEqual(cpu.Y, 0x42);
  assertEqual(cpu.getFlag('Z'), false);
  assertEqual(cpu.getFlag('N'), false);
});

test('STX absolute', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xA2, 0x42, 0x8E, 0x00, 0x07]); // LDX #$42; STX $0700

  cpu.step(); // LDX
  cpu.step(); // STX
  assertEqual(memory.readByte(0x0700), 0x42);
});

test('STY zero page', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xA0, 0x42, 0x84, 0x42]); // LDY #$42; STY $42

  cpu.step(); // LDY
  cpu.step(); // STY
  assertEqual(memory.readByte(0x42), 0x42);
});

// Test overflow flag in ADC
test('ADC overflow positive', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xA9, 0x7F, 0x69, 0x01]); // LDA #$7F; ADC #$01

  cpu.step(); // LDA
  cpu.step(); // ADC
  assertEqual(cpu.A, 0x80);
  assertEqual(cpu.getFlag('V'), true);
  assertEqual(cpu.getFlag('N'), true);
});

test('ADC overflow negative', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xA9, 0x80, 0x69, 0xFF]); // LDA #$80; ADC #$FF

  cpu.step(); // LDA
  cpu.step(); // ADC
  assertEqual(cpu.A, 0x7F);
  assertEqual(cpu.getFlag('V'), true);
  assertEqual(cpu.getFlag('N'), false);
});

// Test unknown opcodes are treated as NOP
test('unknown opcode NOP', () => {
  const { cpu, memory } = createCPU();
  loadProgram(cpu, memory, [0xFF]); // Unknown opcode

  const initialPC = cpu.PC;
  cpu.step();
  assertEqual(cpu.PC, initialPC + 1);
});

// Summary
console.log(`\nCPU Instruction tests completed: ${testsPassed} passed, ${testsFailed} failed`);
if (testsFailed === 0) {
  console.log('All CPU instruction tests passed!');
} else {
  console.error(`${testsFailed} CPU instruction tests failed!`);
}
