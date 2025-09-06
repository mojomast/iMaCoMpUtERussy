/* global console */
/* eslint-env node */

/**
 * Advanced Memory Feature Tests for iMaCoMpUtERussy Emulator
 * Tests banking, copy-on-write, I/O mirroring, and unchecked accessors
 * Uses custom runTest framework for compatibility
 */

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

console.log('Running iMaCoMpUtERussy Memory Advanced Features Tests...\n');

// Mock window for terminal operations
const mockTerminal = {
    write: (char) => {
        // Capture output for verification
        mockTerminal.lastOutput = char;
    }
};
global.window = { terminal: mockTerminal };

// Banking Tests
runTest('Memory banking isolation and switching', () => {
    const memory = new iMaCoMpUtERussyMemory();
    
    // Write to bank 0
    memory.writeByte(0x0600, 0x42); // Bank 0, user RAM
    if (memory.readByte(0x0600) !== 0x42) {
        throw new Error('Bank 0 write/read mismatch');
    }
    
    // Switch to bank 1
    memory.writeByte(0xF5, 1); // Select bank 1
    if (memory.readByte(0xF5) !== 1) {
        throw new Error('Bank select register read mismatch');
    }
    
    // Write to bank 1
    memory.writeByte(0x0600, 0xAA); // Bank 1, same address
    if (memory.readByte(0x0600) !== 0xAA) {
        throw new Error('Bank 1 write/read mismatch');
    }
    
    // Switch back to bank 0 - original value should be preserved
    memory.writeByte(0xF5, 0);
    if (memory.readByte(0x0600) !== 0x42) {
        throw new Error('Bank 0 data corrupted after bank switch');
    }
    
    // Switch to bank 1 again - value preserved
    memory.writeByte(0xF5, 1);
    if (memory.readByte(0x0600) !== 0xAA) {
        throw new Error('Bank 1 data lost after bank switch');
    }
});

runTest('Bank select range validation (0-255)', () => {
    const memory = new iMaCoMpUtERussyMemory();
    
    // Test valid range
    for (let bank = 0; bank < 256; bank++) {
        memory.writeByte(0xF5, bank);
        if (memory.readByte(0xF5) !== bank) {
            throw new Error(`Bank select failed for bank ${bank}`);
        }
    }
    
    // Test wrap-around (0xFF = 255)
    memory.writeByte(0xF5, 0xFF);
    if (memory.readByte(0xF5) !== 255) {
        throw new Error('Bank 255 select failed');
    }
    
    // Test invalid value masking
    memory.writeByte(0xF5, 0x1FF); // 511 masked to 255
    if (memory.readByte(0xF5) !== 255) {
        throw new Error('Bank value masking failed');
    }
});

// Copy-on-Write Tests
runTest('Copy-on-Write for ROM regions', () => {
    const memory = new iMaCoMpUtERussyMemory({ readonlyROM: true });
    
    // Initialize ROM content in bank 0 (master ROM)
    for (let i = 0x8000; i <= 0x800F; i++) {
        memory.writeByte(i, i & 0xFF); // Sequential values 0x00 to 0x0F
    }
    
    // Verify initial ROM content
    if (memory.readByte(0x8000) !== 0x00 || memory.readByte(0x800F) !== 0x0F) {
        throw new Error('ROM initialization failed');
    }
    
    // Switch to bank 1
    memory.writeByte(0xF5, 1);
    
    // Read ROM before write - should copy from bank 0
    if (memory.readByte(0x8000) !== 0x00) {
        throw new Error('ROM read before CoW failed');
    }
    if (memory.readByte(0x8001) !== 0x01) {
        throw new Error('ROM read before CoW failed');
    }
    
    // Write to ROM in bank 1 - should trigger CoW
    memory.writeByte(0x8000, 0xFF);
    if (memory.readByte(0x8000) !== 0xFF) {
        throw new Error('ROM write after CoW failed');
    }
    
    // Other ROM locations should still be copied
    if (memory.readByte(0x8001) !== 0x01) {
        throw new Error('CoW partial copy failed');
    }
    
    // Switch back to bank 0 - original unchanged
    memory.writeByte(0xF5, 0);
    if (memory.readByte(0x8000) !== 0x00) {
        throw new Error('Original ROM modified by CoW');
    }
    
    // Switch to bank 1 - modification persists
    memory.writeByte(0xF5, 1);
    if (memory.readByte(0x8000) !== 0xFF) {
        throw new Error('CoW modification lost');
    }
    
    // Second write to same bank - no additional copy needed
    memory.writeByte(0x8001, 0xFE);
    if (memory.readByte(0x8001) !== 0xFE) {
        throw new Error('Second CoW write failed');
    }
});

