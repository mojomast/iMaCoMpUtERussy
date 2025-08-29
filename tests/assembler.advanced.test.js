// ES Module for advanced assembler tests: indexed addressing and expression evaluation
import { assemble } from '../js/assembler.js';

// Helper function to run a test and log result
function test(name, testFn) {
  try {
    testFn();
    console.log(`PASS: ${name}`);
  } catch (e) {
    console.error(`FAIL: ${name} - ${e.message}`);
  }
}

// Test indexed addressing modes
function testIndexedAddressing() {
  // Test absolute indexed X: $1234,X
  const source1 = `
.org 0x0600
LDA $1234,X
HLT
  `;
  const bytes1 = assemble(source1);
  const expected1 = [0xBD, 0x34, 0x12, 0x3A]; // LDA absx, HLT
  if (bytes1.length !== 4 || !expected1.every((b, i) => b === bytes1[i])) {
    throw new Error('Indexed X addressing failed');
  }

  // Test zero-page indexed Y: $12,Y
  const source2 = `
.org 0x0600
LDA $12,Y
HLT
  `;
  const bytes2 = assemble(source2);
  const expected2 = [0xB1, 0x12, 0x3A];
  if (bytes2.length !== 3 || !expected2.every((b, i) => b === bytes2[i])) {
    throw new Error('Zero-page Y addressing failed');
  }

  // Test absolute indexed Y: $1234,Y
  const source3 = `
.org 0x0600
LDA $1234,Y
HLT
  `;
  const bytes3 = assemble(source3);
  const expected3 = [0xB9, 0x34, 0x12, 0x3A];
  if (bytes3.length !== 4 || !expected3.every((b, i) => b === bytes3[i])) {
    throw new Error('Absolute Y addressing failed');
  }

  // Test zero-page indexed X: $12,X
  const source4 = `
.org 0x0600
LDA $12,X
HLT
  `;
  const bytes4 = assemble(source4);
  const expected4 = [0xB5, 0x12, 0x3A];
  if (bytes4.length !== 3 || !expected4.every((b, i) => b === bytes4[i])) {
    throw new Error('Zero-page X addressing failed');
  }
}

// Test expression evaluation
function testExpressionEvaluation() {
  // Test immediate expression: #$10+5
  const source1 = `
.org 0x0600
LDA #$10+5
HLT
  `;
  const bytes1 = assemble(source1);
  const expected1 = [0xA9, 21, 0x3A]; // #$10+5 = 21
  if (bytes1.length !== 3 || !expected1.every((b, i) => b === bytes1[i])) {
    throw new Error('Immediate expression failed');
  }

  // Test absolute expression: STA $0200+offset (define offset)
  const source2 = `
.org 0x0600
offset = 10
STA $0200+offset
HLT
  `;
  const bytes2 = assemble(source2);
  const expected2 = [0x8D, 0x0A, 0x02, 0x3A]; // $0200+10 = $020A
  if (bytes2.length !== 4 || !expected2.every((b, i) => b === bytes2[i])) {
    throw new Error('Absolute expression failed');
  }

  // Test jump expression: JMP loop+2
  const source3 = `
.org 0x0600
loop: LDA #0
JMP loop+2
HLT
  `;
  const bytes3 = assemble(source3);
  const expected3 = [0xA9, 0x00, 0x4C, 0x02, 0x06, 0x3A]; // loop at 0x0600, loop+2=0x0602, JMP 0x0602
  if (bytes3.length !== 6 || !expected3.every((b, i) => b === bytes3[i])) {
    throw new Error('Jump expression failed');
  }
}

// Test expressions with labels
function testExpressionsWithLabels() {
  // LDA #count+1
  const source1 = `
.org 0x0600
count = 5
LDA #count+1
HLT
  `;
  const bytes1 = assemble(source1);
  const expected1 = [0xA9, 6, 0x3A]; // 5+1=6
  if (bytes1.length !== 3 || !expected1.every((b, i) => b === bytes1[i])) {
    throw new Error('Expression with label failed');
  }

  // STA buffer+X (buffer label)
  const source2 = `
.org 0x0600
buffer = $0200
LDX #0
STA buffer,X
HLT
  `;
  const bytes2 = assemble(source2);
  const expected2 = [0xA2, 0x00, 0x9D, 0x00, 0x02, 0x3A]; // STA absx $0200,X
  if (bytes2.length !== 6 || !expected2.every((b, i) => b === bytes2[i])) {
    throw new Error('Indexed with label failed');
  }
}

// Test error handling
function testErrorHandling() {
  // Malformed indexed operand: $1234,Z (invalid index)
  try {
    const source1 = `
.org 0x0600
LDA $1234,Z
    `;
    assemble(source1);
    throw new Error('Should have thrown for invalid index');
  } catch (e) {
    if (!e.message.includes('Invalid index register')) {
      throw new Error('Wrong error for invalid index');
    }
  }

  // Invalid expression: #$10++5
  try {
    const source2 = `
.org 0x0600
LDA #$10++5
    `;
    assemble(source2);
    throw new Error('Should have thrown for invalid expression');
  } catch (e) {
    if (!e.message.includes('Invalid expression')) {
      throw new Error('Wrong error for invalid expression');
    }
  }

  // Undefined label in expression
  try {
    const source3 = `
.org 0x0600
LDA #undefined+1
    `;
    assemble(source3);
    throw new Error('Should have thrown for undefined label');
  } catch (e) {
    if (!e.message.includes('Undefined label')) {
      throw new Error('Wrong error for undefined label');
    }
  }
}

// Test mixed features: indexed addressing with expressions
function testMixedFeatures() {
  // STA $0200+offset,X
  const source1 = `
.org 0x0600
offset = 10
STA $0200+offset,X
HLT
  `;
  const bytes1 = assemble(source1);
  const expected1 = [0x9D, 0x0A, 0x02, 0x3A]; // STA absx $020A,X
  if (bytes1.length !== 4 || !expected1.every((b, i) => b === bytes1[i])) {
    throw new Error('Mixed indexed expression failed');
  }

  // LDA buffer+count,Y
  const source2 = `
.org 0x0600
buffer = $0200
count = 5
LDA buffer+count,Y
HLT
  `;
  const bytes2 = assemble(source2);
  const expected2 = [0xB9, 0x05, 0x02, 0x3A]; // LDA absy $0205,Y
  if (bytes2.length !== 4 || !expected2.every((b, i) => b === bytes2[i])) {
    throw new Error('Mixed label expression failed');
  }
}

// Run all tests
test('Indexed Addressing', testIndexedAddressing);
test('Expression Evaluation', testExpressionEvaluation);
test('Expressions with Labels', testExpressionsWithLabels);
test('Error Handling', testErrorHandling);
test('Mixed Features', testMixedFeatures);

// TODO: Add tests for indirect addressing modes ((ind),X ; (ind),Y)
// TODO: Add tests for more expression operators (*, /, parentheses)
// TODO: Add tests for macro expansions and include directives
// TODO: Add performance benchmarks for large assemblies
