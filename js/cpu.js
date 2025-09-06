/**
 * iMaCoMpUtERussy CPU Emulator - 6502-Compatible Processor
 *
 * Implements 6502 instruction set with custom video and I/O extensions.
 * Supports debugging, interrupts, and async execution for UI integration.
 *
 * @class iMaCoMpUtERussyCPU
 * @author Kyle Durepos
 */

// Import breakpoints from debugger if available
let breakpoints = new Set();
if (typeof window !== 'undefined' && window.breakpoints) {
    breakpoints = window.breakpoints;
}

import { iMaCoMpUtERussyMemory } from './memory.js';

// Memory map constants
export const MEMORY_MAP = {
    ZERO_PAGE: { start: 0x0000, end: 0x00FF, description: 'Zero Page - Fast access variables' },
    STACK: { start: 0x0100, end: 0x01FF, description: 'Stack Page' },
    VIDEO_BUFFER: { start: 0x0200, end: 0x05FF, description: 'Video Buffer - 1KB for VLD/VST operations' },
    USER_RAM: { start: 0x0600, end: 0x7FFF, description: 'User RAM - Program and data space' },
    VIDEO_ROM: { start: 0x8000, end: 0xBFFF, description: 'Video ROM - Read-only video routines' },
    SYSTEM_ROM: { start: 0xC000, end: 0xFFFF, description: 'System ROM - Operating system and BIOS' }
};

// Status flag bit positions in P register
export const FLAGS = {
    CARRY: 0,      // C - Carry flag
    ZERO: 1,       // Z - Zero flag
    INTERRUPT: 2,  // I - Interrupt disable
    DECIMAL: 3,    // D - Decimal mode (unused in this implementation)
    BREAK: 4,      // B - Break command
    UNUSED: 5,     // Always 1
    OVERFLOW: 6,   // V - Overflow flag
    NEGATIVE: 7    // N - Negative flag
};

/**
 * Main CPU class with register management and instruction execution.
 *
 * @param {Object} options - Configuration options
 * @param {iMaCoMpUtERussyMemory} options.memory - Memory instance
 */
export class iMaCoMpUtERussyCPU {
    /**
     * Constructor initializes CPU with memory reference and registers
     * @param {Object} options - Configuration options
     * @param {iMaCoMpUtERussyMemory} options.memory - Memory instance (optional, creates internal if not provided)
     */
    constructor({ memory } = {}) {
        this.memory = memory || new iMaCoMpUtERussyMemory();
        this.pendingIRQ = false; // Hardware interrupt pending flag
        this.reset();
    }

    /**
     * Reset CPU to power-on state, initialize registers and vectors.
     * Sets PC to $0600 (user RAM start).
     */
    reset() {
        this.A = 0;        // Accumulator (8-bit)
        this.X = 0;        // X register (8-bit)
        this.Y = 0;        // Y register (8-bit)
        this.SP = 0xFF;    // Stack Pointer (8-bit, grows downward from 0x01FF)
        this.PC = 0x0600;  // Program Counter (16-bit, starts in USER_RAM)
        this.P = 0x24;     // Status register (bit 5 always set, bit 2 I flag set to disable interrupts initially)
        this.running = true;
        this.pendingIRQ = false;

        // Initialize interrupt vector table at 0xFF00-0xFFFF
        // IRQ/BRK vector at 0xFFFE-0xFFFF points to default handler at 0xFF00
        this.writeByte(0xFFFE, 0x00); // Low byte of IRQ vector
        this.writeByte(0xFFFF, 0xFF); // High byte of IRQ vector
        // NMI vector at 0xFFFA-0xFFFB (not implemented)
        this.writeByte(0xFFFA, 0x00);
        this.writeByte(0xFFFB, 0xFF);
        // Reset vector at 0xFFFC-0xFFFD points to 0x0600
        this.writeByte(0xFFFC, 0x00);
        this.writeByte(0xFFFD, 0x06);
    }

    /**
     * Set a status flag in the P register
     * @param {string} flagName - Flag name (C, Z, I, D, B, V, N)
     * @param {boolean} value - Flag value
     */
    setFlag(flagName, value) {
        const flagMap = {
            'C': 0, 'Z': 1, 'I': 2, 'D': 3, 'B': 4, 'V': 6, 'N': 7
        };
        const bit = flagMap[flagName.toUpperCase()];
        if (bit === undefined) return;

        if (value) {
            this.P |= (1 << bit);
        } else {
            this.P &= ~(1 << bit);
        }

        // Bit 5 (UNUSED) is always set to 1
        this.P |= (1 << 5);
    }

    /**
     * Get a status flag from the P register
     * @param {string} flagName - Flag name (C, Z, I, D, B, V, N)
     * @returns {boolean} Flag value
     */
    getFlag(flagName) {
        const flagMap = {
            'C': 0, 'Z': 1, 'I': 2, 'D': 3, 'B': 4, 'V': 6, 'N': 7
        };
        const bit = flagMap[flagName.toUpperCase()];
        return bit !== undefined ? !!(this.P & (1 << bit)) : false;
    }

    /**
     * Set pending IRQ flag (for external hardware simulation)
     * @param {boolean} pending - Whether IRQ is pending
     */
    setPendingIRQ(pending) {
        this.pendingIRQ = !!pending;
    }