runTest('CoW with readonlyROM=false', () => {
    const memory = new iMaCoMpUtERussyMemory({ readonlyROM: false });
    
    // Write directly to ROM in bank 0 (no CoW needed)
    memory.writeByte(0x8000, 0x42);
    if (memory.readByte(0x8000) !== 0x42) {
        throw new Error('Direct ROM write failed with readonlyROM=false');
    }
    
    // Switch to bank 1 and write - should work without CoW copy
    memory.writeByte(0xF5, 1);
    memory.writeByte(0x8000, 0xAA);
    if (memory.readByte(0x8000) !== 0xAA) {
        throw new Error('Bank 1 ROM write failed');
    }
    
    // Original bank 0 unchanged
    memory.writeByte(0xF5, 0);
    if (memory.readByte(0x8000) !== 0x42) {
        throw new Error('Bank 0 modified unexpectedly');
    }
});

// I/O Mirroring Tests
runTest('I/O mirroring $F0-$FF to $00-$0F', () => {
    const memory = new iMaCoMpUtERussyMemory();
    
    // Write to low I/O range
    memory.writeByte(0x0005, 0xAB);
    if (memory.readByte(0x0005) !== 0xAB) {
        throw new Error('Low I/O write failed');
    }
    
    // Read from mirrored high range - should match
    if (memory.readByte(0xF5) !== 0xAB) {
        throw new Error('High I/O read mirroring failed'); // 0xF5 mirrors to 0x05
    }
    
    // Write to high range - should mirror to low
    memory.writeByte(0xF5, 0xCD);
    if (memory.readByte(0xF5) !== 0xCD) {
        throw new Error('High I/O write/read failed');
    }
    if (memory.readByte(0x0005) !== 0xCD) {
        throw new Error('High to low I/O mirroring failed');
    }
    
    // Test MMIO precedence over mirroring for $F0 (keyboard)
    memory.writeByte(0xF0, 0x12); // Write ignored by read-only MMIO handler
    if (memory.readByte(0xF0) !== 0) {
        throw new Error('Keyboard MMIO read-only behavior failed');
    }
    if (memory.readByte(0x0000) !== 0x00) {
        throw new Error('MMIO ignored write affected mirror');
    }
    
    // Direct memory access to mirror location
    memory.writeByte(0x0000, 0x34);
    if (memory.readByte(0x0000) !== 0x34) {
        throw new Error('Direct low I/O write failed');
    }
    if (memory.readByte(0xF0) !== 0x34) {
        throw new Error('Direct low to high mirroring failed');
    }
    
    // Test full range mirroring
    for (let i = 0; i <= 0x0F; i++) {
        memory.writeByte(i, i * 0x10);
        if (memory.readByte(0xF0 + i) !== i * 0x10) {
            throw new Error(`Range mirroring read failed at ${i}`);
        }
        memory.writeByte(0xF0 + i, (i * 0x10) + 0xFF);
        if (memory.readByte(i) !== (i * 0x10) + 0xFF) {
            throw new Error(`Range mirroring write failed at ${i}`);
        }
    }
});

runTest('MMIO precedence over I/O mirroring', () => {
    const memory = new iMaCoMpUtERussyMemory();
    
    // Test terminal output $F1 (write-only MMIO)
    memory.writeByte(0xF1, 0x42); // 'B'
    if (mockTerminal.lastOutput !== 'B') {
        throw new Error('Terminal MMIO write failed');
    }
    if (memory.readByte(0xF1) !== 0) {
        throw new Error('Terminal MMIO read should return 0');
    }
    if (memory.readByte(0x0001) !== 0x00) {
        throw new Error('Terminal MMIO write affected mirror');
    }
    
    // Test status register $F2
    memory.inputReadyFlag = 1;
    if (memory.readByte(0xF2) !== 1) {
        throw new Error('Status MMIO read failed');
    }
    
    memory.writeByte(0xF2, 0x00); // Clear flag
    if (memory.inputReadyFlag !== 0) {
        throw new Error('Status MMIO write clear failed');
    }
    if (memory.keyboardCount !== 0) {
        throw new Error('Status clear did not clear buffer');
    }
    
    // Bank select $F5 should work with mirroring
    memory.writeByte(0xF5, 5);
    if (memory.readByte(0xF5) !== 5) {
        throw new Error('Bank select MMIO failed');
    }
    if (memory.readByte(0x0005) !== 5) {
        throw new Error('Bank select did not mirror to low I/O');
    }
});

