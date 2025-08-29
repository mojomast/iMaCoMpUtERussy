/**
 * iMaCoMpUtERussy Memory Module Basic Tests
 * ES module with console-based PASS/FAIL reporting
 * Kyle Durepos - iMaCoMpUtERussy Project
 */

// TODO: Add performance benchmarks for memory operations
// TODO: Test memory persistence and restoration
// TODO: Add stress tests for large memory operations
// TODO: Test memory with different buffer sizes

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

function assertThrows(fn, errorType, message = '') {
  try {
    fn();
    throw new Error(`${message} Expected ${errorType.name} to be thrown`);
  } catch (e) {
    if (!(e instanceof errorType)) {
      throw new Error(`${message} Expected ${errorType.name}, got ${e.constructor.name}`);
    }
  }
}

// Test basic read/write byte operations
test('readByte/writeByte basic', () => {
  const mem = new iMaCoMpUtERussyMemory();
  mem.writeByte(0x0600, 0x42);
  assertEqual(mem.readByte(0x0600), 0x42);
});

test('readByte/writeByte bounds checking', () => {
  const mem = new iMaCoMpUtERussyMemory();
  assertThrows(() => mem.readByte(-1), RangeError);
  assertThrows(() => mem.readByte(0x10000), RangeError);
  assertThrows(() => mem.writeByte(-1, 0), RangeError);
  assertThrows(() => mem.writeByte(0x10000, 0), RangeError);
});

test('writeByte value masking', () => {
  const mem = new iMaCoMpUtERussyMemory();
  mem.writeByte(0x0600, 0x123); // Should be masked to 0x23
  assertEqual(mem.readByte(0x0600), 0x23);
  mem.writeByte(0x0601, -1); // Should be masked to 0xFF
  assertEqual(mem.readByte(0x0601), 0xFF);
});

// Test little-endian word operations
test('readWord/writeWord little-endian', () => {
  const mem = new iMaCoMpUtERussyMemory();
  mem.writeWord(0x0600, 0x1234);
  assertEqual(mem.readByte(0x0600), 0x34); // Low byte
  assertEqual(mem.readByte(0x0601), 0x12); // High byte
  assertEqual(mem.readWord(0x0600), 0x1234);
});

test('readWord/writeWord wrapping', () => {
  const mem = new iMaCoMpUtERussyMemory({ allowRomWrites: true });
  mem.writeWord(0xFFFE, 0xABCD); // Should wrap around to FFFE and FFFF
  assertEqual(mem.readByte(0xFFFE), 0xCD); // Low byte at FFFE
  assertEqual(mem.readByte(0xFFFF), 0xAB); // High byte at FFFF
  assertEqual(mem.readWord(0xFFFE), 0xABCD);
});

test('writeWord value masking', () => {
  const mem = new iMaCoMpUtERussyMemory();
  mem.writeWord(0x0600, 0x12345); // Should be masked to 0x2345
  assertEqual(mem.readWord(0x0600), 0x2345);
});

// Test loadProgram
test('loadProgram basic', () => {
  const mem = new iMaCoMpUtERussyMemory();
  const program = new Uint8Array([0xA9, 0x42, 0x8D, 0x00, 0x06]);
  const written = mem.loadProgram(0x0600, program);
  assertEqual(written, 5);
  assertEqual(mem.readByte(0x0600), 0xA9);
  assertEqual(mem.readByte(0x0604), 0x06);
});

test('loadProgram with array', () => {
  const mem = new iMaCoMpUtERussyMemory();
  const program = [0xA9, 0x42, 0x8D, 0x00, 0x06];
  const written = mem.loadProgram(0x0600, program);
  assertEqual(written, 5);
});

test('loadProgram bounds', () => {
  const mem = new iMaCoMpUtERussyMemory({ allowRomWrites: true });
  const program = new Uint8Array([0xA9, 0x42]);
  const written = mem.loadProgram(0xFFFF, program);
  assertEqual(written, 1); // Only first byte fits at 0xFFFF
  assertEqual(mem.readByte(0xFFFF), 0xA9);
});

