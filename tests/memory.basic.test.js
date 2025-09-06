/**
 * iMaCoMpUtERussy Memory Module Comprehensive Tests
 * Tests all memory operations using Jest test framework
 * Kyle Durepos - iMaCoMpUtERussy Project
 * Converted from console-based tests to Jest for proper coverage
 */

const { iMaCoMpUtERussyMemory } = require('../js/memory.js');

describe('iMaCoMpUtERussy Memory Module Tests', () => {
  let mem;

  beforeEach(() => {
    mem = new iMaCoMpUtERussyMemory();
  });

  describe('Basic Read/Write Byte Operations', () => {
    test('readByte/writeByte basic operations', () => {
      mem.writeByte(0x0600, 0x42);
      expect(mem.readByte(0x0600)).toBe(0x42);
    });

    test('readByte/writeByte bounds checking', () => {
      expect(() => mem.readByte(-1)).toThrow(RangeError);
      expect(() => mem.readByte(0x10000)).toThrow(RangeError);
      expect(() => mem.writeByte(-1, 0)).toThrow(RangeError);
      expect(() => mem.writeByte(0x10000, 0)).toThrow(RangeError);
    });

    test('writeByte value masking', () => {
      mem.writeByte(0x0600, 0x123); // Should be masked to 0x23
      expect(mem.readByte(0x0600)).toBe(0x23);
      mem.writeByte(0x0601, -1); // Should be masked to 0xFF
      expect(mem.readByte(0x0601)).toBe(0xFF);
    });
  });

  describe('Word Operations (Little-Endian)', () => {
    test('readWord/writeWord little-endian', () => {
      mem.writeWord(0x0600, 0x1234);
      expect(mem.readByte(0x0600)).toBe(0x34); // Low byte
      expect(mem.readByte(0x0601)).toBe(0x12); // High byte
      expect(mem.readWord(0x0600)).toBe(0x1234);
    });

    test('readWord/writeWord wrapping at memory boundary', () => {
      const memAllowRom = new iMaCoMpUtERussyMemory({ allowRomWrites: true });
      memAllowRom.writeWord(0xFFFE, 0xABCD); // Should wrap to FFFE and FFFF
      expect(memAllowRom.readByte(0xFFFE)).toBe(0xCD); // Low byte at FFFE
      expect(memAllowRom.readByte(0xFFFF)).toBe(0xAB); // High byte at FFFF
      expect(memAllowRom.readWord(0xFFFE)).toBe(0xABCD);
    });

    test('writeWord value masking', () => {
      mem.writeWord(0x0600, 0x12345); // Should be masked to 0x2345
      expect(mem.readWord(0x0600)).toBe(0x2345);
    });
  });

  describe('Program Loading', () => {
    test('loadProgram with Uint8Array input', () => {
      const program = new Uint8Array([0xA9, 0x42, 0x8D, 0x00, 0x06]);
      const written = mem.loadProgram(0x0600, program);
      expect(written).toBe(5);
      expect(mem.readByte(0x0600)).toBe(0xA9);
      expect(mem.readByte(0x0604)).toBe(0x06);
    });

    test('loadProgram with regular array input', () => {
      const program = [0xA9, 0x42, 0x8D, 0x00, 0x06];
      const written = mem.loadProgram(0x0600, program);
      expect(written).toBe(5);
    });

    test('loadProgram bounds at memory end', () => {
      const memAllowRom = new iMaCoMpUtERussyMemory({ allowRomWrites: true });
      const program = new Uint8Array([0xA9, 0x42]);
      const written = memAllowRom.loadProgram(0xFFFF, program);
      expect(written).toBe(1); // Only first byte fits at 0xFFFF
      expect(memAllowRom.readByte(0xFFFF)).toBe(0xA9);
    });

    test('loadProgram rejects invalid input types', () => {
      expect(() => mem.loadProgram(0x0600, null)).toThrow(TypeError);
      expect(() => mem.loadProgram(0x0600, {})).toThrow(TypeError);
    });
  });

  describe('Region Operations', () => {
    test('clearRegion fills specified range with value', () => {
      mem.writeByte(0x0600, 0x42);
      mem.writeByte(0x0605, 0xFF);
      mem.clearRegion(0x0600, 0x0605, 0xAA);
      expect(mem.readByte(0x0600)).toBe(0xAA);
      expect(mem.readByte(0x0605)).toBe(0xAA);
    });

    test('clearRegion rejects invalid range (end < start)', () => {
      expect(() => mem.clearRegion(0x0605, 0x0600)).toThrow(RangeError);
    });
  });

  describe('ROM Protection', () => {
    test('ROM protection default behavior ignores writes', () => {
      const originalValue = mem.readByte(0x8000);
      mem.writeByte(0x8000, 0x42); // Should be ignored
      expect(mem.readByte(0x8000)).toBe(originalValue); // Unchanged
    });

    test('ROM protection readonly option throws on writes', () => {
      const memReadonly = new iMaCoMpUtERussyMemory({ readonlyROM: true });
      expect(() => memReadonly.writeByte(0x8000, 0x42)).toThrow(Error);
    });

    test('clearRegion respects ROM protection (default)', () => {
      const originalValue = mem.readByte(0x8000);
      mem.clearRegion(0x8000, 0x8000, 0x42); // Should be ignored
      expect(mem.readByte(0x8000)).toBe(originalValue);
    });

    test('clearRegion respects ROM protection (readonly)', () => {
      const memReadonly = new iMaCoMpUtERussyMemory({ readonlyROM: true });
      expect(() => memReadonly.clearRegion(0x8000, 0x8000, 0x42)).toThrow(Error);
    });
  });

  describe('Memory Watcher API', () => {
    test('watcher API basic write listener', () => {
      let called = false;
      let capturedAddr = -1;
      let capturedValue = -1;

      mem.addWriteListener((addr, value) => {
        called = true;
        capturedAddr = addr;
        capturedValue = value;
      });

      mem.writeByte(0x0600, 0x42);
      expect(called).toBe(true);
      expect(capturedAddr).toBe(0x0600);
      expect(capturedValue).toBe(0x42);
    });

    test('watcher API multiple listeners', () => {
      let callCount = 0;

      mem.addWriteListener(() => callCount++);
      mem.addWriteListener(() => callCount++);

      mem.writeByte(0x0600, 0x42);
      expect(callCount).toBe(2);
    });

    test('watcher API remove listener', () => {
      let callCount = 0;

      const listener = () => callCount++;
      mem.addWriteListener(listener);
      mem.writeByte(0x0600, 0x42);
      expect(callCount).toBe(1);

      mem.removeWriteListener(listener);
      mem.writeByte(0x0601, 0x43);
      expect(callCount).toBe(1); // Should not have increased
    });

    test('watcher API rejects invalid callbacks', () => {
      expect(() => mem.addWriteListener(null)).toThrow(TypeError);
      expect(() => mem.addWriteListener({})).toThrow(TypeError);
    });
  });

  describe('Hex Dump Generation', () => {
    test('toHexDump generates correct hex dump format', () => {
      mem.writeByte(0x0600, 0xAB);
      mem.writeByte(0x0601, 0xCD);
      const dump = mem.toHexDump(0x0600, 2);
      expect(dump).toContain('0600: ab cd');
    });

    test('toHexDump rejects invalid parameters', () => {
      expect(() => mem.toHexDump(0x0600, -1)).toThrow(TypeError);
      expect(() => mem.toHexDump(0x0600, 'invalid')).toThrow(TypeError);
    });
  });

  describe('Memory Region Constants', () => {
    test('memory region constants have correct values', () => {
      expect(mem.ZERO_PAGE).toBe(0x0000);
      expect(mem.STACK_PAGE).toBe(0x0100);
      expect(mem.VIDEO_BUFFER_START).toBe(0x0200);
      expect(mem.USER_RAM_START).toBe(0x0600);
      expect(mem.VIDEO_ROM_START).toBe(0x8000);
      expect(mem.SYSTEM_ROM_START).toBe(0xC000);
    });
  });

  describe('Memory Copy Operations', () => {
    test('copyRegion copies bytes correctly', () => {
      mem.writeByte(0x0600, 0x11);
      mem.writeByte(0x0601, 0x22);
      mem.writeByte(0x0602, 0x33);

      const copied = mem.copyRegion(0x0600, 0x0700, 3);
      expect(copied).toBe(3);
      expect(mem.readByte(0x0700)).toBe(0x11);
      expect(mem.readByte(0x0701)).toBe(0x22);
      expect(mem.readByte(0x0702)).toBe(0x33);
    });

    test('copyRegion handles overlapping forward correctly', () => {
      mem.writeByte(0x0600, 0x11);
      mem.writeByte(0x0601, 0x22);
      mem.writeByte(0x0602, 0x33);

      const copied = mem.copyRegion(0x0600, 0x0601, 2);
      expect(copied).toBe(2);
      expect(mem.readByte(0x0600)).toBe(0x11); // Unchanged
      expect(mem.readByte(0x0601)).toBe(0x11); // Copied from 0600
      expect(mem.readByte(0x0602)).toBe(0x22); // Copied from 0601
    });

    test('copyRegion handles overlapping backward correctly', () => {
      mem.writeByte(0x0600, 0x11);
      mem.writeByte(0x0601, 0x22);
      mem.writeByte(0x0602, 0x33);

      const copied = mem.copyRegion(0x0601, 0x0600, 2);
      expect(copied).toBe(2);
      expect(mem.readByte(0x0600)).toBe(0x22); // Copied from 0601
      expect(mem.readByte(0x0601)).toBe(0x33); // Copied from 0602
      expect(mem.readByte(0x0602)).toBe(0x33); // Unchanged
    });
  });

  describe('Byte Search Operations', () => {
    test('searchBytes finds exact byte sequence', () => {
      mem.writeByte(0x0600, 0x11);
      mem.writeByte(0x0601, 0x22);
      mem.writeByte(0x0602, 0x33);
      mem.writeByte(0x0603, 0x11);
      mem.writeByte(0x0604, 0x22);

      const addr = mem.searchBytes([0x11, 0x22], 0x0600, 0x0605);
      expect(addr).toBe(0x0600);

      const addr2 = mem.searchBytes([0x11, 0x22], 0x0601, 0x0605);
      expect(addr2).toBe(0x0603);
    });

    test('searchBytes returns -1 when sequence not found', () => {
      const addr = mem.searchBytes([0xFF, 0xFF], 0x0600, 0x0605);
      expect(addr).toBe(-1);
    });

    test('searchBytes rejects invalid parameters', () => {
      expect(() => mem.searchBytes([], 0x0600, 0x0605)).toThrow(TypeError);
      expect(() => mem.searchBytes(null, 0x0600, 0x0605)).toThrow(TypeError);
      expect(() => mem.searchBytes([0x11], 0x0605, 0x0600)).toThrow(RangeError);
    });
  });

  describe('Advanced Memory Features', () => {
    test('memory banking isolation and switching', () => {
      // Write to bank 0
      mem.writeByte(0x0600, 0x42); // Bank 0, user RAM
      expect(mem.readByte(0x0600)).toBe(0x42);
      
      // Switch to bank 1
      mem.writeByte(0xF5, 1); // Select bank 1
      expect(mem.readByte(0xF5)).toBe(1);
      
      // Write to bank 1
      mem.writeByte(0x0600, 0xAA); // Bank 1, same address
      expect(mem.readByte(0x0600)).toBe(0xAA);
      
      // Switch back to bank 0 - original value should be preserved
      mem.writeByte(0xF5, 0);
      expect(mem.readByte(0x0600)).toBe(0x42);
      
      // Switch to bank 1 again - value preserved
      mem.writeByte(0xF5, 1);
      expect(mem.readByte(0x0600)).toBe(0xAA);
    });

    test('bank select range validation (0-255)', () => {
      // Test valid range
      for (let bank = 0; bank < 256; bank++) {
        mem.writeByte(0xF5, bank);
        expect(mem.readByte(0xF5)).toBe(bank);
      }
      
      // Test wrap-around (0xFF = 255)
      mem.writeByte(0xF5, 0xFF);
      expect(mem.readByte(0xF5)).toBe(255);
      
      // Test invalid value masking
      mem.writeByte(0xF5, 0x1FF); // 511 masked to 255
      expect(mem.readByte(0xF5)).toBe(255);
    });

    test('copy-on-write for ROM regions', () => {
      const memROM = new iMaCoMpUtERussyMemory({ readonlyROM: true });
      
      // Initialize ROM content in bank 0 (master ROM)
      for (let i = 0x8000; i <= 0x800F; i++) {
        memROM.writeByte(i, i & 0xFF); // Sequential values 0x00 to 0x0F
      }
      
      // Verify initial ROM content
      expect(memROM.readByte(0x8000)).toBe(0x00);
      expect(memROM.readByte(0x800F)).toBe(0x0F);
      
      // Switch to bank 1
      memROM.writeByte(0xF5, 1);
      
      // Read ROM before write - should copy from bank 0
      expect(memROM.readByte(0x8000)).toBe(0x00);
      expect(memROM.readByte(0x8001)).toBe(0x01);
      
      // Write to ROM in bank 1 - should trigger CoW
      memROM.writeByte(0x8000, 0xFF);
      expect(memROM.readByte(0x8000)).toBe(0xFF);
      
      // Other ROM locations should still be copied
      expect(memROM.readByte(0x8001)).toBe(0x01);
      
      // Switch back to bank 0 - original unchanged
      memROM.writeByte(0xF5, 0);
      expect(memROM.readByte(0x8000)).toBe(0x00);
      
      // Switch to bank 1 - modification persists
      memROM.writeByte(0xF5, 1);
      expect(memROM.readByte(0x8000)).toBe(0xFF);
      
      // Second write to same bank - no additional copy needed
      memROM.writeByte(0x8001, 0xFE);
      expect(memROM.readByte(0x8001)).toBe(0xFE);
    });

    test('I/O mirroring $F0-$FF to $00-$0F', () => {
      // Write to low I/O range
      mem.writeByte(0x0005, 0xAB);
      expect(mem.readByte(0x0005)).toBe(0xAB);
      
      // Read from mirrored high range - should match
      expect(mem.readByte(0xF5)).toBe(0xAB);
      
      // Write to high range - should mirror to low
      mem.writeByte(0xF5, 0xCD);
      expect(mem.readByte(0xF5)).toBe(0xCD);
      expect(mem.readByte(0x0005)).toBe(0xCD);
      
      // Test full range mirroring
      for (let i = 0; i <= 0x0F; i++) {
        mem.writeByte(i, i * 0x10);
        expect(mem.readByte(0xF0 + i)).toBe(i * 0x10);
        mem.writeByte(0xF0 + i, (i * 0x10) + 0xFF);
        expect(mem.readByte(i)).toBe((i * 0x10) + 0xFF);
      }
    });

    test('MMIO precedence over I/O mirroring', () => {
      // Test terminal output $F1 (write-only MMIO)
      const mockTerminal = { lastOutput: null, write: (char) => { mockTerminal.lastOutput = char; } };
      global.window = { terminal: mockTerminal };
      
      mem.writeByte(0xF1, 0x42); // 'B'
      expect(mockTerminal.lastOutput).toBe(0x42);
      expect(mem.readByte(0xF1)).toBe(0);
      expect(mem.readByte(0x0001)).toBe(0);
      
      // Test status register $F2
      mem.inputReadyFlag = 1;
      expect(mem.readByte(0xF2)).toBe(1);
      
      mem.writeByte(0xF2, 0x00); // Clear flag
      expect(mem.inputReadyFlag).toBe(0);
    });

    test('unchecked accessors performance and correctness', () => {
      // Write using regular methods
      mem.writeByte(0x0600, 0x42);
      mem.writeByte(0xF5, 1); // Switch bank
      mem.writeByte(0x0600, 0xAA);
      
      // Verify with unchecked reads
      expect(mem.readByteUnchecked(0x0600)).toBe(0xAA);
      mem.writeByteUnchecked(0xF5, 0); // Switch back
      expect(mem.readByteUnchecked(0x0600)).toBe(0x42);
      
      // Test MMIO through unchecked accessors
      mem.keyboardBuffer[0] = 0x41; // 'A'
      mem.keyboardTail = 1;
      mem.keyboardCount = 1;
      expect(mem.readByteUnchecked(0xF0)).toBe(0x41);
      expect(mem.keyboardCount).toBe(0);
      
      // Word accessors
      mem.writeWordUnchecked(0x0600, 0xABCD);
      expect(mem.readWordUnchecked(0x0600)).toBe(0xABCD);
      
      // Verify little-endian byte order
      expect(mem.readByteUnchecked(0x0600)).toBe(0xCD);
      expect(mem.readByteUnchecked(0x0601)).toBe(0xAB);
    });

    test('breakpoint creation and basic management', () => {
      // Test addBreakpoint returns ID
      const id1 = mem.addBreakpoint(0x0600, 'write');
      expect(typeof id1).toBe('number');
      expect(id1).toBeGreaterThan(0);
      
      const id2 = mem.addBreakpoint(0x0601, 'read');
      expect(id2).toBe(id1 + 1);
      
      // Test getBreakpoints returns correct data
      const breakpoints = mem.getBreakpoints();
      expect(breakpoints.length).toBe(2);
      
      const bp1 = breakpoints.find(bp => bp.address === 0x0600);
      const bp2 = breakpoints.find(bp => bp.address === 0x0601);
      expect(bp1.type).toBe('write');
      expect(bp2.type).toBe('read');
      
      // Test removeBreakpoint by ID
      const removed1 = mem.removeBreakpoint(id1);
      expect(removed1).toBe(true);
      
      const remaining = mem.getBreakpoints();
      expect(remaining.length).toBe(1);
      expect(remaining[0].address).toBe(0x0601);
      
      // Test remove non-existent ID
      const removed2 = mem.removeBreakpoint(999);
      expect(removed2).toBe(false);
      
      // Test clearBreakpoints
      mem.addBreakpoint(0x0602, 'all');
      const clearedCount = mem.clearBreakpoints();
      expect(clearedCount).toBe(2);
      expect(mem.getBreakpoints().length).toBe(0);
    });

    test('memory compression integrity and lazy loading', () => {
      const TEST_BANK = 0;
      const START_ADDR = 0x1000;
      const END_ADDR = 0x1000 + 0x1000 - 1; // 4KB region for testing
      
      // Create a zero-filled region
      mem.clearRegion(START_ADDR, END_ADDR, 0);
      
      // Verify it's all zeros
      for (let i = START_ADDR; i <= END_ADDR; i++) {
        expect(mem.readByte(i)).toBe(0);
      }
      
      // Compress the region
      const compressed = mem.compressRegion(TEST_BANK, START_ADDR, END_ADDR);
      expect(compressed).toBe(true);
      
      // Verify lazy loading: read should return 0 without full decompression
      expect(mem.readByte(START_ADDR)).toBe(0);
      expect(mem.readByte(END_ADDR)).toBe(0);
      
      // Write to compressed region - should decompress
      mem.writeByte(START_ADDR + 100, 0x42);
      expect(mem.readByte(START_ADDR + 100)).toBe(0x42);
      
      // Verify decompression occurred (region no longer compressed)
      mem.writeByte(START_ADDR + 200, 0xAA);
      expect(mem.readByte(START_ADDR + 200)).toBe(0xAA);
      
      // Test non-compressible region
      mem.writeByte(START_ADDR + 300, 0xFF);
      const nonCompressed = mem.compressRegion(TEST_BANK, START_ADDR, END_ADDR);
      expect(nonCompressed).toBe(false);
    });

    test('transactional memory operations with commit/rollback', () => {
      const TEST_BANK = 1;
      const TEST_ADDR = 0x0600;
      
      // Switch to test bank
      mem.writeByte(0xF5, TEST_BANK);
      
      // Initial state
      mem.writeByte(TEST_ADDR, 0x00);
      expect(mem.readByte(TEST_ADDR)).toBe(0x00);
      
      // Begin transaction
      const begun = mem.beginTransaction(TEST_BANK);
      expect(begun).toBe(true);
      
      // Perform multi-byte writes in transaction
      mem.writeByte(TEST_ADDR, 0x42);
      mem.writeByte(TEST_ADDR + 1, 0xAA);
      mem.writeByte(TEST_ADDR + 2, 0xFF);
      
      // Verify changes within transaction
      expect(mem.readByte(TEST_ADDR)).toBe(0x42);
      expect(mem.readByte(TEST_ADDR + 1)).toBe(0xAA);
      expect(mem.readByte(TEST_ADDR + 2)).toBe(0xFF);
      
      // Rollback
      const rolledBack = mem.rollbackTransaction();
      expect(rolledBack).toBe(true);
      
      // Verify rollback restored original state
      expect(mem.readByte(TEST_ADDR)).toBe(0x00);
      expect(mem.readByte(TEST_ADDR + 1)).toBe(0x00);
      expect(mem.readByte(TEST_ADDR + 2)).toBe(0x00);
      
      // Test commit
      mem.beginTransaction(TEST_BANK);
      mem.writeByte(TEST_ADDR, 0x42);
      mem.writeByte(TEST_ADDR + 1, 0xAA);
      const committed = mem.commitTransaction();
      expect(committed).toBe(true);
      
      // Verify committed changes persist
      expect(mem.readByte(TEST_ADDR)).toBe(0x42);
      expect(mem.readByte(TEST_ADDR + 1)).toBe(0xAA);
    });

    test('withTransaction wrapper atomicity', () => {
      const TEST_BANK = 2;
      mem.writeByte(0xF5, TEST_BANK);
      
      let commitCalled = false;
      let rollbackCalled = false;
      
      // Override transaction methods for testing
      const originalCommit = mem.commitTransaction.bind(mem);
      const originalRollback = mem.rollbackTransaction.bind(mem);
      
      mem.commitTransaction = function() {
        commitCalled = true;
        return originalCommit();
      };
      
      mem.rollbackTransaction = function() {
        rollbackCalled = true;
        return originalRollback();
      };
      
      // Test successful transaction
      const result = mem.withTransaction(() => {
        mem.writeByte(0x0600, 0x42);
        return 'success';
      });
      expect(result).toBe('success');
      expect(commitCalled).toBe(true);
      expect(rollbackCalled).toBe(false);
      
      // Test failing transaction
      expect(() => {
        mem.withTransaction(() => {
          mem.writeByte(0x0600, 0xAA);
          throw new Error('test error');
        });
      }).toThrow('test error');
      expect(commitCalled).toBe(true); // Reset from previous test
      expect(rollbackCalled).toBe(true);
      
      // Restore original methods
      mem.commitTransaction = originalCommit;
      mem.rollbackTransaction = originalRollback;
    });

    test('transaction compatibility with compression', () => {
      const TEST_BANK = 3;
      const START_ADDR = 0x1000;
      const END_ADDR = 0x1FFF; // 3KB region
      
      mem.writeByte(0xF5, TEST_BANK);
      
      // Create and compress zero region
      mem.clearRegion(START_ADDR, END_ADDR, 0);
      mem.compressRegion(TEST_BANK, START_ADDR, END_ADDR);
      
      // Begin transaction
      mem.beginTransaction(TEST_BANK);
      
      // Write to compressed region within transaction
      mem.writeByte(START_ADDR + 100, 0x42);
      
      // Rollback - should restore compressed state
      mem.rollbackTransaction();
      
      // Verify compression still active (read returns 0)
      expect(mem.readByte(START_ADDR + 100)).toBe(0);
      
      // Test commit with decompression
      mem.beginTransaction(TEST_BANK);
      mem.writeByte(START_ADDR + 200, 0xAA);
      mem.commitTransaction();
      
      // Verify write persisted and compression deactivated
      expect(mem.readByte(START_ADDR + 200)).toBe(0xAA);
    });

    test('64KB zero region compression benchmark', () => {
      const START_ADDR = 0x0000;
      const END_ADDR = 0xFFFF; // Full 64KB
      
      // Clear entire memory to zeros
      mem.clearRegion(START_ADDR, END_ADDR, 0);
      
      const compressed = mem.compressRegion(0, START_ADDR, END_ADDR);
      expect(compressed).toBe(true);
      
      // Verify integrity with random reads
      const testPoints = [0x0000, 0x1000, 0x8000, 0xFFFF];
      for (const addr of testPoints) {
        expect(mem.readByte(addr)).toBe(0);
      }
    });

    test('performance benchmark: unchecked vs regular accessors', () => {
      const ITERATIONS = 10000; // Reduced for test speed
      const TEST_ADDR = 0x0600;
      
      // Fill memory with test data
      for (let i = 0; i < 1000; i++) {
        mem.writeByte((TEST_ADDR + i) % 0x10000, i & 0xFF);
      }
      
      // Benchmark regular readByte
      let sumRegular = 0;
      for (let i = 0; i < ITERATIONS; i++) {
        sumRegular += mem.readByte(TEST_ADDR + (i % 1000));
      }
      
      // Benchmark unchecked readByteUnchecked
      let sumUnchecked = 0;
      for (let i = 0; i < ITERATIONS; i++) {
        sumUnchecked += mem.readByteUnchecked(TEST_ADDR + (i % 1000));
      }
      
      // Verify correctness
      expect(sumRegular).toBe(sumUnchecked);
      
      // Check write performance
      mem.writeByte(0xF5, 1); // Switch to bank 1 for write test
      
      for (let i = 0; i < ITERATIONS; i++) {
        mem.writeByte(TEST_ADDR + (i % 1000), (i % 256));
      }
      
      for (let i = 0; i < ITERATIONS; i++) {
        mem.writeByteUnchecked(TEST_ADDR + (i % 1000), (i % 256));
      }
      
      // Verify writes
      let verifySum = 0;
      for (let i = 0; i < 1000; i++) {
        verifySum += mem.readByte(TEST_ADDR + i);
      }
      expect(verifySum).toBeCloseTo(127500, 0); // Expected sum for 0-999 % 256 * 2
    });
  });
});