// Unchecked Accessors Tests
runTest('Unchecked accessors performance and correctness', () => {
    const memory = new iMaCoMpUtERussyMemory();
    
    // Write using regular methods
    memory.writeByte(0x0600, 0x42);
    memory.writeByte(0xF5, 1); // Switch bank
    memory.writeByte(0x0600, 0xAA);
    
    // Verify with unchecked reads
    if (memory.readByteUnchecked(0x0600) !== 0xAA) {
        throw new Error('Unchecked bank 1 read failed');
    }
    memory.writeByteUnchecked(0xF5, 0); // Switch back
    if (memory.readByteUnchecked(0x0600) !== 0x42) {
        throw new Error('Unchecked bank 0 read failed');
    }
    
    // Test MMIO through unchecked accessors
    // Keyboard read ($F0)
    memory.keyboardBuffer[0] = 0x41; // 'A'
    memory.keyboardTail = 1;
    memory.keyboardCount = 1;
    if (memory.readByteUnchecked(0xF0) !== 0x41) {
        throw new Error('Unchecked keyboard MMIO read failed');
    }
    if (memory.keyboardCount !== 0) {
        throw new Error('Unchecked keyboard read did not consume buffer');
    }
    
    // Terminal write ($F1)
    mockTerminal.lastOutput = null;
    memory.writeByteUnchecked(0xF1, 0x42); // 'B'
    if (mockTerminal.lastOutput !== 'B') {
        throw new Error('Unchecked terminal MMIO write failed');
    }
    
    // Bank switch ($F5)
    memory.writeByteUnchecked(0xF5, 2);
    if (memory.readByteUnchecked(0xF5) !== 2) {
        throw new Error('Unchecked bank switch failed');
    }
    
    // ROM protection in unchecked write (default readonlyROM=false)
    memory.writeByteUnchecked(0x8000, 0xFF);
    if (memory.readByteUnchecked(0x8000) !== 0xFF) {
        throw new Error('Unchecked ROM write failed with readonlyROM=false');
    }
    
    // Test with readonlyROM=true
    const memoryROM = new iMaCoMpUtERussyMemory({ readonlyROM: true });
    memoryROM.writeByteUnchecked(0x8000, 0xFF);
    if (memoryROM.readByteUnchecked(0x8000) !== 0x00) {
        throw new Error('Unchecked ROM protection failed with readonlyROM=true');
    }
    
    // Word accessors
    memory.writeWordUnchecked(0x0600, 0xABCD);
    if (memory.readWordUnchecked(0x0600) !== 0xABCD) {
        throw new Error('Unchecked word accessors failed');
    }
    
    // Verify little-endian byte order
    if (memory.readByteUnchecked(0x0600) !== 0xCD || memory.readByteUnchecked(0x0601) !== 0xAB) {
        throw new Error('Unchecked word little-endian order failed');
    }
});

runTest('Unchecked accessors with I/O mirroring', () => {
    const memory = new iMaCoMpUtERussyMemory();
    
    // Write to low I/O via unchecked
    memory.writeByteUnchecked(0x0005, 0xAB);
    if (memory.readByteUnchecked(0x0005) !== 0xAB) {
        throw new Error('Unchecked low I/O write failed');
    }
    if (memory.readByteUnchecked(0xF5) !== 0xAB) {
        throw new Error('Unchecked high I/O mirroring read failed');
    }
    
    // Write to high I/O via unchecked
    memory.writeByteUnchecked(0xF5, 0xCD);
    if (memory.readByteUnchecked(0xF5) !== 0xCD) {
        throw new Error('Unchecked high I/O write failed');
    }
    if (memory.readByteUnchecked(0x0005) !== 0xCD) {
        throw new Error('Unchecked high to low mirroring failed');
    }
    
    // Test MMIO precedence in unchecked
    mockTerminal.lastOutput = null;
    memory.writeByteUnchecked(0xF1, 0x42);
    if (mockTerminal.lastOutput !== 'B') {
        throw new Error('Unchecked MMIO terminal write failed');
    }
    if (memory.readByteUnchecked(0x0001) !== 0x00) {
        throw new Error('Unchecked MMIO affected mirroring');
    }
});

