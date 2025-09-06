/* global console */
/* eslint-env node */

import { iMaCoMpUtERussyCPU } from '../js/cpu.js';
import { iMaCoMpUtERussyMemory } from '../js/memory.js';

/**
 * Standalone VLD Instruction Test
 * Tests the VLD #$0 (checkerboard pattern) instruction loads correct pattern to video buffer
 */

console.log('Running VLD Instruction Test...\n');

const cpu = new iMaCoMpUtERussyCPU();
const memory = new iMaCoMpUtERussyMemory();
cpu.memory = memory;

// Program: VLD #$0 (0x8B 0x00) - load checkerboard pattern
memory.writeByte(0x0000, 0x8B); // VLD opcode
memory.writeByte(0x0001, 0x00); // blockIndex 0 (checkerboard)

cpu.PC = 0x0000;
cpu.executeInstruction(); // Execute VLD

// Verify C flag is 0 (success)
if (cpu.getFlag('C')) {
    console.log('FAIL: C flag should be 0 after successful VLD');
    process.exit(1);
}

// Verify video buffer 0x0200-0x05FF contains checkerboard pattern
// Checkerboard: alternating 0x00/0x03, repeated across 1024 bytes
let pass = true;
for (let i = 0; i < 1024; i++) {
    const addr = 0x0200 + i;
    const expected = (i % 2 === 0) ? 0x00 : 0x03;
    const actual = memory.readByte(addr);
    if (actual !== expected) {
        console.log(`FAIL: Memory[0x${addr.toString(16).padStart(4, '0')}] = 0x${actual.toString(16).padStart(2, '0')}, expected 0x${expected.toString(16).padStart(2, '0')}`);
        pass = false;
        break; // Fail on first mismatch
    }
}

if (pass) {
    console.log('PASS: VLD #$0 successfully loaded checkerboard pattern to video buffer 0x0200-0x05FF');
    console.log('Verification: First 16 bytes should be: 00 03 00 03 00 03 00 03 00 03 00 03 00 03 00 03');
    console.log('Actual first 16 bytes:', Array.from({length: 16}, (_, i) => 
        `0x${memory.readByte(0x0200 + i).toString(16).padStart(2, '0')}`
    ).join(' '));
} else {
    console.log('FAIL: VLD pattern verification failed');
    process.exit(1);
}

// Test invalid index
memory.writeByte(0x0002, 0x8B); // VLD opcode
memory.writeByte(0x0003, 0x10); // blockIndex 16 (invalid)
cpu.PC = 0x0002;
cpu.executeInstruction();

if (!cpu.getFlag('C')) {
    console.log('FAIL: C flag should be 1 after invalid VLD index');
    process.exit(1);
}

console.log('PASS: VLD with invalid index sets C flag to 1');
console.log('\nAll VLD tests passed!');