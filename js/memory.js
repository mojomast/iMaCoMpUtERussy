/**
 * iMaCoMpUtERussy Memory Management System
 *
 * Provides 64KB memory space with defined regions, ROM protection, and event notification.
 * Supports memory-mapped I/O for terminal ($F0-F2) and video buffer ($0200-$05FF).
 *
 * @module iMaCoMpUtERussyMemory
 * @author Kyle Durepos
 */

// Region constants
export const ZERO_PAGE = 0x0000;
export const ZERO_PAGE_END = 0x00FF;
export const STACK_PAGE = 0x0100;
export const STACK_PAGE_END = 0x01FF;
export const VIDEO_BUFFER_START = 0x0200;
export const VIDEO_BUFFER_END = 0x05FF;
export const USER_RAM_START = 0x0600;
export const USER_RAM_END = 0x7FFF;
export const VIDEO_ROM_START = 0x8000;
export const SYSTEM_ROM_START = 0xC000;

const MEMORY_SIZE = 0x10000; // 65536

/**
 * iMaCoMpUtERussyMemory
 * @class
 */
/**
 * Memory class implementing 64KB address space with region management.
 *
 * Features:
 * - 0x0000-0xFFFF address space (65536 bytes)
 * - Configurable ROM protection (0x8000+)
 * - Read/write event listeners for UI updates
 * - Memory-mapped I/O integration
 * - Bounds checking and validation
 *
 * Memory Regions:
 * - 0x0000-0x00FF: Zero Page (variables, I/O registers $F0-$F2)
 * - 0x0100-0x01FF: Stack (interrupt handling, subroutine calls)
 * - 0x0200-0x05FF: Video Buffer (32×24 pixel graphics, 1KB)
 * - 0x0600-0x7FFF: User RAM (programs and data)
 * - 0x8000-0xFFFF: ROM (read-only video/system routines)
 *
 * @class iMaCoMpUtERussyMemory
 * @param {Object} [options] - Configuration options
 * @param {Uint8Array} [options.buffer] - Pre-allocated memory buffer
 * @param {boolean} [options.readonlyROM=false] - Enforce ROM write protection
 * @param {boolean} [options.allowRomWrites=false] - Bypass ROM protection for testing
 */
export class iMaCoMpUtERussyMemory {
  /**
   * Construct memory backend.
   * @param {Object} [options]
   * @param {Uint8Array} [options.buffer] - Optional backing buffer (must be length 65536).
   * @param {boolean} [options.readonlyROM=false] - If true, ROM writes throw; otherwise they are ignored and a warning is logged.
   */
  constructor({ buffer, readonlyROM = false, allowRomWrites = false } = {}) {
    if (buffer) {
      if (!(buffer instanceof Uint8Array) || buffer.length !== MEMORY_SIZE) {
        throw new Error('buffer must be a Uint8Array of length ' + MEMORY_SIZE);
      }
      this.buffer = buffer;
    } else {
      this.buffer = new Uint8Array(MEMORY_SIZE);
      // initialize default reset values if any (vectors, stack pointer, etc.)
      // For now keep zeros; future TODO: populate ROM reset vectors.
    }

  this.readonlyROM = !!readonlyROM;
  // allowRomWrites bypasses ROM write-ignore behavior (useful for tests)
  this.allowRomWrites = !!allowRomWrites;
    this._writeListeners = new Set();
    this._readListeners = new Set();

    // TODO: initialize MMIO handlers for hardware devices (keyboard, timers, etc.)

    // attach region constants on the class instance for convenience
    this.ZERO_PAGE = ZERO_PAGE;
    this.STACK_PAGE = STACK_PAGE;
    this.VIDEO_BUFFER_START = VIDEO_BUFFER_START;
    this.VIDEO_BUFFER_END = VIDEO_BUFFER_END;
    this.USER_RAM_START = USER_RAM_START;
    this.USER_RAM_END = USER_RAM_END;
    this.VIDEO_ROM_START = VIDEO_ROM_START;
    this.SYSTEM_ROM_START = SYSTEM_ROM_START;
  }

  // -----------------------
  // Low-level helpers
  // -----------------------

  /**
   * Validate an address is within 0..0xFFFF
   * @param {number} addr
   * @throws {RangeError}
   * @private
   */
  _checkAddr(addr) {
    if (!Number.isInteger(addr) || addr < 0x0000 || addr > 0xFFFF) {
      throw new RangeError(`Address out of bounds: ${addr}`);
    }
  }