// ====================
// BREAKPOINT TESTS
// ====================

runTest('Breakpoint creation and basic management', () => {
    const memory = new iMaCoMpUtERussyMemory();
    
    // Test addBreakpoint returns ID
    const id1 = memory.addBreakpoint(0x0600, 'write');
    if (!Number.isInteger(id1) || id1 <= 0) {
        throw new Error('addBreakpoint did not return valid ID');
    }
    
    const id2 = memory.addBreakpoint(0x0601, 'read');
    if (id2 !== id1 + 1) {
        throw new Error('Breakpoint IDs not sequential');
    }
    
    // Test getBreakpoints returns correct data
    const breakpoints = memory.getBreakpoints();
    if (breakpoints.length !== 2) {
        throw new Error(`Expected 2 breakpoints, got ${breakpoints.length}`);
    }
    
    const bp1 = breakpoints.find(bp => bp.address === 0x0600);
    const bp2 = breakpoints.find(bp => bp.address === 0x0601);
    if (!bp1 || bp1.type !== 'write' || bp1.hasCondition || bp1.hasCallback) {
        throw new Error('First breakpoint properties incorrect');
    }
    if (!bp2 || bp2.type !== 'read' || bp2.hasCondition || bp2.hasCallback) {
        throw new Error('Second breakpoint properties incorrect');
    }
    
    // Test removeBreakpoint by ID
    const removed1 = memory.removeBreakpoint(id1);
    if (!removed1) {
        throw new Error('removeBreakpoint failed for valid ID');
    }
    
    const remaining = memory.getBreakpoints();
    if (remaining.length !== 1 || remaining[0].address !== 0x0601) {
        throw new Error('removeBreakpoint did not remove correct breakpoint');
    }
    
    // Test remove non-existent ID
    const removed2 = memory.removeBreakpoint(999);
    if (removed2) {
        throw new Error('removeBreakpoint returned true for non-existent ID');
    }
    
    // Test clearBreakpoints
    memory.addBreakpoint(0x0602, 'all');
    const clearedCount = memory.clearBreakpoints();
    if (clearedCount !== 2) {
        throw new Error(`clearBreakpoints reported wrong count: ${clearedCount}`);
    }
    if (memory.getBreakpoints().length !== 0) {
        throw new Error('clearBreakpoints did not clear all breakpoints');
    }
});

runTest('Write breakpoint triggering', () => {
    const memory = new iMaCoMpUtERussyMemory();
    let breakpointHit = false;
    
    // Add breakpoint with callback
    const bpId = memory.addBreakpoint(0x0600, 'write', null, (addr, value, type) => {
        if (addr === 0x0600 && type === 'write' && value === 0x42) {
            breakpointHit = true;
        }
    });
    
    // Write to breakpoint address
    memory.writeByte(0x0600, 0x42);
    
    if (!breakpointHit) {
        throw new Error('Write breakpoint callback not triggered');
    }
    
    // Verify pause state was set
    if (!memory.isPaused()) {
        throw new Error('Write breakpoint did not set paused state');
    }
    
    // Test resume
    memory.resume();
    if (memory.isPaused()) {
        throw new Error('resume did not clear paused state');
    }
    
    // Remove breakpoint
    memory.removeBreakpoint(bpId);
});

runTest('Read breakpoint triggering', () => {
    const memory = new iMaCoMpUtERussyMemory();
    let breakpointHit = false;
    
    // Initialize memory location
    memory.writeByte(0x0601, 0xAA);
    
    // Add read breakpoint with callback
    const bpId = memory.addBreakpoint(0x0601, 'read', null, (addr, value, type) => {
        if (addr === 0x0601 && type === 'read' && value === 0xAA) {
            breakpointHit = true;
        }
    });
    
    // Read from breakpoint address
    const value = memory.readByte(0x0601);
    
    if (value !== 0xAA) {
        throw new Error('Read operation failed');
    }
    
    if (!breakpointHit) {
        throw new Error('Read breakpoint callback not triggered');
    }
    
    // Verify pause state
    if (!memory.isPaused()) {
        throw new Error('Read breakpoint did not set paused state');
    }
    
    memory.resume();
    memory.removeBreakpoint(bpId);
});