    /**
     * Handle IRQ/BRK interrupt: push state to stack, load vector, set I flag.
     * @param {boolean} isBRK - BRK vs hardware IRQ
     * @returns {number} 7 cycles
     */
    handleInterrupt(isBRK = false) {
        if (this.getFlag('I')) {
            // Interrupts disabled, ignore
            return 0;
        }

        const cycles = isBRK ? 7 : 7; // Standard 6502 cycles

        // Push PC (high byte first)
        this.push((this.PC >> 8) & 0xFF);
        this.push(this.PC & 0xFF);

        // Push P register (with B flag set for BRK)
        let status = this.P;
        if (isBRK) {
            status |= (1 << FLAGS.BREAK); // Set B flag for BRK
        }
        status |= (1 << FLAGS.UNUSED); // Always set bit 5
        this.push(status);

        // Set I flag to disable further interrupts
        this.setFlag('I', true);

        // Load PC from IRQ vector 0xFFFE-0xFFFF
        const low = this.readByte(0xFFFE);
        const high = this.readByte(0xFFFF);
        this.PC = (high << 8) | low;

        console.log(`Interrupt handled: ${isBRK ? 'BRK' : 'IRQ'} at PC=0x${this.PC.toString(16).toUpperCase()}`);
        return cycles;
    }

    /**
     * Push byte to stack
     * @param {number} value - Byte value to push (0-255)
     */
    push(value) {
        this.writeByte(0x0100 + this.SP, value);
        this.SP = (this.SP - 1) & 0xFF;
    }

    /**
     * Pop byte from stack
     * @returns {number} Popped byte value
     */
    pop() {
        this.SP = (this.SP + 1) & 0xFF;
        return this.readByte(0x0100 + this.SP);
    }

    /**
     * Read byte from memory (handles both injected memory object and internal array)
     * @param {number} address - Memory address
     * @returns {number} Byte value
     */
    readByte(address) {
        if (this.memory.readByte) {
            return this.memory.readByte(address);
        }
        return this.memory[address];
    }

    /**
     * Write byte to memory (handles both injected memory object and internal array)
     * @param {number} address - Memory address
     * @param {number} value - Byte value
     */
    writeByte(address, value) {
        if (this.memory.writeByte) {
            this.memory.writeByte(address, value);
        } else {
            this.memory[address] = value;
        }
    }

    /**
     * Update zero and negative flags based on value
     * @param {number} value - Value to test
     */
    updateZN(value) {
        this.setFlag('Z', (value & 0xFF) === 0);
        this.setFlag('N', (value & 0x80) !== 0);
    }

    /**
     * Addressing mode dispatcher based on mode string
     * @param {string} mode - Addressing mode ('imm', 'abs', 'zp', 'zpx', 'absx', 'absy', 'indy', 'imp')
     * @returns {number|null} Operand value or effective address
     */
    getAddressOrValue(mode) {
        switch (mode) {
            case 'imm':
                return this.addrImmediate();
            case 'abs':
                return this.addrAbsolute();
            case 'zp':
                return this.addrZeroPage();
            case 'imp':
                return null;
            case 'zpx':
                return this.addrZeroPageX();
            case 'absx':
                return this.addrAbsoluteX();
            case 'absy':
                return this.addrAbsoluteY();
            case 'indy':
                return this.addrIndirectY();
            default:
                console.warn(`Unknown addressing mode: ${mode}`);
                return null;
        }
    }

    /**
     * Addressing mode: Immediate - next byte is operand
     * @returns {number} Operand value
     */
    addrImmediate() {
        return this.readByte(this.PC++);
    }

    /**
     * Addressing mode: Absolute - next two bytes are address
     * @returns {number} Effective address
     */
    addrAbsolute() {
        const low = this.readByte(this.PC++);
        const high = this.readByte(this.PC++);
        return (high << 8) | low;
    }

    /**
     * Addressing mode: Zero Page - next byte is zero page address
     * @returns {number} Effective address (0x00xx)
     */
    addrZeroPage() {
        return this.readByte(this.PC++);
    }

    /**
     * Addressing mode: Implied - no operand
     * @returns {null}
     */
    addrImplied() {
        return null;
    }

    /**
     * Addressing mode: Zero page,X - zero page address + X register
     * @returns {number} Address
     */
    addrZeroPageX() {
        const addr = this.readByte(this.PC++);
        return (addr + this.X) & 0xFF;
    }

    /**
     * Addressing mode: Absolute,X - absolute address + X register
     * @returns {number} Address
     */
    addrAbsoluteX() {
        const addr = this.addrAbsolute();
        return (addr + this.X) & 0xFFFF;
    }

    /**
     * Addressing mode: Absolute,Y - absolute address + Y register
     * @returns {number} Address
     */
    addrAbsoluteY() {
        const addr = this.addrAbsolute();
        return (addr + this.Y) & 0xFFFF;
    }

    /**
     * Addressing mode: (Zero page),Y - indirect zero page + Y register
     * @returns {number} Address
     */
    addrIndirectY() {
        const zpAddr = this.readByte(this.PC++);
        const baseAddr = this.readByte(zpAddr) | (this.readByte((zpAddr + 1) & 0xFF) << 8);
        return (baseAddr + this.Y) & 0xFFFF;
    }