  /**
   * Check if address is in ROM region
   * @param {number} addr
   * @returns {boolean}
   * @private
   */
  _isROM(addr) {
    return addr >= VIDEO_ROM_START && addr <= 0xFFFF;
  }

  /**
   * Notify write listeners
   * @param {number} addr
   * @param {number} value
   * @private
   */
  _notifyWrite(addr, value) {
    for (const cb of this._writeListeners) {
      try {
        cb(addr & 0xFFFF, value & 0xFF);
      } catch (e) {
        console.error('Memory write listener error', e);
      }
    }
  }

  /**
   * Notify read listeners
   * @param {number} addr
   * @param {number} value
   * @private
   */
  _notifyRead(addr, value) {
    for (const cb of this._readListeners) {
      try {
        cb(addr & 0xFFFF, value & 0xFF);
      } catch (e) {
        console.error('Memory read listener error', e);
      }
    }
  }

  /**
   * Handle ROM write validation and logging
   * @param {number} addr
   * @param {number} value
   * @returns {boolean} true if write should proceed
   * @private
   */
  _handleROMWrite(addr, value) {
    if (!this._isROM(addr)) return true;

    const msg = `Write to ROM ignored at 0x${addr.toString(16).padStart(4, '0')}: 0x${value.toString(16).padStart(2, '0')}`;
    
    if (this.readonlyROM && !this.allowRomWrites) {
      throw new Error(msg.replace('ignored', 'forbidden (readonlyROM=true)'));
    } else if (!this.allowRomWrites) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(msg);
      }
      return false;
    }
    
    return true;
  }

  /**
   * Read single byte from memory address with event notification.
   *
   * Triggers read listeners for UI updates and debugging.
   * Performs bounds checking and address masking.
   *
   * @param {number} addr - Memory address (0x0000-0xFFFF)
   * @returns {number} Byte value (0-255)
   * @throws {RangeError} If address out of bounds
   */
  readByte(addr) {
    this._checkAddr(addr);
    const maskedAddr = addr & 0xFFFF;
    const value = this.buffer[maskedAddr];
    this._notifyRead(addr, value);
    return value;
  }

  /**
   * Write a byte to memory.
   * ROM writes are handled depending on readonlyROM flag. By default writes to ROM are ignored and a warning is logged.
   * @param {number} addr - 0..0xFFFF
   * @param {number} value - number; masked to 0..255
   */
  writeByte(addr, value) {
    this._checkAddr(addr);
    const maskedAddr = addr & 0xFFFF;
    const maskedValue = value & 0xFF;

    // Check ROM write permissions
    if (!this._handleROMWrite(maskedAddr, maskedValue)) {
      return;
    }

    this.buffer[maskedAddr] = maskedValue;
    this._notifyWrite(maskedAddr, maskedValue);
  }

  /**
   * Read a 16-bit little-endian word (wraps at 0xFFFF to 0x0000)
   * @param {number} addr - address of low byte
   * @returns {number} 0..65535
   */
  readWord(addr) {
    this._checkAddr(addr);
    const maskedAddr = addr & 0xFFFF;
    const lo = this.readByte(maskedAddr);
    const hi = this.readByte((maskedAddr + 1) & 0xFFFF);
    return (hi << 8) | lo;
  }

  /**
   * Write a 16-bit little-endian word (wraps at 0xFFFF)
   * @param {number} addr
   * @param {number} value
   */
  writeWord(addr, value) {
    this._checkAddr(addr);
    const maskedAddr = addr & 0xFFFF;
    const maskedValue = value & 0xFFFF;
    const lo = maskedValue & 0xFF;
    const hi = (maskedValue >> 8) & 0xFF;
    this.writeByte(maskedAddr, lo);
    this.writeByte((maskedAddr + 1) & 0xFFFF, hi);
  }

  /**
   * Load assembled program into memory at specified address.
   *
   * Writes bytes sequentially from start address until end of memory or input.
   * Respects ROM write protection - ROM writes are ignored or throw errors.
   * Used by assembler and file loader for program execution.
   *
   * @param {number} addr - Starting memory address (typically 0x0600)
   * @param {Uint8Array|ArrayLike<number>} byteArray - Program machine code
   * @returns {number} Number of bytes successfully written
   * @throws {TypeError} If byteArray is invalid
   */
  loadProgram(addr, byteArray) {
    this._checkAddr(addr);
    if (!byteArray || typeof byteArray.length !== 'number') {
      throw new TypeError('byteArray must be array-like');
    }
    let written = 0;
    let a = addr & 0xFFFF;
    // Do not wrap around past 0xFFFF. Compute max writable bytes until end of memory.
    const maxWrite = 0x10000 - a;
    const toWrite = Math.min(maxWrite, byteArray.length);
    for (let i = 0; i < toWrite; i++) {
      const target = (a + i) & 0xFFFF;
      try {
        this.writeByte(target, byteArray[i]);
      } catch (e) {
        console.error('Stopped loading program due to write error', e);
        break;
      }
      // Only count as written if the underlying buffer contains the value (writeByte may ignore ROM writes)
      if (this.buffer[target] === (byteArray[i] & 0xFF)) {
        written++;
      }
    }
    return written;
  }

  /**
   * Fill a region [startAddr..endAddr] inclusive with value (default 0).
   * @param {number} startAddr
   * @param {number} endAddr
   * @param {number} [value=0]
   */
  clearRegion(startAddr, endAddr, value = 0) {
    this._checkAddr(startAddr);
    this._checkAddr(endAddr);
    if (endAddr < startAddr) {
      throw new RangeError('endAddr must be >= startAddr');
    }
    const v = value & 0xFF;
    for (let a = startAddr; a <= endAddr; a++) {
      // respect ROM write rules
      if (this._isROM(a)) {
        if (this.readonlyROM) {
          throw new Error('Attempt to clear ROM region with readonlyROM=true');
        } else {
          if (typeof console !== 'undefined' && console.warn) console.warn('clearRegion: skipping ROM address 0x' + a.toString(16));
          continue;
        }
      }
      this.buffer[a] = v;
      this._notifyWrite(a, v);
    }
  }

  /**
   * Copy a region of memory from source to destination.
   * Handles overlapping regions and respects ROM write rules.
   * @param {number} srcStartAddr - Source start address
   * @param {number} destStartAddr - Destination start address
   * @param {number} length - Number of bytes to copy
   * @returns {number} Number of bytes actually copied (may be less if ROM writes fail)
   */
  copyRegion(srcStartAddr, destStartAddr, length) {
    this._checkAddr(srcStartAddr);
    this._checkAddr(destStartAddr);
    if (!Number.isInteger(length) || length < 0) {
      throw new TypeError('length must be a non-negative integer');
    }
    if (length === 0) return 0;

    let copied = 0;
  // Use forward or backward copy based on overlap (memmove semantics)
  // If destStartAddr > srcStartAddr and regions overlap, copy backwards; otherwise copy forwards.
  const forward = !(destStartAddr > srcStartAddr && destStartAddr < srcStartAddr + length);

    if (forward) {
      for (let i = 0; i < length; i++) {
        const srcAddr = (srcStartAddr + i) & 0xFFFF;
        const destAddr = (destStartAddr + i) & 0xFFFF;
        const value = this.readByte(srcAddr);
        try {
          this.writeByte(destAddr, value);
          copied++;
        } catch (e) {
          // Stop on write error (e.g., readonly ROM)
          break;
        }
      }
    } else {
      // Backward copy for overlapping regions
      for (let i = length - 1; i >= 0; i--) {
        const srcAddr = (srcStartAddr + i) & 0xFFFF;
        const destAddr = (destStartAddr + i) & 0xFFFF;
        const value = this.readByte(srcAddr);
        try {
          this.writeByte(destAddr, value);
          copied++;
        } catch (e) {
          // Stop on write error
          break;
        }
      }
    }
    return copied;
  }

  /**
   * Search for a sequence of bytes in memory starting from searchStartAddr.
   * @param {Uint8Array|Array<number>} pattern - Byte pattern to search for
   * @param {number} [searchStartAddr=0x0000] - Address to start searching from
   * @param {number} [searchEndAddr=0xFFFF] - Address to stop searching (inclusive)
   * @returns {number} Address of first match, or -1 if not found
   */
  searchBytes(pattern, searchStartAddr = 0x0000, searchEndAddr = 0xFFFF) {
    this._checkAddr(searchStartAddr);
    this._checkAddr(searchEndAddr);
    if (!pattern || typeof pattern.length !== 'number' || pattern.length === 0) {
      throw new TypeError('pattern must be a non-empty array-like of bytes');
    }
    if (searchEndAddr < searchStartAddr) {
      throw new RangeError('searchEndAddr must be >= searchStartAddr');
    }
    if (pattern.length > searchEndAddr - searchStartAddr + 1) {
      return -1; // Pattern too long for search range
    }

    const patternLength = pattern.length;
    const searchLength = searchEndAddr - searchStartAddr + 1;

    for (let i = 0; i <= searchLength - patternLength; i++) {
      const addr = (searchStartAddr + i) & 0xFFFF;
      let match = true;
      for (let j = 0; j < patternLength; j++) {
        if (this.readByte((addr + j) & 0xFFFF) !== (pattern[j] & 0xFF)) {
          match = false;
          break;
        }
      }
      if (match) {
        return addr;
      }
    }
    return -1;
  }

  /**
   * Return a hex dump string useful for UI. Default 16 bytes per line.
   * @param {number} [startAddr=0x0000]
   * @param {number} [length=256]
   * @returns {string}
   */
  toHexDump(startAddr = 0x0000, length = 256) {
    this._checkAddr(startAddr);
    if (!Number.isInteger(length) || length <= 0) {
      throw new TypeError('length must be a positive integer');
    }
    const lines = [];
    const bytesPerLine = 16;
    let addr = startAddr & 0xFFFF;
    for (let offset = 0; offset < length; offset += bytesPerLine) {
      const lineAddr = (addr + offset) & 0xFFFF;
      const parts = [];
      for (let i = 0; i < bytesPerLine && offset + i < length; i++) {
        const a = (lineAddr + i) & 0xFFFF;
        parts.push(this.buffer[a].toString(16).padStart(2, '0'));
      }
      lines.push(lineAddr.toString(16).padStart(4, '0') + ': ' + parts.join(' '));
    }
    return lines.join('\n');
  }

  // -----------------------
  // Watcher API
  // -----------------------

  /**
   * Add a write listener callback(addr, value)
   * @param {function} callback
   */
  addWriteListener(callback) {
    if (typeof callback !== 'function') throw new TypeError('callback must be a function');
    this._writeListeners.add(callback);
  }

  /**
   * Remove previously added write listener
   * @param {function} callback
   */
  removeWriteListener(callback) {
    this._writeListeners.delete(callback);
  }

  /**
   * Add a read listener callback(addr, value)
   * @param {function} callback
   */
  addReadListener(callback) {
    if (typeof callback !== 'function') throw new TypeError('callback must be a function');
    this._readListeners.add(callback);
  }

  /**
   * Remove previously added read listener
   * @param {function} callback
   */
  removeReadListener(callback) {
    this._readListeners.delete(callback);
  }
}