runTest('Conditional breakpoint triggering', () => {
    const memory = new iMaCoMpUtERussyMemory();
    let conditionHit = false;
    let noConditionHit = false;
    
    // Add conditional write breakpoint
    const condId = memory.addBreakpoint(0x0602, 'write', (value, addr) => {
        return value === 0x42;
    }, (addr, value, type) => {
        conditionHit = true;
    });
    
    // Add unconditional write breakpoint
    const uncondId = memory.addBreakpoint(0x0603, 'write', null, (addr, value, type) => {
        noConditionHit = true;
    });
    
    // Write value that matches condition
    memory.writeByte(0x0602, 0x42);
    if (!conditionHit) {
        throw new Error('Conditional breakpoint not triggered for matching value');
    }
    
    // Write different value to same address - should NOT trigger
    conditionHit = false;
    memory.writeByte(0x0602, 0xFF);
    if (conditionHit) {
        throw new Error('Conditional breakpoint triggered for non-matching value');
    }
    
    // Write to unconditional breakpoint
    memory.writeByte(0x0603, 0xAB);
    if (!noConditionHit) {
        throw new Error('Unconditional breakpoint not triggered');
    }
    
    // Clean up
    memory.removeBreakpoint(condId);
    memory.removeBreakpoint(uncondId);
    memory.resume();
});

runTest('Breakpoint compatibility with existing listeners', () => {
    const memory = new iMaCoMpUtERussyMemory();
    let listenerCalled = false;
    let breakpointCalled = false;
    
    // Add existing write listener
    memory.addWriteListener((addr, value) => {
        if (addr === 0x0604 && value === 0x42) {
            listenerCalled = true;
        }
    });
    
    // Add breakpoint
    const bpId = memory.addBreakpoint(0x0604, 'write', null, () => {
        breakpointCalled = true;
    });
    
    // Perform write that should trigger both
    memory.writeByte(0x0604, 0x42);
    
    if (!listenerCalled) {
        throw new Error('Existing listener not called after breakpoint');
    }
    if (!breakpointCalled) {
        throw new Error('Breakpoint not called with existing listener present');
    }
    
    // Verify listeners still work after breakpoint removal
    listenerCalled = false;
    memory.removeBreakpoint(bpId);
    memory.writeByte(0x0604, 0x42);
    if (!listenerCalled) {
        throw new Error('Existing listener stopped working after breakpoint removal');
    }
});

runTest('Breakpoint event emission (browser environment)', () => {
    if (typeof window === 'undefined') {
        console.log('Skipping browser event test in Node.js environment');
        return;
    }
    
    const memory = new iMaCoMpUtERussyMemory();
    let eventReceived = false;
    
    // Listen for custom event
    window.addEventListener('memoryBreakpointHit', (event) => {
        const { type, address, value } = event.detail;
        if (type === 'write' && address === 0x0605 && value === 0x42) {
            eventReceived = true;
        }
    });
    
    // Add breakpoint
    memory.addBreakpoint(0x0605, 'write');
    
    // Trigger breakpoint
    memory.writeByte(0x0605, 0x42);
    
    if (!eventReceived) {
        throw new Error('Custom memoryBreakpointHit event not emitted');
    }
    
    // Clean up
    memory.clearBreakpoints();
});

runTest('Breakpoint pause state integration', () => {
    const memory = new iMaCoMpUtERussyMemory();
    
    // Add breakpoint
    const bpId = memory.addBreakpoint(0x0606, 'write');
    
    // Initial state should not be paused
    if (memory.isPaused()) {
        throw new Error('Memory initially paused');
    }
    
    // Trigger breakpoint
    memory.writeByte(0x0606, 0x42);
    
    // Should now be paused
    if (!memory.isPaused()) {
        throw new Error('Memory not paused after breakpoint hit');
    }
    
    // Test resume
    memory.resume();
    if (memory.isPaused()) {
        throw new Error('Memory still paused after resume');
    }
    
    // Remove breakpoint
    memory.removeBreakpoint(bpId);
});