    /**
     * Execute a single instruction and advance PC
     * @returns {number} Cycles used (approximate, not cycle-accurate)
     */
    executeInstruction() {
        if (!this.running) return 0;

        const opcode = this.readByte(this.PC++);
        let cycles = 1; // Base cycles, not accurate

        // Use opcode table for dispatch (to be populated with all instructions)
        const instructionHandlers = this.getInstructionHandlers();
        const handler = instructionHandlers[opcode];
        if (handler) {
            cycles = handler.call(this);
        } else {
            console.warn(`Unknown opcode 0x${opcode.toString(16).padStart(2, '0')} at PC 0x${(this.PC - 1).toString(16).padStart(4, '0')}`);
            // Treat as NOP
        }

        return cycles;
    }

    /**
     * Get instruction handlers object mapping opcode to handler functions
     * @returns {Object} Opcode to handler map
     */
    getInstructionHandlers() {
        return {
            // Interrupt instructions
            0x00: () => this.handleInterrupt(true), // BRK
            0x40: () => {
                this.P = this.pop();
                this.P |= (1 << FLAGS.UNUSED);
                const low = this.pop();
                const high = this.pop();
                this.PC = (high << 8) | low;
                console.log(`RTI returned to PC=0x${this.PC.toString(16).toUpperCase()}`);
                return 6;
            }, // RTI

            // Load Accumulator (LDA)
            0xA9: () => { // immediate
                this.A = this.getAddressOrValue('imm');
                this.updateZN(this.A);
                return 2;
            },
            0xAD: () => { // absolute
                const addr = this.getAddressOrValue('abs');
                this.A = this.readByte(addr);
                this.updateZN(this.A);
                return 4;
            },
            0xA5: () => { // zero page
                const addr = this.getAddressOrValue('zp');
                this.A = this.readByte(addr);
                this.updateZN(this.A);
                return 3;
            },

            // Load X Register (LDX)
            0xA2: () => { // immediate
                this.X = this.getAddressOrValue('imm');
                this.updateZN(this.X);
                return 2;
            },
            0xAE: () => { // absolute
                const addr = this.getAddressOrValue('abs');
                this.X = this.readByte(addr);
                this.updateZN(this.X);
                return 4;
            },
            0xA6: () => { // zero page
                const addr = this.getAddressOrValue('zp');
                this.X = this.readByte(addr);
                this.updateZN(this.X);
                return 3;
            },

            // Load Y Register (LDY)
            0xA0: () => { // immediate
                this.Y = this.getAddressOrValue('imm');
                this.updateZN(this.Y);
                return 2;
            },
            0xAC: () => { // absolute
                const addr = this.getAddressOrValue('abs');
                this.Y = this.readByte(addr);
                this.updateZN(this.Y);
                return 4;
            },
            0xA4: () => { // zero page
                const addr = this.getAddressOrValue('zp');
                this.Y = this.readByte(addr);
                this.updateZN(this.Y);
                return 3;
            },

            // Store Accumulator (STA)
            0x8D: () => { // absolute
                const addr = this.getAddressOrValue('abs');
                this.writeByte(addr, this.A);
                return 4;
            },
            0x85: () => { // zero page
                const addr = this.getAddressOrValue('zp');
                this.writeByte(addr, this.A);
                return 3;
            },

            // Store X Register (STX)
            0x8E: () => { // absolute
                const addr = this.getAddressOrValue('abs');
                this.writeByte(addr, this.X);
                return 4;
            },
            0x86: () => { // zero page
                const addr = this.getAddressOrValue('zp');
                this.writeByte(addr, this.X);
                return 3;
            },

            // Store Y Register (STY)
            0x8C: () => { // absolute
                const addr = this.getAddressOrValue('abs');
                this.writeByte(addr, this.Y);
                return 4;
            },
            0x84: () => { // zero page
                const addr = this.getAddressOrValue('zp');
                this.writeByte(addr, this.Y);
                return 3;
            },

            // Add with Carry (ADC)
            0x69: () => { // immediate
                const operand = this.getAddressOrValue('imm');
                const result = this.A + operand + (this.getFlag('C') ? 1 : 0);
                this.setFlag('C', result > 0xFF);
                this.setFlag('V', ((this.A ^ result) & (operand ^ result) & 0x80) !== 0);
                this.A = result & 0xFF;
                this.updateZN(this.A);
                return 2;
            },
            0x6D: () => { // absolute
                const addr = this.getAddressOrValue('abs');
                const operand = this.readByte(addr);
                const carry = this.getFlag('C') ? 1 : 0;
                const result = this.A + operand + carry;
                this.setFlag('C', result > 0xFF);
                this.setFlag('V', ((this.A ^ result) & (operand ^ result) & 0x80) !== 0);
                this.A = result & 0xFF;
                this.updateZN(this.A);
                return 4;
            },

            // Subtract with Carry (SBC)
            0xE9: () => { // immediate
                const operand = this.getAddressOrValue('imm');
                const result = this.A - operand - (this.getFlag('C') ? 0 : 1);
                this.setFlag('C', result >= 0);
                this.setFlag('V', ((this.A ^ result) & (~operand ^ result) & 0x80) !== 0);
                this.A = result & 0xFF;
                this.updateZN(this.A);
                return 2;
            },

            // Increment Memory (INC)
            0xEE: () => { // absolute
                const addr = this.getAddressOrValue('abs');
                const value = (this.readByte(addr) + 1) & 0xFF;
                this.writeByte(addr, value);
                this.updateZN(value);
                return 6;
            },
            0xE6: () => { // zero page
                const addr = this.getAddressOrValue('zp');
                const value = (this.readByte(addr) + 1) & 0xFF;
                this.writeByte(addr, value);
                this.updateZN(value);
                return 5;
            },

            // Decrement Memory (DEC)
            0xCE: () => { // absolute
                const addr = this.getAddressOrValue('abs');
                const value = (this.readByte(addr) - 1) & 0xFF;
                this.writeByte(addr, value);
                this.updateZN(value);
                return 6;
            },
            0xC6: () => { // zero page
                const addr = this.getAddressOrValue('zp');
                const value = (this.readByte(addr) - 1) & 0xFF;
                this.writeByte(addr, value);
                this.updateZN(value);
                return 5;
            },

            // Increment X Register (INX)
            0xE8: () => {
                this.X = (this.X + 1) & 0xFF;
                this.updateZN(this.X);
                return 2;
            },

            // Increment Y Register (INY)
            0xC8: () => {
                this.Y = (this.Y + 1) & 0xFF;
                this.updateZN(this.Y);
                return 2;
            },

            // Decrement X Register (DEX)
            0xCA: () => {
                this.X = (this.X - 1) & 0xFF;
                this.updateZN(this.X);
                return 2;
            },

            // Decrement Y Register (DEY)
            0x88: () => {
                this.Y = (this.Y - 1) & 0xFF;
                this.updateZN(this.Y);
                return 2;
            },

            // Logical AND (AND)
            0x29: () => { // immediate
                this.A &= this.getAddressOrValue('imm');
                this.updateZN(this.A);
                return 2;
            },
            0x2D: () => { // absolute
                const addr = this.getAddressOrValue('abs');
                this.A &= this.readByte(addr);
                this.updateZN(this.A);
                return 4;
            },

            // Logical OR (ORA)
            0x09: () => { // immediate
                this.A |= this.getAddressOrValue('imm');
                this.updateZN(this.A);
                return 2;
            },

            // Exclusive OR (EOR)
            0x49: () => { // immediate
                this.A ^= this.getAddressOrValue('imm');
                this.updateZN(this.A);
                return 2;
            },

            // Compare Accumulator (CMP)
            0xC9: () => { // immediate
                const operand = this.getAddressOrValue('imm');
                const result = this.A - operand;
                this.setFlag('C', this.A >= operand);
                this.updateZN(result & 0xFF);
                return 2;
            },
            0xC5: () => { // zero page
                const addr = this.getAddressOrValue('zp');
                const operand = this.readByte(addr);
                const result = this.A - operand;
                this.setFlag('C', this.A >= operand);
                this.updateZN(result & 0xFF);
                return 3;
            },
            0xCD: () => { // absolute
                const addr = this.getAddressOrValue('abs');
                const operand = this.readByte(addr);
                const result = this.A - operand;
                this.setFlag('C', this.A >= operand);
                this.updateZN(result & 0xFF);
                return 4;
            },
            0xD5: () => { // zero page,X
                const addr = this.getAddressOrValue('zpx');
                const operand = this.readByte(addr);
                const result = this.A - operand;
                this.setFlag('C', this.A >= operand);
                this.updateZN(result & 0xFF);
                return 4;
            },
            0xD1: () => { // indirect,Y
                const addr = this.getAddressOrValue('indy');
                const operand = this.readByte(addr);
                const result = this.A - operand;
                this.setFlag('C', this.A >= operand);
                this.updateZN(result & 0xFF);
                return 5;
            },
            0xDD: () => { // absolute,X
                const addr = this.getAddressOrValue('absx');
                const operand = this.readByte(addr);
                const result = this.A - operand;
                this.setFlag('C', this.A >= operand);
                this.updateZN(result & 0xFF);
                return 4;
            },
            0xD9: () => { // absolute,Y
                const addr = this.getAddressOrValue('absy');
                const operand = this.readByte(addr);
                const result = this.A - operand;
                this.setFlag('C', this.A >= operand);
                this.updateZN(result & 0xFF);
                return 4;
            },

            // Compare X Register (CPX)
            0xE0: () => { // immediate
                const operand = this.getAddressOrValue('imm');
                const result = this.X - operand;
                this.setFlag('C', this.X >= operand);
                this.updateZN(result & 0xFF);
                return 2;
            },
            0xE4: () => { // zero page
                const addr = this.getAddressOrValue('zp');
                const operand = this.readByte(addr);
                const result = this.X - operand;
                this.setFlag('C', this.X >= operand);
                this.updateZN(result & 0xFF);
                return 3;
            },
            0xEC: () => { // absolute
                const addr = this.getAddressOrValue('abs');
                const operand = this.readByte(addr);
                const result = this.X - operand;
                this.setFlag('C', this.X >= operand);
                this.updateZN(result & 0xFF);
                return 4;
            },

            // Compare Y Register (CPY)
            0xC0: () => { // immediate
                const operand = this.getAddressOrValue('imm');
                const result = this.Y - operand;
                this.setFlag('C', this.Y >= operand);
                this.updateZN(result & 0xFF);
                return 2;
            },
            0xC4: () => { // zero page
                const addr = this.getAddressOrValue('zp');
                const operand = this.readByte(addr);
                const result = this.Y - operand;
                this.setFlag('C', this.Y >= operand);
                this.updateZN(result & 0xFF);
                return 3;
            },
            0xCC: () => { // absolute
                const addr = this.getAddressOrValue('abs');
                const operand = this.readByte(addr);
                const result = this.Y - operand;
                this.setFlag('C', this.Y >= operand);
                this.updateZN(result & 0xFF);
                return 4;
            },

            // Jump (JMP)
            0x4C: () => { // absolute
                this.PC = this.getAddressOrValue('abs');
                return 3;
            },

            // Branch if Equal (BEQ)
            0xF0: () => {
                const offset = this.getAddressOrValue('imm');
                if (this.getFlag('Z')) {
                    const signedOffset = offset < 128 ? offset : offset - 256;
                    this.PC = (this.PC + signedOffset) & 0xFFFF;
                    return 3; // +1 if branch taken (simplified)
                }
                return 2;
            },

            // Branch if Not Equal (BNE)
            0xD0: () => {
                const offset = this.getAddressOrValue('imm');
                if (!this.getFlag('Z')) {
                    const signedOffset = offset < 128 ? offset : offset - 256;
                    this.PC = (this.PC + signedOffset) & 0xFFFF;
                    return 3;
                }
                return 2;
            },

            // Branch if Carry Set (BCS)
            0xB0: () => {
                const offset = this.getAddressOrValue('imm');
                if (this.getFlag('C')) {
                    const signedOffset = offset < 128 ? offset : offset - 256;
                    this.PC = (this.PC + signedOffset) & 0xFFFF;
                    return 3;
                }
                return 2;
            },

            // Push Accumulator (PHA)
            0x48: () => {
                this.push(this.A);
                return 3;
            },

            // Pull Accumulator (PLA)
            0x68: () => {
                this.A = this.pop();
                this.updateZN(this.A);
                return 4;
            },

            /**
             * VLD (0x8B) - Video Load: Load predefined graphics pattern to video buffer $0200-$05FF
             *
             * Immediate addressing: blockIndex (0-15) selects from 16 predefined 64-byte patterns:
             * 0: Checkerboard (alternating 0x00/0x03 bytes)
             * 1: Horizontal gradient (0x00 to 0x03 across 32 pixels)
             * 2: Vertical gradient (0x00 to 0x03 down 24 lines)
             * 3: Diagonal gradient (main diagonal pattern)
             * 4: Solid black (all 0x00)
             * 5: Solid bright green (all 0x03)
             * 6: Horizontal stripes (alternating rows)
             * 7: Vertical stripes (alternating columns)
             * 8: Circle shape (simple Bresenham approximation)
             * 9: Rectangle outline (border pattern)
             * 10: Filled rectangle (solid block)
             * 11: Crosshair (center lines)
             * 12: Text "A" (8x8 bitmap approximation)
             * 13: Text "B" (8x8 bitmap approximation)
             * 14: Text "C" (8x8 bitmap approximation)
             * 15: Random noise (pseudo-random bytes)
             *
             * Loads 1024 bytes (32x32 pixels, 1 byte per pixel, 2-bit color) into video buffer.
             * Sets C flag: 0=success, 1=invalid index (>15).
             * Triggers MCP 'video.patternLoaded' event if mcpWebSocket available.
             *
             * @returns {number} 4 cycles (2 for immediate + 2 for memory write)
             */
            0x8B: () => {
                const blockIndex = this.getAddressOrValue('imm');
                const videoStart = 0x0200;
                const videoEnd = 0x05FF;
                const bufferSize = 1024; // 32x32 pixels

                // Predefined 64-byte pattern templates (repeated/expanded to 1024 bytes)
                const patterns = [
                    // 0: Checkerboard (8x8 base, repeated)
                    new Uint8Array(64).map((_, i) => (i % 2 === 0 ? 0x00 : 0x03)),
                    // 1: Horizontal gradient (0-3 across row)
                    new Uint8Array(64).map((_, i) => Math.floor((i % 8) / 2)),
                    // 2: Vertical gradient (0-3 down column)
                    new Uint8Array(64).map((_, i) => Math.floor(i / 8) % 4),
                    // 3: Diagonal gradient
                    new Uint8Array(64).map((_, i) => ((i % 8) + Math.floor(i / 8)) % 4),
                    // 4: Solid black
                    new Uint8Array(64).fill(0x00),
                    // 5: Solid bright green
                    new Uint8Array(64).fill(0x03),
                    // 6: Horizontal stripes (even rows 0x00, odd 0x03)
                    new Uint8Array(64).map((_, i) => (Math.floor(i / 8) % 2 === 0 ? 0x00 : 0x03)),
                    // 7: Vertical stripes (even columns 0x00, odd 0x03)
                    new Uint8Array(64).map((_, i) => ((i % 8) % 2 === 0 ? 0x00 : 0x03)),
                    // 8: Circle (simple 8x8 approximation)
                    new Uint8Array([
                        0x00,0x00,0x00,0x03,0x03,0x00,0x00,0x00,
                        0x00,0x00,0x03,0x03,0x03,0x03,0x00,0x00,
                        0x00,0x03,0x03,0x03,0x03,0x03,0x03,0x00,
                        0x03,0x03,0x03,0x03,0x03,0x03,0x03,0x03,
                        0x03,0x03,0x03,0x03,0x03,0x03,0x03,0x03,
                        0x00,0x03,0x03,0x03,0x03,0x03,0x03,0x00,
                        0x00,0x00,0x03,0x03,0x03,0x03,0x00,0x00,
                        0x00,0x00,0x00,0x03,0x03,0x00,0x00,0x00
                    ]),
                    // 9: Rectangle outline
                    new Uint8Array([
                        0x03,0x03,0x03,0x03,0x03,0x03,0x03,0x03,
                        0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x03,
                        0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x03,
                        0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x03,
                        0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x03,
                        0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x03,
                        0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x03,
                        0x03,0x03,0x03,0x03,0x03,0x03,0x03,0x03
                    ]),
                    // 10: Filled rectangle
                    new Uint8Array([
                        0x03,0x03,0x03,0x03,0x03,0x03,0x03,0x03,
                        0x03,0x03,0x03,0x03,0x03,0x03,0x03,0x03,
                        0x03,0x03,0x03,0x03,0x03,0x03,0x03,0x03,
                        0x03,0x03,0x03,0x03,0x03,0x03,0x03,0x03,
                        0x03,0x03,0x03,0x03,0x03,0x03,0x03,0x03,
                        0x03,0x03,0x03,0x03,0x03,0x03,0x03,0x03,
                        0x03,0x03,0x03,0x03,0x03,0x03,0x03,0x03,
                        0x03,0x03,0x03,0x03,0x03,0x03,0x03,0x03
                    ]),
                    // 11: Crosshair (center lines)
                    new Uint8Array(64).map((_, i) => {
                        const x = i % 8;
                        const y = Math.floor(i / 8);
                        return (x === 3 || x === 4 || y === 3 || y === 4) ? 0x03 : 0x00;
                    }),
                    // 12: Text "A" (simple 8x8)
                    new Uint8Array([
                        0x00,0x03,0x03,0x00,0x00,0x03,0x03,0x00,
                        0x03,0x00,0x00,0x03,0x03,0x00,0x00,0x03,
                        0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x03,
                        0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x03,
                        0x03,0x03,0x03,0x03,0x03,0x03,0x03,0x03,
                        0x03,0x00,0x00,0x03,0x03,0x00,0x00,0x03,
                        0x03,0x00,0x00,0x03,0x03,0x00,0x00,0x03,
                        0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00
                    ]),
                    // 13: Text "B"
                    new Uint8Array([
                        0x03,0x03,0x03,0x03,0x03,0x00,0x00,0x00,
                        0x03,0x00,0x00,0x00,0x03,0x03,0x03,0x00,
                        0x03,0x00,0x00,0x00,0x00,0x00,0x03,0x03,
                        0x03,0x03,0x03,0x03,0x03,0x00,0x00,0x03,
                        0x03,0x00,0x00,0x00,0x03,0x03,0x03,0x03,
                        0x03,0x00,0x00,0x00,0x00,0x00,0x03,0x03,
                        0x03,0x00,0x00,0x00,0x00,0x00,0x03,0x03,
                        0x03,0x03,0x03,0x03,0x03,0x00,0x00,0x00
                    ]),
                    // 14: Text "C"
                    new Uint8Array([
                        0x00,0x03,0x03,0x03,0x03,0x03,0x03,0x00,
                        0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x03,
                        0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
                        0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
                        0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
                        0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
                        0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x03,
                        0x00,0x03,0x03,0x03,0x03,0x03,0x03,0x00
                    ]),
                    // 15: Random noise (simple pseudo-random)
                    new Uint8Array(64).map(() => Math.floor(Math.random() * 4))
                ];

                if (blockIndex >= 0 && blockIndex <= 15) {
                    const pattern = patterns[blockIndex];
                    let offset = 0;
                    
                    // Expand 64-byte pattern to 1024 bytes (repeat 16 times)
                    for (let i = 0; i < 16; i++) {
                        for (let j = 0; j < 64; j++) {
                            if (offset < bufferSize) {
                                this.writeByte(videoStart + offset, pattern[j]);
                                offset++;
                            }
                        }
                    }
                    
                    // Trigger MCP event if available
                    if (typeof window !== 'undefined' && window.mcpWebSocket?.readyState === WebSocket.OPEN) {
                        window.mcpWebSocket.send(JSON.stringify({
                            type: 'video.patternLoaded',
                            data: { blockIndex, bufferStart: videoStart, size: bufferSize }
                        }));
                    }
                    
                    this.setFlag('C', false); // Success
                } else {
                    this.setFlag('C', true); // Invalid index
                }
                return 4; // Cycles: 2 for immediate + 2 for buffer load
            },

            // VST (0x9B) - Video Store: Write A register (2-bit color) to video buffer
            // Immediate addressing: pixel offset 0-1023 maps to $0200-$05FF
            // Colors: 00=black, 01=green, 10=dark green, 11=bright green
            // C flag: 0=success, 1=invalid address
            0x9B: () => {
                const offset = this.getAddressOrValue('imm');
                const addr = 0x0200 + offset;
                if (addr <= 0x05FF) {
                    const color = this.A & 0x03; // Extract 2-bit color
                    this.memory.writeByte(addr, color);
                    // Trigger UI pixel update if available
                    if (window?.videoDisplay?.updatePixel) {
                        const x = offset % 32;
                        const y = Math.floor(offset / 32);
                        window.videoDisplay.updatePixel(x, y, color);
                    }
                    this.setFlag('C', false);
                } else {
                    this.setFlag('C', true);
                }
                return 2;
            },

            // VUP (0xAB) - Video Update: Refresh canvas from video buffer
            // Implied addressing: updates entire 32×24 display from $0200-$05FF
            // Triggers HTML5 canvas redraw with CRT effects
            // C flag: 0=success, 1=display unavailable
            0xAB: () => {
                if (window?.videoDisplay?.updateDisplay) {
                    window.videoDisplay.updateDisplay();
                    // Emit MCP event for remote monitoring
                    if (window?.mcpWebSocket?.readyState === WebSocket.OPEN) {
                        window.mcpWebSocket.send(JSON.stringify({
                            type: 'video.update',
                            data: { buffer: 0x0200, size: 1024 }
                        }));
                    }
                    this.setFlag('C', false);
                } else {
                    this.setFlag('C', true);
                }
                return 1;
            },

            // VDL (0xBB) - Video Delay: Non-blocking frame timing (60Hz)
            // Immediate addressing: 0-255 frames (max ~4.25 seconds)
            // Uses setTimeout for UI responsiveness during animations
            // C flag: always 0 (delay succeeds)
            0xBB: () => {
                const frames = this.getAddressOrValue('imm');
                const delayMs = frames * 16.67; // 60Hz timing
                setTimeout(() => {
                    // Optional completion event
                    if (window?.mcpWebSocket?.readyState === WebSocket.OPEN) {
                        window.mcpWebSocket.send(JSON.stringify({
                            type: 'video.delayComplete',
                            data: { frames }
                        }));
                    }
                }, delayMs);
                this.setFlag('C', false);
                return 2;
            },

            // HLT (0x3A) - Halt: Stop CPU execution, set running=false
            // Implied addressing: program termination instruction
            // Triggers UI status update and MCP halt event
            // All registers/memory preserved for inspection
            0x3A: () => {
                this.running = false;
                console.log(`HLT: CPU halted at PC=0x${this.PC.toString(16).toUpperCase()}`);
                
                // Update UI status
                if (typeof window?.updateStatus === 'function') {
                    window.updateStatus('CPU HALTED - Program completed', 'success');
                }
                
                // MCP event
                if (window?.mcpWebSocket?.readyState === WebSocket.OPEN) {
                    window.mcpWebSocket.send(JSON.stringify({
                        type: 'cpu.halt',
                        data: { finalPC: this.PC, registers: { A: this.A, X: this.X, Y: this.Y, SP: this.SP, P: this.P } }
                    }));
                }
                
                this.pendingIRQ = false; // Clear pending interrupts
                return 1;
            }
        };
    }

