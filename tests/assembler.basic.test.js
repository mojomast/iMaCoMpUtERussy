// Basic assembler tests - plain JS ES module
// Run with: node tests/assembler.basic.test.js or in browser with type="module"

import { assemble } from '../js/assembler.js';

// TODO: Expand to test more opcodes, addressing modes, directives
// TODO: Add error handling tests for invalid syntax
// TODO: Test labels and branching
// TODO: Integrate with test runner like Jest or Mocha

console.log('Running assembler.basic.test.js...');

try {
    // Test 1: Assemble a basic program returns Uint8Array with length > 0
    const source1 = `
.org 0x0600
LDA #10
STA 0x00
HLT
    `;
    const bytes1 = assemble(source1);
    const pass1 = bytes1 instanceof Uint8Array && bytes1.length > 0;
    console.log(pass1 ? 'PASS' : 'FAIL', 'Test 1: Assemble basic program - length > 0:', bytes1.length);

    // Test 2: Assemble inline program produces expected byte sequence
    const source2 = 'LDA #10\nSTA 0x00\nHLT';
    const bytes2 = assemble(source2, { origin: 0x0600 });
    const expected = [0xA9, 10, 0x85, 0x00, 0x3A]; // LDA #10, STA $00 zp, HLT
    const pass2 = bytes2.length === expected.length && expected.every((b, i) => b === bytes2[i]);
    console.log(pass2 ? 'PASS' : 'FAIL', 'Test 2: Expected bytes - assembled:', Array.from(bytes2), 'expected:', expected);

    if (pass1 && pass2) {
        console.log('All assembler tests PASSED');
    } else {
        console.log('Some assembler tests FAILED');
    }
} catch (error) {
    console.error('Assembler test error:', error.message);
    console.log('Assembler tests FAILED due to error');
}