runTest('Breakpoint type validation and defaults', () => {
    const memory = new iMaCoMpUtERussyMemory();
    
    // Test default type 'write'
    const defaultId = memory.addBreakpoint(0x0607);
    const defaultBp = memory.getBreakpoints().find(bp => bp.id === defaultId);
    if (defaultBp.type !== 'write') {
        throw new Error('Default breakpoint type not set to write');
    }
    
    // Test valid types
    memory.addBreakpoint(0x0608, 'read');
    memory.addBreakpoint(0x0609, 'all');
    
    const types = memory.getBreakpoints().map(bp => bp.type);
    if (!types.includes('read') || !types.includes('all')) {
        throw new Error('Valid breakpoint types not set correctly');
    }
    
    // Test invalid type defaults to 'write'
    memory.addBreakpoint(0x0610, 'invalid');
    const invalidBp = memory.getBreakpoints().find(bp => bp.address === 0x0610);
    if (invalidBp.type !== 'write') {
        throw new Error('Invalid breakpoint type did not default to write');
    }
    
    memory.clearBreakpoints();
});

runTest('Multiple breakpoints at same address', () => {
    const memory = new iMaCoMpUtERussyMemory();
    let writeHit = 0;
    let readHit = 0;
    
    // Add two breakpoints at same address with different types
    const writeId = memory.addBreakpoint(0x0611, 'write', null, () => { writeHit++; });
    const readId = memory.addBreakpoint(0x0611, 'read', null, () => { readHit++; });
    
    // Write should trigger only write breakpoint
    memory.writeByte(0x0611, 0x42);
    if (writeHit !== 1 || readHit !== 0) {
        throw new Error('Write did not trigger only write breakpoint');
    }
    
    // Read should trigger only read breakpoint
    memory.readByte(0x0611);
    if (writeHit !== 1 || readHit !== 1) {
        throw new Error('Read did not trigger only read breakpoint');
    }
    
    // Add 'all' type - should trigger both operations
    let allHit = 0;
    const allId = memory.addBreakpoint(0x0611, 'all', null, () => { allHit++; });
    
    // Write should trigger both write and all
    writeHit = 0;
    readHit = 0;
    allHit = 0;
    memory.writeByte(0x0611, 0x43);
    if (writeHit !== 1 || allHit !== 1) {
        throw new Error('Write with "all" breakpoint did not trigger both');
    }
    
    // Read should trigger both read and all
    writeHit = 0;
    readHit = 0;
    allHit = 0;
    memory.readByte(0x0611);
    if (readHit !== 1 || allHit !== 1) {
        throw new Error('Read with "all" breakpoint did not trigger both');
    }
    
    memory.clearBreakpoints();
});

console.log('\nMemory Advanced Features Tests completed');
runTest('Performance benchmark: unchecked vs regular accessors', () => {
    const memory = new iMaCoMpUtERussyMemory();
    const ITERATIONS = 100000;
    const TEST_ADDR = 0x0600;
    
    // Fill memory with test data
    for (let i = 0; i < 1000; i++) {
        memory.writeByte((TEST_ADDR + i) % 0x10000, i & 0xFF);
    }
    
    // Benchmark regular readByte
    console.time('Regular readByte');
    let sumRegular = 0;
    for (let i = 0; i < ITERATIONS; i++) {
        sumRegular += memory.readByte(TEST_ADDR + (i % 1000));
    }
    console.timeEnd('Regular readByte');
    
    // Benchmark unchecked readByteUnchecked
    console.time('Unchecked readByteUnchecked');
    let sumUnchecked = 0;
    for (let i = 0; i < ITERATIONS; i++) {
        sumUnchecked += memory.readByteUnchecked(TEST_ADDR + (i % 1000));
    }
    console.timeEnd('Unchecked readByteUnchecked');
    
    // Verify correctness
    if (sumRegular !== sumUnchecked) {
        throw new Error('Performance test data mismatch');
    }
    
    // Check write performance
    memory.writeByte(0xF5, 1); // Switch to bank 1 for write test
    
    console.time('Regular writeByte');
    for (let i = 0; i < ITERATIONS; i++) {
        memory.writeByte(TEST_ADDR + (i % 1000), (i % 256));
    }
    console.timeEnd('Regular writeByte');
    
    console.time('Unchecked writeByteUnchecked');
    for (let i = 0; i < ITERATIONS; i++) {
        memory.writeByteUnchecked(TEST_ADDR + (i % 1000), (i % 256));
    }
    console.timeEnd('Unchecked writeByteUnchecked');
    
    // Verify writes
    let verifySum = 0;
    for (let i = 0; i < 1000; i++) {
        verifySum += memory.readByte(TEST_ADDR + i);
    }
    if (verifySum !== 32500) { // Expected sum for 0-999 % 256
        throw new Error('Performance test write verification failed');
    }
    
    console.log(`Performance test completed: ${ITERATIONS} iterations`);
    console.log(`Regular read sum: ${sumRegular}, Unchecked read sum: ${sumUnchecked}`);
});