    /**
     * Execute one instruction (alias for executeInstruction for UI compatibility)
     * @returns {number} Cycles used
     */
    step() {
        if (!this.running) return 0;

        // Check for breakpoint before executing instruction
        if (typeof window !== 'undefined' && window.breakpoints && window.breakpoints.has(this.PC)) {
            console.log(`Breakpoint hit at PC=0x${this.PC.toString(16).toUpperCase()}`);
            this.running = false; // Stop execution on breakpoint
            if (typeof window.updateStatus === 'function') {
                window.updateStatus(`Breakpoint hit at 0x${this.PC.toString(16).toUpperCase()}`, 'warning');
            }
            return 0;
        }

        // Check for pending interrupt before executing instruction
        if (this.pendingIRQ && !this.getFlag('I')) {
            const irqCycles = this.handleInterrupt(false);
            if (irqCycles > 0) {
                this.pendingIRQ = false; // Clear pending flag after handling
                return irqCycles;
            }
        }

        const cycles = this.executeInstruction();

        // Update video display if executing in video ROM range 0x8000-0x9FFF
        if (this.PC >= 0x8000 && this.PC <= 0x9FFF && window?.videoManager?.videoUpdate) {
            try {
                window.videoManager.videoUpdate();
            } catch (error) {
                console.warn('Video update during CPU step failed:', error);
            }
        }

        // Check for breakpoint after instruction execution
        if (typeof window !== 'undefined' && window.breakpoints && window.breakpoints.has(this.PC)) {
            console.log(`Breakpoint hit at PC=0x${this.PC.toString(16).toUpperCase()} after instruction`);
            this.running = false;
            if (typeof window.updateStatus === 'function') {
                window.updateStatus(`Breakpoint hit at 0x${this.PC.toString(16).toUpperCase()}`, 'warning');
            }
            return cycles;
        }

        return cycles;
    }

