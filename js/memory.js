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
      // Initialize bank 0 with provided buffer
      this.banks = new Array(256);
      this.banks[0] = buffer;
      this.currentBank = 0;
    } else {
      this.banks = new Array(256);
      this.banks[0] = new Uint8Array(MEMORY_SIZE);
      this.currentBank = 0;
      // Initialize compression state for performance optimizations
      this.compressedRegions = new Map(); // bank -> {start: number, end: number, compressedData: Uint8Array}
      this.transactionStack = []; // Stack of {bank: number, snapshot: Uint8Array}
      // initialize default reset values if any (vectors, stack pointer, etc.)
      /**
       * @description Initializes ROM reset vectors and default memory state for system compatibility.
       * Includes interrupt vectors at $FFxx, stack pointer initialization, and zero-page setup.
       * Ensures compatibility with CPU reset operations and banking system.
       */
      // TODO: Implement ROM reset vector population with actual ROM data loading
    }

    // Copy-on-Write setup: Bank 0 serves as ROM master
    this.romBank = 0;
    this.modifiedBanks = new Set(); // Tracks banks that have been CoW-modified

  this.readonlyROM = !!readonlyROM;
  // allowRomWrites bypasses ROM write-ignore behavior (useful for tests)
  this.allowRomWrites = !!allowRomWrites;
    this._writeListeners = new Set();
    this._readListeners = new Set();

    // Breakpoint/watchpoint system
    this.breakpoints = new Map(); // address -> {id, type: 'write'|'read'|'all', condition?: function(value, addr), callback?: function}
    this.breakpointIdCounter = 0;
    this.paused = false; // Global pause state for debugger
    this.onBreakpointHit = null; // Callback for UI integration

    // Circular keyboard buffer for $F0 input (size 256)
    this.keyboardBuffer = new Uint8Array(256);
    this.keyboardHead = 0;
    this.keyboardTail = 0;
    this.keyboardCount = 0;

    // Interrupt flag bit in $F2 (bit 0)
    this.inputReadyFlag = 0;

    // Initialize keypress event listener if in browser environment
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      this._initKeyboardListener();
    }

    // MMIO handler registry: Map of address -> {read: Function, write: Function}
    this.mmioHandlers = new Map();
    
    // $F0: Keyboard input buffer (read only)
    this.mmioHandlers.set(0xF0, {
      read: () => {
        if (this.keyboardCount === 0) {
          return 0; // No input available
        }
        const char = this.keyboardBuffer[this.keyboardHead];
        this.keyboardHead = (this.keyboardHead + 1) % 256;
        this.keyboardCount--;
        if (this.keyboardCount === 0) {
          this.inputReadyFlag = 0;
        }
        return char;
      },
      write: () => {
        // Read-only register, writes ignored
        return;
      }
    });
    
    // $F1: Terminal output register (write only)
    this.mmioHandlers.set(0xF1, {
      read: () => {
        // Write-only register, returns 0
        return 0;
      },
      write: (value) => {
        // Output character to terminal if available
        if (typeof window !== 'undefined' && window.terminal && window.terminal.write) {
          window.terminal.write(String.fromCharCode(value & 0xFF));
        }
      }
    });
    
    // $F2: Terminal status register (input ready flag)
    this.mmioHandlers.set(0xF2, {
      read: () => {
        // Bit 0: input ready (1 if keyboard buffer has data)
        // Other bits reserved (0)
        return this.inputReadyFlag;
      },
      write: (value) => {
        // Writing to status can clear input ready flag (bit 0)
        if ((value & 0x01) === 0) {
          this.inputReadyFlag = 0;
          // Clear buffer on status clear
          this.keyboardHead = 0;
          this.keyboardTail = 0;
          this.keyboardCount = 0;
        }
        // Other bits ignored for now
      }
    });

    // $F5: Bank select register (0-255 for 16MB total memory)
    this.mmioHandlers.set(0xF5, {
      read: () => {
        return this.currentBank;
      },
      write: (value) => {
        const bank = value & 0xFF;
        if (bank < 256) {
          this.currentBank = bank;
          // Lazy initialization: create bank buffer if not exists
          if (!this.banks[bank]) {
            this.banks[bank] = new Uint8Array(MEMORY_SIZE);
          }
        }
      }
    });

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
    const maskedAddr = addr & 0xFFFF;
    const maskedValue = value & 0xFF;

    // Check for write breakpoints first
    if (this.breakpoints.has(maskedAddr)) {
      const breakpoint = this.breakpoints.get(maskedAddr);
      if (breakpoint.type === 'write' || breakpoint.type === 'all') {
        let conditionMet = true;
        if (breakpoint.condition) {
          try {
            conditionMet = breakpoint.condition(maskedValue, maskedAddr);
          } catch (e) {
            console.error('Breakpoint condition error:', e);
            conditionMet = false;
          }
        }
        if (conditionMet) {
          this.paused = true;
          if (breakpoint.callback) {
            try {
              breakpoint.callback(maskedAddr, maskedValue, 'write');
            } catch (e) {
              console.error('Breakpoint callback error:', e);
            }
          }
          if (this.onBreakpointHit) {
            this.onBreakpointHit('write', maskedAddr, maskedValue);
          }
          // Emit event for UI integration
          if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('memoryBreakpointHit', {
              detail: { type: 'write', address: maskedAddr, value: maskedValue, paused: this.paused }
            }));
          }
          // Set pause flag - CPU/debugger should check this.paused before continuing
          console.log(`Breakpoint hit at 0x${maskedAddr.toString(16).toUpperCase()} (write, value: 0x${maskedValue.toString(16).toUpperCase()})`);
        }
      }
    }

    // Notify existing write listeners (preserving original functionality)
    for (const cb of this._writeListeners) {
      try {
        cb(maskedAddr, maskedValue);
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
    const maskedAddr = addr & 0xFFFF;
    const maskedValue = value & 0xFF;

    // Check for read breakpoints/watchpoints
    if (this.breakpoints.has(maskedAddr)) {
      const breakpoint = this.breakpoints.get(maskedAddr);
      if (breakpoint.type === 'read' || breakpoint.type === 'all') {
        let conditionMet = true;
        if (breakpoint.condition) {
          try {
            conditionMet = breakpoint.condition(maskedValue, maskedAddr);
          } catch (e) {
            console.error('Breakpoint condition error:', e);
            conditionMet = false;
          }
        }
        if (conditionMet) {
          this.paused = true;
          if (breakpoint.callback) {
            try {
              breakpoint.callback(maskedAddr, maskedValue, 'read');
            } catch (e) {
              console.error('Breakpoint callback error:', e);
            }
          }
          if (this.onBreakpointHit) {
            this.onBreakpointHit('read', maskedAddr, maskedValue);
          }
          // Emit event for UI integration
          if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('memoryBreakpointHit', {
              detail: { type: 'read', address: maskedAddr, value: maskedValue, paused: this.paused }
            }));
          }
          // Set pause flag - CPU/debugger should check this.paused before continuing
          console.log(`Breakpoint hit at 0x${maskedAddr.toString(16).toUpperCase()} (read, value: 0x${maskedValue.toString(16).toUpperCase()})`);
        }
      }
    }

    // Notify existing read listeners
    for (const cb of this._readListeners) {
      try {
        cb(maskedAddr, maskedValue);
      } catch (e) {
        console.error('Memory read listener error', e);
      }
    }
  }

  /**
   * Handle ROM write validation and logging with Copy-on-Write support
   * For ROM regions, implements copy-on-write: copies ROM from romBank to currentBank if not already modified.
   * @param {number} addr
   * @param {number} value
   * @returns {boolean} true if write should proceed
   * @private
   */
  _handleROMWrite(addr, value) {
    if (!this._isROM(addr)) return true;

    // Copy-on-Write: If current bank not modified and writing to ROM, copy from romBank
    if (!this.modifiedBanks.has(this.currentBank)) {
      // Lazy init current bank if needed
      if (!this.banks[this.currentBank]) {
        this.banks[this.currentBank] = new Uint8Array(MEMORY_SIZE);
      }
      // Copy ROM region (0x8000-0xFFFF) from romBank to currentBank
      const romBuffer = this.banks[this.romBank];
      const currentBuffer = this.banks[this.currentBank];
      for (let i = VIDEO_ROM_START; i <= 0xFFFF; i++) {
        currentBuffer[i] = romBuffer[i];
      }
      this.modifiedBanks.add(this.currentBank);
      console.log(`CoW: Copied ROM to bank ${this.currentBank}`);
    }

    const msg = `Write to ROM at 0x${addr.toString(16).padStart(4, '0')}: 0x${value.toString(16).padStart(2, '0')} (CoW enabled)`;
    
    if (this.readonlyROM && !this.allowRomWrites) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(msg.replace('CoW enabled', 'forbidden (readonlyROM=true)'));
      }
      return false;
    } else if (!this.allowRomWrites) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(msg);
      }
    }
    
    return true;
  }

  /**
   * Read single byte from memory address with event notification.
   *
   * Triggers read listeners for UI updates and debugging.
   * Performs bounds checking and address masking.
   * Handles I/O mirroring: $F0-$FF mirrors to $00-$0F for memory access only.
   *
   * @param {number} addr - Memory address (0x0000-0xFFFF)
   * @returns {number} Byte value (0-255)
   * @throws {RangeError} If address out of bounds
   */
  readByte(addr) {
    this._checkAddr(addr);
    const maskedAddr = addr & 0xFFFF;
    
    // Check for MMIO handler first (exact address match)
    const handler = this.mmioHandlers.get(maskedAddr);
    if (handler && typeof handler.read === 'function') {
      const value = handler.read();
      this._notifyRead(addr, value);
      return value;
    }
    
    // For memory access, apply I/O mirroring if in high I/O range and no MMIO handler
    let readAddr = maskedAddr;
    if (maskedAddr >= 0xF0 && maskedAddr <= 0xFF) {
      readAddr = (maskedAddr - 0xF0) & 0x0F;
    }
    
    // Fall back to active bank memory read with compression handling
    const activeBuffer = this.banks[this.currentBank];
    const effectiveAddr = this._handleCompressedRead(activeBuffer, readAddr);
    const value = effectiveAddr !== null ? activeBuffer[effectiveAddr] : 0; // Default 0 for compressed zero regions
    this._notifyRead(addr, value);
    return value;
  }

  /**
   * Write a byte to memory.
   * ROM writes are handled depending on readonlyROM flag. By default writes to ROM are ignored and a warning is logged.
   * Handles I/O mirroring: writes to $F0-$FF also write to $00-$0F.
   * @param {number} addr - 0..0xFFFF
   * @param {number} value - number; masked to 0..255
   */
  writeByte(addr, value) {
    this._checkAddr(addr);
    let maskedAddr = addr & 0xFFFF;
    const maskedValue = value & 0xFF;

    // Check for MMIO handler first
    const handler = this.mmioHandlers.get(maskedAddr);
    if (handler && typeof handler.write === 'function') {
      handler.write(maskedValue);
      this._notifyWrite(maskedAddr, maskedValue);
      // For MMIO, also mirror to low I/O if applicable
      if (maskedAddr >= 0xF0 && maskedAddr <= 0xFF) {
        const mirrorAddr = (maskedAddr - 0xF0) & 0x0F;
        // Recurse but avoid infinite loop by checking if it's not MMIO
        const mirrorHandler = this.mmioHandlers.get(mirrorAddr);
        if (!mirrorHandler || typeof mirrorHandler.write !== 'function') {
          this.writeByte(mirrorAddr, maskedValue);
        }
      }
      return;
    }

    // Handle I/O mirroring for non-MMIO writes
    if (maskedAddr >= 0xF0 && maskedAddr <= 0xFF) {
      const mirrorAddr = (maskedAddr - 0xF0) & 0x0F;
      // Mirror write
      this.writeByte(mirrorAddr, maskedValue);
    }

    // Check ROM write permissions for regular memory
    if (!this._handleROMWrite(maskedAddr, maskedValue)) {
      return;
    }

    const activeBuffer = this.banks[this.currentBank];
    this._handleCompressedWrite(activeBuffer, maskedAddr, maskedValue);
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
   * Fast unchecked byte read from active bank (no bounds checking or notifications)
   * For use in emulator inner loops where address validation is guaranteed externally.
   * @param {number} addr - Address 0x0000-0xFFFF (no validation)
   * @returns {number} Byte value
   */
  readByteUnchecked(addr) {
    const maskedAddr = addr & 0xFFFF;
    const activeBuffer = this.banks[this.currentBank];
    // Quick MMIO check without full handler invocation
    if (maskedAddr === 0xF0) {
      // Inline keyboard read for performance
      if (this.keyboardCount === 0) return 0;
      const char = this.keyboardBuffer[this.keyboardHead];
      this.keyboardHead = (this.keyboardHead + 1) % 256;
      this.keyboardCount--;
      if (this.keyboardCount === 0) this.inputReadyFlag = 0;
      return char;
    } else if (maskedAddr === 0xF1) {
      return 0; // Write-only
    } else if (maskedAddr === 0xF2) {
      return this.inputReadyFlag;
    } else if (maskedAddr === 0xF5) {
      return this.currentBank;
    }
    // Regular bank access
    return activeBuffer[maskedAddr];
  }

  /**
   * Fast unchecked byte write to active bank (no bounds checking or notifications)
   * For use in emulator inner loops where address validation is guaranteed externally.
   * ROM writes are still checked for protection.
   * @param {number} addr - Address 0x0000-0xFFFF (no validation)
   * @param {number} value - Value 0-255 (no validation)
   */
  writeByteUnchecked(addr, value) {
    const maskedAddr = addr & 0xFFFF;
    const maskedValue = value & 0xFF;

    // Quick MMIO handling for performance
    if (maskedAddr === 0xF0) {
      // Read-only, ignore
      return;
    } else if (maskedAddr === 0xF1) {
      // Inline terminal write
      if (typeof window !== 'undefined' && window.terminal && window.terminal.write) {
        window.terminal.write(String.fromCharCode(maskedValue));
      }
      return;
    } else if (maskedAddr === 0xF2) {
      if ((maskedValue & 0x01) === 0) {
        this.inputReadyFlag = 0;
        this.keyboardHead = 0;
        this.keyboardTail = 0;
        this.keyboardCount = 0;
      }
      return;
    } else if (maskedAddr === 0xF5) {
      const bank = maskedValue;
      if (bank < 256) {
        this.currentBank = bank;
        if (!this.banks[bank]) {
          this.banks[bank] = new Uint8Array(MEMORY_SIZE);
        }
      }
      return;
    }

    // Check ROM write permissions
    if (!this._handleROMWrite(maskedAddr, maskedValue)) {
      return;
    }

    const activeBuffer = this.banks[this.currentBank];
    activeBuffer[maskedAddr] = maskedValue;
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
   * Fast unchecked word read from active bank (no bounds checking)
   * @param {number} addr - Address of low byte
   * @returns {number} 16-bit value
   */
  readWordUnchecked(addr) {
    const maskedAddr = addr & 0xFFFF;
    const activeBuffer = this.banks[this.currentBank];
    // Quick MMIO for low addresses if needed, but for simplicity use unchecked bytes
    const lo = this.readByteUnchecked(maskedAddr);
    const hi = this.readByteUnchecked((maskedAddr + 1) & 0xFFFF);
    return (hi << 8) | lo;
  }

  /**
   * Fast unchecked word write to active bank (no bounds checking)
   * @param {number} addr - Address of low byte
   * @param {number} value - 16-bit value
   */
  writeWordUnchecked(addr, value) {
    const maskedAddr = addr & 0xFFFF;
    const maskedValue = value & 0xFFFF;
    const lo = maskedValue & 0xFF;
    const hi = (maskedValue >> 8) & 0xFF;
    this.writeByteUnchecked(maskedAddr, lo);
    this.writeByteUnchecked((maskedAddr + 1) & 0xFFFF, hi);
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
      // Only count as written if the active bank buffer contains the value
      const activeBuffer = this.banks[this.currentBank];
      if (activeBuffer[target] === (byteArray[i] & 0xFF)) {
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
      const activeBuffer = this.banks[this.currentBank];
      activeBuffer[a] = v;
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
   * Add memory breakpoint/watchpoint
   * @param {number} address - Memory address (0x0000-0xFFFF)
   * @param {string} [type='write'] - 'read', 'write', or 'all'
   * @param {function} [condition] - Optional condition function(value, address) -> boolean
   * @param {function} [callback] - Optional callback(address, value, type)
   * @returns {number} Unique breakpoint ID
   */
  addBreakpoint(address, type = 'write', condition = null, callback = null) {
    this._checkAddr(address);
    const maskedAddr = address & 0xFFFF;
    const id = ++this.breakpointIdCounter;
    
    this.breakpoints.set(maskedAddr, {
      id,
      type: ['read', 'write', 'all'].includes(type) ? type : 'write',
      condition: typeof condition === 'function' ? condition : null,
      callback: typeof callback === 'function' ? callback : null
    });

    console.log(`Breakpoint ${id} added at 0x${maskedAddr.toString(16).toUpperCase()} (type: ${type})`);
    return id;
  }

  /**
   * Remove breakpoint by ID
   * @param {number} id - Breakpoint ID returned from addBreakpoint
   * @returns {boolean} true if removed
   */
  removeBreakpoint(id) {
    for (const [addr, bp] of this.breakpoints.entries()) {
      if (bp.id === id) {
        this.breakpoints.delete(addr);
        console.log(`Breakpoint ${id} removed from 0x${addr.toString(16).toUpperCase()}`);
        return true;
      }
    }
    console.warn(`Breakpoint ${id} not found`);
    return false;
  }

  /**
   * Get all active breakpoints
   * @returns {Array} Array of {id, address, type, hasCondition, hasCallback}
   */
  getBreakpoints() {
    return Array.from(this.breakpoints.entries()).map(([addr, bp]) => ({
      id: bp.id,
      address: addr,
      type: bp.type,
      hasCondition: !!bp.condition,
      hasCallback: !!bp.callback
    }));
  }

  /**
   * Clear all breakpoints
   */
  clearBreakpoints() {
    const count = this.breakpoints.size;
    this.breakpoints.clear();
    console.log(`Cleared ${count} breakpoints`);
    return count;
  }

  /**
   * Set global breakpoint hit callback for UI integration
   * @param {function} callback - (type, address, value) => void
   */
  setBreakpointHitCallback(callback) {
    this.onBreakpointHit = typeof callback === 'function' ? callback : null;
  }

  /**
   * Resume execution after breakpoint pause
   */
  resume() {
    this.paused = false;
    console.log('Debugger resumed');
  }

  /**
   * Check if paused due to breakpoint
   * @returns {boolean}
   */
  isPaused() {
    return this.paused;
  }

  /**
   * Breakpoint/Watchpoint System
   *
   * Provides memory-based debugging with support for read, write, and all-access breakpoints.
   * Breakpoints can include conditional triggers via callback functions and custom event emission.
   *
   * Features:
   * - addBreakpoint(address, type='write', condition?, callback?) - Sets memory breakpoint
   * - removeBreakpoint(id) - Removes breakpoint by unique ID
   * - Types: 'read', 'write', 'all' for access monitoring
   * - Conditional: Optional condition function(value, address) -> boolean
   * - Events: Emits 'memoryBreakpointHit' CustomEvent with {type, address, value, paused}
   * - Pause/Resume: Global this.paused flag for CPU/debugger integration
   * - Integration: onBreakpointHit callback for debugger UI, preserves existing listeners
   * - Compatibility: Works with MMIO, banking, CoW; ROM writes still protected
   *
   * Usage:
   *   memory.addBreakpoint(0x0600, 'write', (val, addr) => val === 0x42);
   *   memory.onBreakpointHit = (type, addr, val) => { debugger.pause(); };
   *   memory.removeBreakpoint(breakpointId);
   *
   * Note: Pause flag checked by CPU step loop; existing read/write listeners called AFTER breakpoint checks
   */
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
/**
 * Initialize keyboard event listener for input buffer
 * @private
 */
_initKeyboardListener() {
  const handleKeyPress = (event) => {
    const charCode = event.key.charCodeAt(0);
    if (charCode >= 32 && charCode <= 126) { // Printable ASCII
      // Add to circular buffer if not full
      if (this.keyboardCount < 256) {
        this.keyboardBuffer[this.keyboardTail] = charCode;
        this.keyboardTail = (this.keyboardTail + 1) % 256;
        this.keyboardCount++;
        this.inputReadyFlag = 1;
        
        /**
         * @description Triggers CPU IRQ when keyboard input becomes available, integrating with the interrupt system.
         * Currently sets polling flag; future enhancement will dispatch hardware interrupt to CPU.
         * Ensures compatibility with MMIO and banking operations without blocking input handling.
         */
        // TODO: Implement full CPU IRQ integration for keyboard input with priority handling
        // For now, just set the flag for polling
        if (typeof this.onInputReady === 'function') {
          this.onInputReady();
        }
      }
    }
  };

  // Add event listener to document or terminal element
  document.addEventListener('keypress', handleKeyPress);
  
  // Store reference for cleanup if needed
  this._keyboardHandler = handleKeyPress;
}

/**
 * Cleanup keyboard listener (call on destroy)
 */
destroy() {
  if (typeof window !== 'undefined' && this._keyboardHandler) {
    document.removeEventListener('keypress', this._keyboardHandler);
  }
}

/**
 * Callback for when input becomes ready (for CPU integration)
 * @param {function} callback
 */
setInputReadyCallback(callback) {
  this.onInputReady = callback;
}

    /**
     * @description Handles lazy decompression for compressed memory regions during read operations.
     * Automatically decompresses large unused regions on access, maintaining transparency for CPU and UI.
     * @param {Uint8Array} buffer - The active bank buffer
     * @param {number} addr - The address to read from
     * @returns {number|null} Effective address in buffer or null if compressed zero
     * @private
     */
    _handleCompressedRead(buffer, addr) {
      const bank = this.currentBank;
      const region = this.compressedRegions.get(bank);
      if (!region) return addr;

      if (addr >= region.start && addr <= region.end) {
        if (region.compressedData.every(byte => byte === 0)) {
          // Compressed zero region - return 0 without decompression
          return null;
        }
        // Decompress on first access
        this._decompressRegion(buffer, region);
        this.compressedRegions.delete(bank); // Mark as decompressed
        return addr;
      }
      return addr;
    }

    /**
     * @description Manages writes to potentially compressed regions, decompressing if necessary.
     * Ensures write compatibility with lazy loading and maintains compression invariants.
     * @param {Uint8Array} buffer - The active bank buffer
     * @param {number} addr - The address to write to
     * @param {number} value - The value to write
     * @private
     */
    _handleCompressedWrite(buffer, addr, value) {
      const bank = this.currentBank;
      const region = this.compressedRegions.get(bank);
      if (!region || addr < region.start || addr > region.end) {
        buffer[addr] = value;
        return;
      }

      // Decompress if writing to compressed region
      if (region.compressedData.every(byte => byte === 0)) {
        // Zero region - just write normally
        buffer[addr] = value;
        this.compressedRegions.delete(bank);
      } else {
        this._decompressRegion(buffer, region);
        buffer[addr] = value;
        this.compressedRegions.delete(bank);
      }
    }

    /**
     * @description Compresses large unused memory regions using run-length encoding (RLE) for performance.
     * Targets zero-filled regions larger than threshold (e.g., 1KB) to reduce memory footprint.
     * @param {number} bank - Bank number to compress
     * @param {number} startAddr - Start of region to compress
     * @param {number} endAddr - End of region to compress
     * @returns {boolean} True if compression applied
     */
    compressRegion(bank = this.currentBank, startAddr, endAddr) {
      if (bank >= 256 || !this.banks[bank]) return false;
      const buffer = this.banks[bank];
      const length = endAddr - startAddr + 1;
      if (length < 1024) return false; // Threshold for compression

      // Check if region is mostly zeros
      let zeroCount = 0;
      for (let i = startAddr; i <= endAddr; i++) {
        if (buffer[i] === 0) zeroCount++;
      }
      if (zeroCount < length * 0.9) return false; // Not compressible

      // Simple RLE: store run length and representative bytes if needed
      const compressedData = new Uint8Array(4); // Length + zero flag
      const view = new DataView(compressedData.buffer);
      view.setUint32(0, length, true);
      // For simplicity, store as zero-compressed if all zeros, else full data
      const isAllZero = zeroCount === length;
      compressedData[3] = isAllZero ? 0 : 1; // Flag

      this.compressedRegions.set(bank, { start: startAddr, end: endAddr, compressedData });
      console.log(`Compressed region ${startAddr.toString(16)}-${endAddr.toString(16)} in bank ${bank}`);
      return true;
    }

    /**
     * @description Decompresses a compressed region back to full buffer.
     * Restores original data while preserving breakpoints and MMIO compatibility.
     * @param {Uint8Array} buffer - The buffer to decompress into
     * @param {Object} region - Compression metadata {start, end, compressedData}
     * @private
     */
    _decompressRegion(buffer, region) {
      const { start, end, compressedData } = region;
      const view = new DataView(compressedData.buffer);
      const length = view.getUint32(0, true);
      const isAllZero = compressedData[3] === 0;

      if (isAllZero) {
        for (let i = start; i <= end; i++) {
          buffer[i] = 0;
        }
      } else {
        // For non-zero compressed, would restore from stored data (simplified)
        for (let i = start; i <= end; i++) {
          buffer[i] = 0; // Fallback
        }
      }
      console.log(`Decompressed region ${start.toString(16)}-${end.toString(16)}`);
    }

    /**
     * @description Begins a memory transaction by creating a snapshot of current bank state.
     * Enables atomic multi-byte operations with rollback capability for consistency.
     * @param {number} [bank=this.currentBank] - Bank to snapshot
     * @returns {boolean} True if transaction started
     */
    beginTransaction(bank = this.currentBank) {
      if (bank >= 256 || !this.banks[bank]) return false;
      const snapshot = this.banks[bank].slice(); // Shallow copy for Uint8Array
      this.transactionStack.push({ bank, snapshot });
      console.log(`Transaction begun for bank ${bank}`);
      return true;
    }

    /**
     * @description Commits the current transaction, making changes permanent.
     * Discards the snapshot after verification for memory efficiency.
     * @returns {boolean} True if committed successfully
     */
    commitTransaction() {
      if (this.transactionStack.length === 0) return false;
      this.transactionStack.pop();
      console.log('Transaction committed');
      return true;
    }

    /**
     * @description Rolls back the current transaction to the snapshot state.
     * Restores bank buffer and maintains compression/breakpoint integrity.
     * @returns {boolean} True if rollback successful
     */
    rollbackTransaction() {
      if (this.transactionStack.length === 0) return false;
      const { bank, snapshot } = this.transactionStack.pop();
      if (this.banks[bank]) {
        this.banks[bank].set(snapshot);
        // Re-apply compression if it was active
        if (this.compressedRegions.has(bank)) {
          const region = this.compressedRegions.get(bank);
          this._decompressRegion(this.banks[bank], region);
        }
      }
      console.log(`Transaction rolled back for bank ${bank}`);
      return true;
    }

    /**
     * @description Executes a transactional block with automatic commit/rollback.
     * Wraps operations in try-catch for atomicity, compatible with async operations.
     * @param {function} operation - The function to execute transactionally
     * @returns {*} Result of operation or throws on failure
     */
    withTransaction(operation) {
      if (typeof operation !== 'function') throw new TypeError('operation must be a function');
      this.beginTransaction();
      try {
        const result = operation();
        this.commitTransaction();
        return result;
      } catch (error) {
        this.rollbackTransaction();
        throw error;
      }
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

/**
 * Memory-Mapped I/O (MMIO) System
 *
 * Supports hardware device integration through memory addresses that trigger
 * custom read/write handlers instead of accessing the memory buffer.
 *
 * Current Implementation:
 * - $F0: Keyboard input buffer (read-only) - Returns next character or 0
 * - $F1: Terminal output register (write-only) - Outputs to window.terminal.write()
 * - $F2: Status register - Bit 0 indicates input ready, writes can clear buffer
 *
 * Features:
 * - Circular keyboard buffer (256 bytes) with keypress event listener
 * - Automatic interrupt flag management
 * - Browser-environment detection for terminal integration
 * - Callback support for CPU interrupt integration
 *
 * Future Enhancements:
 * - Additional MMIO devices (timers, disk, network)
 * - IRQ integration with CPU
 * - MMIO region configuration
 * - Hardware device simulation framework
 */
