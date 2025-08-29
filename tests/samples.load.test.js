// Samples load tests - plain JS ES module
// Run with: node tests/samples.load.test.js or in browser with type="module"

import { assemble } from '../js/assembler.js';
import { iMaCoMpUtERussyMemory } from '../js/memory.js';

// TODO: Expand to test loading multiple samples
// TODO: Test loadProgram with different origins and sizes
// TODO: Test memory.readWord and other memory methods
// TODO: Add tests for video buffer region specifically
// TODO: Integrate with test runner

console.log('Running samples.load.test.js...');

try {
    // Test: Assemble a program, load into memory, verify first byte
    const source = `
.org 0x0600
LDA #42
STA 0x00
HLT
    `;
    const bytes = assemble(source);
    const memory = new iMaCoMpUtERussyMemory();

    const origin = 0x0600;
    const written = memory.loadProgram(origin, bytes);
    const firstByte = memory.readByte(origin);

    const pass = written === bytes.length && firstByte === bytes[0];
    console.log(pass ? 'PASS' : 'FAIL', 'Test: Load program - written:', written, 'first byte:', firstByte, 'expected:', bytes[0]);

    if (pass) {
        console.log('All samples load tests PASSED');
    } else {
        console.log('Samples load tests FAILED');
    }
} catch (error) {
    console.error('Samples load test error:', error.message);
    console.log('Samples load tests FAILED due to error');
}