test('loadProgram invalid input', () => {
  const mem = new iMaCoMpUtERussyMemory();
  assertThrows(() => mem.loadProgram(0x0600, null), TypeError);
  assertThrows(() => mem.loadProgram(0x0600, {}), TypeError);
});

// Test region operations
test('clearRegion basic', () => {
  const mem = new iMaCoMpUtERussyMemory();
  mem.writeByte(0x0600, 0x42);
  mem.writeByte(0x0605, 0xFF);
  mem.clearRegion(0x0600, 0x0605, 0xAA);
  assertEqual(mem.readByte(0x0600), 0xAA);
  assertEqual(mem.readByte(0x0605), 0xAA);
});

test('clearRegion invalid range', () => {
  const mem = new iMaCoMpUtERussyMemory();
  assertThrows(() => mem.clearRegion(0x0605, 0x0600), RangeError);
});

// Test ROM protection
test('ROM protection default (ignore)', () => {
  const mem = new iMaCoMpUtERussyMemory();
  const originalValue = mem.readByte(0x8000);
  mem.writeByte(0x8000, 0x42); // Should be ignored
  assertEqual(mem.readByte(0x8000), originalValue); // Unchanged
});

test('ROM protection readonly', () => {
  const mem = new iMaCoMpUtERussyMemory({ readonlyROM: true });
  assertThrows(() => mem.writeByte(0x8000, 0x42), Error);
});

test('clearRegion ROM protection', () => {
  const mem = new iMaCoMpUtERussyMemory();
  const originalValue = mem.readByte(0x8000);
  mem.clearRegion(0x8000, 0x8000, 0x42); // Should be ignored
  assertEqual(mem.readByte(0x8000), originalValue);
});

test('clearRegion ROM readonly', () => {
  const mem = new iMaCoMpUtERussyMemory({ readonlyROM: true });
  assertThrows(() => mem.clearRegion(0x8000, 0x8000, 0x42), Error);
});

// Test watcher API
test('watcher API basic', () => {
  const mem = new iMaCoMpUtERussyMemory();
  let called = false;
  let capturedAddr = -1;
  let capturedValue = -1;

  mem.addWriteListener((addr, value) => {
    called = true;
    capturedAddr = addr;
    capturedValue = value;
  });

  mem.writeByte(0x0600, 0x42);
  assertEqual(called, true);
  assertEqual(capturedAddr, 0x0600);
  assertEqual(capturedValue, 0x42);
});

test('watcher API multiple listeners', () => {
  const mem = new iMaCoMpUtERussyMemory();
  let callCount = 0;

  mem.addWriteListener(() => callCount++);
  mem.addWriteListener(() => callCount++);

  mem.writeByte(0x0600, 0x42);
  assertEqual(callCount, 2);
});

test('watcher API remove listener', () => {
  const mem = new iMaCoMpUtERussyMemory();
  let callCount = 0;

  const listener = () => callCount++;
  mem.addWriteListener(listener);
  mem.writeByte(0x0600, 0x42);
  assertEqual(callCount, 1);

  mem.removeWriteListener(listener);
  mem.writeByte(0x0601, 0x43);
  assertEqual(callCount, 1); // Should not have increased
});

test('watcher API invalid callback', () => {
  const mem = new iMaCoMpUtERussyMemory();
  assertThrows(() => mem.addWriteListener(null), TypeError);
  assertThrows(() => mem.addWriteListener({}), TypeError);
});

// Test hex dump
test('toHexDump basic', () => {
  const mem = new iMaCoMpUtERussyMemory();
  mem.writeByte(0x0600, 0xAB);
  mem.writeByte(0x0601, 0xCD);
  const dump = mem.toHexDump(0x0600, 2);
  assertEqual(dump.includes('0600: ab cd'), true);
});