    /**
     * Load program via MCP - enhanced version that supports MCP events
     * @param {Uint8Array} bytes - Program bytes to load
     * @param {number} origin - Memory origin address
     * @param {Object} options - Additional options
     * @param {boolean} options.viaMCP - Whether loaded via MCP
     * @param {string} options.source - Original assembly source (for logging)
     */
    loadProgramMCP(bytes, origin, options = {}) {
        const { viaMCP = false, source = null } = options;
        
        // Call standard loadProgram
        this.memory.loadProgram(bytes, origin);
        
        // Set PC to origin
        this.PC = origin;
        
        // Log MCP event if applicable
        if (viaMCP && window.logToMCP) {
            window.logToMCP('info', `MCP Program Load: ${bytes.length} bytes at 0x${origin.toString(16).toUpperCase()}`, {
                origin,
                bytesLoaded: bytes.length,
                sourceLength: source ? source.length : 0,
                viaMCP: true
            });
        }
        
        // Trigger memory refresh if available
        if (typeof window.refreshMemoryDisplay === 'function') {
            window.refreshMemoryDisplay();
        }
        
        console.log(`CPU: Loaded ${bytes.length} bytes at 0x${origin.toString(16).toUpperCase()} ${viaMCP ? '(via MCP)' : ''}`);
        
        return { success: true, bytesLoaded: bytes.length, origin };
    }

