
/**
 * Comprehensive CPU Tests for iMaCoMpUtERussy Emulator
 * Tests load/store, arithmetic, logic, comparison, branch, and video I/O instructions
 * Compatible with custom runTest framework
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

console.log('Running iMaCoMpUtERussy CPU Comprehensive Tests...\n');

// Load/Store Instructions Tests
runTest('LDA immediate loads accumulator and sets flags correctly', () => {
  const cpu = new iMaCoMpUtERussyCPU();
  const memory = new iMaCoMpUtERussyMemory();
  cpu.memory = memory;

  // Program: LDA #$42 (0xA9 0x42)
  memory