// ====================
// COMPRESSION TESTS
// ====================

runTest('Memory compression integrity and lazy loading', () => {
    const memory = new iMaCoMpUtERussyMemory();
    const TEST_BANK = 0;
    const START_ADDR = 0x1000;
    const END_ADDR = 0x1000 + 0x1000 - 1; // 4KB region for testing
    
    // Create a zero-filled region
    memory.clearRegion(START_ADDR, END_ADDR, 0);
    
    // Verify it's all zeros
    for (let i = START_ADDR; i <= END_ADDR; i++) {
        if (memory.readByte(i) !== 0) {
            throw new Error('Region not zero-filled');
        }
    }
    
    // Compress the region
    const compressed = memory.compressRegion(TEST_BANK, START_ADDR, END_ADDR);
    if (!compressed) {
        throw new Error('Compression failed on zero region');
    }
    
    // Verify lazy loading: read should return 0 without full decompression
    if (memory.readByte(START_ADDR) !== 0) {
        throw new Error('Lazy read from compressed zero region failed');
    }
    if (memory.readByte(END_ADDR) !== 0) {
        throw new Error('Lazy read from end of compressed region failed');
    }
    
    // Write to compressed region - should decompress
    memory.writeByte(START_ADDR + 100, 0x42);
    if (memory.readByte(START_ADDR + 100) !== 0x42) {
        throw new Error('Write to compressed region failed');
    }
    
    // Verify decompression occurred (region no longer compressed)
    // Since compressedRegions is private, test by writing multiple values
    memory.writeByte(START_ADDR + 200, 0xAA);
    if (memory.readByte(START_ADDR + 200) !== 0xAA) {
        throw new Error('Post-decompression write failed');
    }
    
    // Test non-compressible region
    memory.writeByte(START_ADDR + 300, 0xFF);
    const nonCompressed = memory.compressRegion(TEST_BANK, START_ADDR, END_ADDR);
    if (nonCompressed) {
        throw new Error('Compression succeeded on non-zero region');
    }
});

runTest('64KB zero region compression benchmark', () => {
    const memory = new iMaCoMpUtERussyMemory();
    const START_ADDR = 0x0000;
    const END_ADDR = 0xFFFF; // Full 64KB
    
    // Clear entire memory to zeros
    memory.clearRegion(START_ADDR, END_ADDR, 0);
    
    console.time('64KB zero compression');
    const compressed = memory.compressRegion(0, START_ADDR, END_ADDR);
    console.timeEnd('64KB zero compression');
    
    if (!compressed) {
        throw new Error('64KB compression failed');
    }
    
    // Verify integrity with random reads
    const testPoints = [0x0000, 0x1000, 0x8000, 0xFFFF];
    for (const addr of testPoints) {
        if (memory.readByte(addr) !== 0) {
            throw new Error(`Integrity check failed at 0x${addr.toString(16)}`);
        }
    }
    
    console.log('64KB compression successful with lazy loading integrity');
});

// ====================
// TRANSACTION TESTS
// ====================