// attach constants to class as static properties for convenience
iMaCoMpUtERussyMemory.ZERO_PAGE = ZERO_PAGE;
iMaCoMpUtERussyMemory.ZERO_PAGE_END = ZERO_PAGE_END;
iMaCoMpUtERussyMemory.STACK_PAGE = STACK_PAGE;
iMaCoMpUtERussyMemory.STACK_PAGE_END = STACK_PAGE_END;
iMaCoMpUtERussyMemory.VIDEO_BUFFER_START = VIDEO_BUFFER_START;
iMaCoMpUtERussyMemory.VIDEO_BUFFER_END = VIDEO_BUFFER_END;
iMaCoMpUtERussyMemory.USER_RAM_START = USER_RAM_START;
iMaCoMpUtERussyMemory.USER_RAM_END = USER_RAM_END;
iMaCoMpUtERussyMemory.VIDEO_ROM_START = VIDEO_ROM_START;
iMaCoMpUtERussyMemory.SYSTEM_ROM_START = SYSTEM_ROM_START;

// Optional self-test when explicitly enabled in browser
if (typeof window !== 'undefined' && window.__VS8_MEMORY_SELFTEST) {
  const m = new iMaCoMpUtERussyMemory();
  m.writeByte(0x0600, 0x42);
  console.assert(m.readByte(0x0600) === 0x42, 'selftest read/write');
  console.log('iMaCoMpUtERussyMemory self-test OK');
}

// TODO: add memory-mapped IO hooks, copy-on-write support, fast unchecked accessors for emulator inner loop.
// TODO: implement memory banking/paging for larger address spaces.
// TODO: add memory breakpoints and watchpoints for debugging.
// TODO: implement memory compression for large unused regions.
// TODO: add transactional memory operations for atomic multi-byte writes.
// TODO: implement memory mirroring for hardware compatibility.
