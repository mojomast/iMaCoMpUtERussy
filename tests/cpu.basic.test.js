/**
 * Basic CPU Tests for VideoStorage-8
 * Tests fundamental CPU operations: LDA, STA, PHA, PLA
 */

import { iMaCoMpUtERussyCPU } from '../js/cpu.js';
import { iMaCoMpUtERussyMemory } from '../js/memory.js';

// Simple test runner
function runTest(testName, testFunction) {
    try {
        testFunction();
        console.log(`PASS: ${testName}`);
    } catch (error) {
        console.log(`FAIL: ${testName} - ${error.message}`);
    }
}

console.log('Running VideoStorage-8 CPU Basic Tests...\n');

// Test 1: LDA immediate loads accumulator and sets flags
runTest('LDA immediate', () => {
    const cpu = new iMaCoMpUtERussyCPU();
    const memory = new iMaCoMpUtERussyMemory();
    cpu.memory = memory;

    // Program: LDA #$42 (A9 42)
    memory.writeByte(0x0600, 0xA9); // LDA immediate
    memory.writeByte(0x0601, 0x42); // value 0x42

    cpu.PC = 0x0600;
    cpu.executeInstruction();

    if (cpu.A !== 0x42) throw new Error(`Expected A=0x42, got A=0x${cpu.A.toString(16)}`);
    if (cpu.getFlag('Z')) throw new Error('Zero flag should be clear for non-zero value');
    if (cpu.getFlag('N')) throw new Error('Negative flag should be clear for positive value');
});

// Test 2: STA stores accumulator to memory
runTest('STA zero page', () => {
    const cpu = new iMaCoMpUtERussyCPU();
    const memory = new iMaCoMpUtERussyMemory();
    cpu.memory = memory;

    cpu.A = 0xAB;

    // Program: STA $10 (85 10)
    memory.writeByte(0x0600, 0x85); // STA zero page
    memory.writeByte(0x0601, 0x10); // address 0x10

    cpu.PC = 0x0600;
    cpu.executeInstruction();

    const storedValue = memory.readByte(0x10);
    if (storedValue !== 0xAB) throw new Error(`Expected memory[0x10]=0xAB, got 0x${storedValue.toString(16)}`);
});

// Test 3: PHA/PLA push and pop behavior
runTest('PHA/PLA stack operations', () => {
    const cpu = new iMaCoMpUtERussyCPU();
    const memory = new iMaCoMpUtERussyMemory();
    cpu.memory = memory;

    cpu.A = 0x55;
    const originalSP = cpu.SP;

    // Program: PHA (48)
    memory.writeByte(0x0600, 0x48); // PHA

    cpu.PC = 0x0600;
    cpu.executeInstruction();

    // Check stack pointer decremented
    if (cpu.SP !== (originalSP - 1) & 0xFF) throw new Error('Stack pointer not decremented correctly');

    // Check value on stack
    const stackValue = memory.readByte(0x0100 + cpu.SP + 1);
    if (stackValue !== 0x55) throw new Error(`Expected stack value 0x55, got 0x${stackValue.toString(16)}`);

    // Now PLA
    memory.writeByte(0x0601, 0x68); // PLA
    cpu.PC = 0x0601;
    cpu.executeInstruction();

    // Check accumulator restored
    if (cpu.A !== 0x55) throw new Error(`Expected A=0x55 after PLA, got A=0x${cpu.A.toString(16)}`);

    // Check stack pointer restored
    if (cpu.SP !== originalSP) throw new Error('Stack pointer not restored correctly');
});

// Test 4: LDA zero flag
runTest('LDA sets zero flag', () => {
    const cpu = new iMaCoMpUtERussyCPU();
    const memory = new iMaCoMpUtERussyMemory();
    cpu.memory = memory;

    // Program: LDA #$00 (A9 00)
    memory.writeByte(0x0600, 0xA9); // LDA immediate
    memory.writeByte(0x0601, 0x00); // value 0x00

    cpu.PC = 0x0600;
    cpu.executeInstruction();

    if (cpu.A !== 0x00) throw new Error(`Expected A=0x00, got A=0x${cpu.A.toString(16)}`);
    if (!cpu.getFlag('Z')) throw new Error('Zero flag should be set for zero value');
});

// Test 5: LDA negative flag
runTest('LDA sets negative flag', () => {
    const cpu = new iMaCoMpUtERussyCPU();
    const memory = new iMaCoMpUtERussyMemory();
    cpu.memory = memory;

    // Program: LDA #$FF (A9 FF)
    memory.writeByte(0x0600, 0xA9); // LDA immediate
    memory.writeByte(0x0601, 0xFF); // value 0xFF

    cpu.PC = 0x0600;
    cpu.executeInstruction();

    if (cpu.A !== 0xFF) throw new Error(`Expected A=0xFF, got A=0x${cpu.A.toString(16)}`);
    if (!cpu.getFlag('N')) throw new Error('Negative flag should be set for negative value');
});

console.log('\nCPU Basic Tests Complete!');