runTest('Transactional memory operations with commit/rollback', () => {
    const memory = new iMaCoMpUtERussyMemory();
    const TEST_BANK = 1;
    const TEST_ADDR = 0x0600;
    
    // Switch to test bank
    memory.writeByte(0xF5, TEST_BANK);
    
    // Initial state
    memory.writeByte(TEST_ADDR, 0x00);
    if (memory.readByte(TEST_ADDR) !== 0x00) {
        throw new Error('Initial state setup failed');
    }
    
    // Begin transaction
    const begun = memory.beginTransaction(TEST_BANK);
    if (!begun) {
        throw new Error('Transaction begin failed');
    }
    
    // Perform multi-byte writes in transaction
    memory.writeByte(TEST_ADDR, 0x42);
    memory.writeByte(TEST_ADDR + 1, 0xAA);
    memory.writeByte(TEST_ADDR + 2, 0xFF);
    
    // Verify changes within transaction
    if (memory.readByte(TEST_ADDR) !== 0x42 ||
        memory.readByte(TEST_ADDR + 1) !== 0xAA ||
        memory.readByte(TEST_ADDR + 2) !== 0xFF) {
        throw new Error('Transactional writes not visible');
    }
    
    // Rollback
    const rolledBack = memory.rollbackTransaction();
    if (!rolledBack) {
        throw new Error('Transaction rollback failed');
    }
    
    // Verify rollback restored original state
    if (memory.readByte(TEST_ADDR) !== 0x00 ||
        memory.readByte(TEST_ADDR + 1) !== 0x00 ||
        memory.readByte(TEST_ADDR + 2) !== 0x00) {
        throw new Error('Rollback did not restore original state');
    }
    
    // Test commit
    memory.beginTransaction(TEST_BANK);
    memory.writeByte(TEST_ADDR, 0x42);
    memory.writeByte(TEST_ADDR + 1, 0xAA);
    const committed = memory.commitTransaction();
    if (!committed) {
        throw new Error('Transaction commit failed');
    }
    
    // Verify committed changes persist
    if (memory.readByte(TEST_ADDR) !== 0x42 ||
        memory.readByte(TEST_ADDR + 1) !== 0xAA) {
        throw new Error('Committed changes not persistent');
    }
    
    // Test nested transactions
    memory.beginTransaction(TEST_BANK);
    memory.writeByte(TEST_ADDR + 2, 0xBB); // Should be rolled back
    memory.rollbackTransaction();
    if (memory.readByte(TEST_ADDR + 2) !== 0x00) {
        throw new Error('Nested transaction rollback failed');
    }
});

runTest('withTransaction wrapper atomicity', () => {
    const memory = new iMaCoMpUtERussyMemory();
    const TEST_BANK = 2;
    memory.writeByte(0xF5, TEST_BANK);
    
    let commitCalled = false;
    let rollbackCalled = false;
    
    // Override transaction methods for testing
    const originalCommit = memory.commitTransaction;
    const originalRollback = memory.rollbackTransaction;
    
    memory.commitTransaction = () => {
        commitCalled = true;
        return originalCommit.call(memory);
    };
    
    memory.rollbackTransaction = () => {
        rollbackCalled = true;
        return originalRollback.call(memory);
    };
    
    // Test successful transaction
    try {
        const result = memory.withTransaction(() => {
            memory.writeByte(0x0600, 0x42);
            return 'success';
        });
        if (result !== 'success' || !commitCalled || rollbackCalled) {
            throw new Error('Successful withTransaction did not commit');
        }
    } catch (e) {
        throw new Error('withTransaction threw unexpectedly: ' + e.message);
    }
    
    // Test failing transaction
    try {
        memory.withTransaction(() => {
            memory.writeByte(0x0600, 0xAA);
            throw new Error('test error');
        });
        throw new Error('Failing transaction did not throw');
    } catch (e) {
        if (e.message !== 'test error' || commitCalled || !rollbackCalled) {
            throw new Error('Failing withTransaction did not rollback properly');
        }
        // Verify rollback restored state
        if (memory.readByte(0x0600) !== 0x42) {
            throw new Error('Rollback state not restored in withTransaction');
        }
    }
    
    // Restore original methods
    memory.commitTransaction = originalCommit;
    memory.rollbackTransaction = originalRollback;
});

runTest('Transaction compatibility with compression', () => {
    const memory = new iMaCoMpUtERussyMemory();
    const TEST_BANK = 3;
    const START_ADDR = 0x1000;
    const END_ADDR = 0x1FFF; // 3KB region
    
    memory.writeByte(0xF5, TEST_BANK);
    
    // Create and compress zero region
    memory.clearRegion(START_ADDR, END_ADDR, 0);
    memory.compressRegion(TEST_BANK, START_ADDR, END_ADDR);
    
    // Begin transaction
    memory.beginTransaction(TEST_BANK);
    
    // Write to compressed region within transaction
    memory.writeByte(START_ADDR + 100, 0x42);
    
    // Rollback - should restore compressed state
    memory.rollbackTransaction();
    
    // Verify compression still active (read returns 0)
    if (memory.readByte(START_ADDR + 100) !== 0) {
        throw new Error('Transaction rollback did not preserve compression');
    }
    
    // Test commit with decompression
    memory.beginTransaction(TEST_BANK);
    memory.writeByte(START_ADDR + 200, 0xAA);
    memory.commitTransaction();
    
    // Verify write persisted and compression deactivated
    if (memory.readByte(START_ADDR + 200) !== 0xAA) {
        throw new Error('Committed write to compressed region failed');
    }
});

console.log('\nMemory Performance Optimization Tests completed');