test('toHexDump invalid parameters', () => {
  const mem = new iMaCoMpUtERussyMemory();
  assertThrows(() => mem.toHexDump(0x0600, -1), TypeError);
  assertThrows(() => mem.toHexDump(0x0600, 'invalid'), TypeError);
});

// Test region constants
test('region constants available', () => {
  const mem = new iMaCoMpUtERussyMemory();
  assertEqual(mem.ZERO_PAGE, 0x0000);
  assertEqual(mem.STACK_PAGE, 0x0100);
  assertEqual(mem.VIDEO_BUFFER_START, 0x0200);
  assertEqual(mem.USER_RAM_START, 0x0600);
  assertEqual(mem.VIDEO_ROM_START, 0x8000);
  assertEqual(mem.SYSTEM_ROM_START, 0xC000);
});

// Test copyRegion
test('copyRegion basic', () => {
  const mem = new iMaCoMpUtERussyMemory();
  mem.writeByte(0x0600, 0x11);
  mem.writeByte(0x0601, 0x22);
  mem.writeByte(0x0602, 0x33);

  const copied = mem.copyRegion(0x0600, 0x0700, 3);
  assertEqual(copied, 3);
  assertEqual(mem.readByte(0x0700), 0x11);
  assertEqual(mem.readByte(0x0701), 0x22);
  assertEqual(mem.readByte(0x0702), 0x33);
});

test('copyRegion overlapping forward', () => {
  const mem = new iMaCoMpUtERussyMemory();
  mem.writeByte(0x0600, 0x11);
  mem.writeByte(0x0601, 0x22);
  mem.writeByte(0x0602, 0x33);

  const copied = mem.copyRegion(0x0600, 0x0601, 2);
  assertEqual(copied, 2);
  assertEqual(mem.readByte(0x0600), 0x11); // Unchanged
  assertEqual(mem.readByte(0x0601), 0x11); // Copied from 0600
  assertEqual(mem.readByte(0x0602), 0x22); // Copied from 0601
});

test('copyRegion overlapping backward', () => {
  const mem = new iMaCoMpUtERussyMemory();
  mem.writeByte(0x0600, 0x11);
  mem.writeByte(0x0601, 0x22);
  mem.writeByte(0x0602, 0x33);

  const copied = mem.copyRegion(0x0601, 0x0600, 2);
  assertEqual(copied, 2);
  assertEqual(mem.readByte(0x0600), 0x22); // Copied from 0601
  assertEqual(mem.readByte(0x0601), 0x33); // Copied from 0602
  assertEqual(mem.readByte(0x0602), 0x33); // Unchanged
});

// Test searchBytes
test('searchBytes basic', () => {
  const mem = new iMaCoMpUtERussyMemory();
  mem.writeByte(0x0600, 0x11);
  mem.writeByte(0x0601, 0x22);
  mem.writeByte(0x0602, 0x33);
  mem.writeByte(0x0603, 0x11);
  mem.writeByte(0x0604, 0x22);

  const addr = mem.searchBytes([0x11, 0x22], 0x0600, 0x0605);
  assertEqual(addr, 0x0600);

  const addr2 = mem.searchBytes([0x11, 0x22], 0x0601, 0x0605);
  assertEqual(addr2, 0x0603);
});

test('searchBytes not found', () => {
  const mem = new iMaCoMpUtERussyMemory();
  const addr = mem.searchBytes([0xFF, 0xFF], 0x0600, 0x0605);
  assertEqual(addr, -1);
});

test('searchBytes invalid parameters', () => {
  const mem = new iMaCoMpUtERussyMemory();
  assertThrows(() => mem.searchBytes([], 0x0600, 0x0605), TypeError);
  assertThrows(() => mem.searchBytes(null, 0x0600, 0x0605), TypeError);
  assertThrows(() => mem.searchBytes([0x11], 0x0605, 0x0600), RangeError);
});

// Summary
console.log(`\nTests completed: ${testsPassed} passed, ${testsFailed} failed`);
if (testsFailed === 0) {
  console.log('All tests passed!');
} else {
  console.error(`${testsFailed} tests failed!`);
}