    /**
     * Run program with MCP integration
     * @param {number} maxSteps - Maximum steps to execute
     * @param {Object} options - Additional options
     * @param {boolean} options.viaMCP - Whether triggered via MCP
     */
    runProgramMCP(maxSteps = 1000, options = {}) {
        const { viaMCP = false } = options;
        
        const stepsExecuted = this.run(maxSteps, true);
        
        // Log MCP event if applicable
        if (viaMCP && window.logToMCP) {
            window.logToMCP('info', `MCP Program Run: Executed ${stepsExecuted} steps`, {
                stepsExecuted,
                startPC: this.PC - stepsExecuted,
                currentPC: this.PC,
                viaMCP: true
            });
        }
        
        // Refresh displays
        if (typeof window.refreshDisplay === 'function') {
            window.refreshDisplay();
        }
        if (typeof window.refreshMemoryDisplay === 'function') {
            window.refreshMemoryDisplay();
        }
        
        console.log(`CPU: Executed ${stepsExecuted} steps ${viaMCP ? '(via MCP)' : ''}`);
        
        return { success: true, stepsExecuted, finalPC: this.PC };
    }

    /**
     * Run multiple instructions asynchronously to prevent blocking
     * @param {number} stepsOrTimeout - Maximum steps to execute, or 0 for unlimited
     * @param {boolean} autoCleanup - Whether to automatically cleanup after execution
     * @returns {Promise<number>} Steps executed
     */
    async run(stepsOrTimeout = 0, autoCleanup = false) {
        let steps = 0;
        const maxSteps = stepsOrTimeout > 0 ? stepsOrTimeout : Infinity;
        const YIELD_INTERVAL = 100; // Yield every 100 steps to prevent UI blocking

        try {
            while (this.running && steps < maxSteps) {
                // Check for pending interrupt in each step
                if (this.pendingIRQ && !this.getFlag('I')) {
                    const irqCycles = this.handleInterrupt(false);
                    if (irqCycles > 0) {
                        this.pendingIRQ = false;
                        steps++; // Count interrupt as a step
                        // Yield after interrupt handling
                        await new Promise(resolve => setTimeout(resolve, 0));
                        continue;
                    }
                }

                // Execute in batches to allow UI updates
                for (let i = 0; i < YIELD_INTERVAL && this.running && steps < maxSteps; i++) {
                    try {
                        const instructionCycles = this.executeInstruction();
                        steps++;
                        // Accumulate cycles if tracking, but for simplicity just count instructions
                    } catch (error) {
                        console.error('CPU execution error:', error);
                        if (window.logToMCP) {
                            window.logToMCP('error', `CPU execution failed at step ${steps}: ${error.message}`);
                        }
                        this.running = false;
                        throw error;
                    }
                }

                // Yield to event loop if not finished
                if (this.running && steps < maxSteps) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
        } catch (error) {
            console.error('CPU run error:', error);
            this.running = false;
            throw error;
        } finally {
            if (autoCleanup) {
                this.cleanup();
            }
        }

        return steps;
    }

    /**
     * Cleanup CPU state and memory references after emulation session
     * Explicitly dereferences state for garbage collection
     */
    cleanup() {
        // Stop running state
        this.running = false;

        // Clear registers and state
        this.A = null;
        this.X = null;
        this.Y = null;
        this.SP = null;
        this.PC = null;
        this.P = null;

        // Clear memory reference if it was internally created
        if (this.memory && !this.memory.readByte && !this.memory.writeByte && Array.isArray(this.memory)) {
            // Internal array memory - can be nulled
            this.memory = null;
        } else if (this.memory) {
            // External memory object - just dereference
            this.memory = null;
        }
    }
}
