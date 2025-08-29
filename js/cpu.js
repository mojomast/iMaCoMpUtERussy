/**
 * iMaCoMpUtERussy CPU Emulator
 * 6502-inspired 8-bit CPU implementation
 * Created by Kyle Durepos
 */

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

export class iMaCoMpUtERussyCPU {
    /**
     * Constructor initializes CPU with memory reference and registers
     * @param {Object} options - Configuration options
     * @param {iMaCoMpUtERussyMemory} options.memory - Memory instance (optional, creates internal if not provided)
     */
    constructor({ memory } = {}) {
        this.memory = memory || new iMaCoMpUtERussyMemory();
        this.reset();
    }

    /**
     * Reset CPU to initial state
     */
    reset() {
        this.A = 0;        // Accumulator (8-bit)
        this.X = 0;        // X register (8-bit)
        this.Y = 0;        // Y register (8-bit)
        this.SP = 0xFF;    // Stack Pointer (8-bit, grows downward from 0x01FF)
        this.PC = 0x0600;  // Program Counter (16-bit, starts in USER_RAM)
        this.P = 0x20;     // Status register (bit 5 always set)
        this.running = true;
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

        switch (opcode) {
            // LDA - Load Accumulator
            case 0xA9: { // LDA immediate
                this.A = this.addrImmediate();
                this.updateZN(this.A);
                break;
            }
            case 0xAD: { // LDA absolute
                const addr = this.addrAbsolute();
                this.A = this.readByte(addr);
                this.updateZN(this.A);
                break;
            }
            case 0xA5: { // LDA zero page
                const addr = this.addrZeroPage();
                this.A = this.readByte(addr);
                this.updateZN(this.A);
                break;
            }

            // LDX - Load X register
            case 0xA2: { // LDX immediate
                this.X = this.addrImmediate();
                this.updateZN(this.X);
                break;
            }
            case 0xAE: { // LDX absolute
                const addr = this.addrAbsolute();
                this.X = this.readByte(addr);
                this.updateZN(this.X);
                break;
            }
            case 0xA6: { // LDX zero page
                const addr = this.addrZeroPage();
                this.X = this.readByte(addr);
                this.updateZN(this.X);
                break;
            }

            // LDY - Load Y register
            case 0xA0: { // LDY immediate
                this.Y = this.addrImmediate();
                this.updateZN(this.Y);
                break;
            }
            case 0xAC: { // LDY absolute
                const addr = this.addrAbsolute();
                this.Y = this.readByte(addr);
                this.updateZN(this.Y);
                break;
            }
            case 0xA4: { // LDY zero page
                const addr = this.addrZeroPage();
                this.Y = this.readByte(addr);
                this.updateZN(this.Y);
                break;
            }

            // STA - Store Accumulator
            case 0x8D: { // STA absolute
                const addr = this.addrAbsolute();
                this.writeByte(addr, this.A);
                break;
            }
            case 0x85: { // STA zero page
                const addr = this.addrZeroPage();
                this.writeByte(addr, this.A);
                break;
            }

            // STX - Store X register
            case 0x8E: { // STX absolute
                const addr = this.addrAbsolute();
                this.writeByte(addr, this.X);
                break;
            }
            case 0x86: { // STX zero page
                const addr = this.addrZeroPage();
                this.writeByte(addr, this.X);
                break;
            }

            // STY - Store Y register
            case 0x8C: { // STY absolute
                const addr = this.addrAbsolute();
                this.writeByte(addr, this.Y);
                break;
            }
            case 0x84: { // STY zero page
                const addr = this.addrZeroPage();
                this.writeByte(addr, this.Y);
                break;
            }

            // ADC - Add with Carry
            case 0x69: { // ADC immediate
                const operand = this.addrImmediate();
                const result = this.A + operand + (this.getFlag('C') ? 1 : 0);
                this.setFlag('C', result > 0xFF);
                this.setFlag('V', ((this.A ^ result) & (operand ^ result) & 0x80) !== 0);
                this.A = result & 0xFF;
                this.updateZN(this.A);
                break;
            }
            case 0x6D: { // ADC absolute
                const addr = this.addrAbsolute();
                const operand = this.readByte(addr);
                const carry = this.getFlag('C') ? 1 : 0;
                const result = this.A + operand + carry;
                this.setFlag('C', result > 0xFF);
                this.setFlag('V', ((this.A ^ result) & (operand ^ result) & 0x80) !== 0);
                this.A = result & 0xFF;
                this.updateZN(this.A);
                break;
            }

            // SBC - Subtract with Carry
            case 0xE9: { // SBC immediate
                const operand = this.addrImmediate();
                const result = this.A - operand - (this.getFlag('C') ? 0 : 1);
                this.setFlag('C', result >= 0);
                this.setFlag('V', ((this.A ^ result) & (~operand ^ result) & 0x80) !== 0);
                this.A = result & 0xFF;
                this.updateZN(this.A);
                break;
            }

            // INC - Increment Memory
            case 0xEE: { // INC absolute
                const addr = this.addrAbsolute();
                const value = (this.readByte(addr) + 1) & 0xFF;
                this.writeByte(addr, value);
                this.updateZN(value);
                break;
            }
            case 0xE6: { // INC zero page
                const addr = this.addrZeroPage();
                const value = (this.readByte(addr) + 1) & 0xFF;
                this.writeByte(addr, value);
                this.updateZN(value);
                break;
            }

            // DEC - Decrement Memory
            case 0xCE: { // DEC absolute
                const addr = this.addrAbsolute();
                const value = (this.readByte(addr) - 1) & 0xFF;
                this.writeByte(addr, value);
                this.updateZN(value);
                break;
            }
            case 0xC6: { // DEC zero page
                const addr = this.addrZeroPage();
                const value = (this.readByte(addr) - 1) & 0xFF;
                this.writeByte(addr, value);
                this.updateZN(value);
                break;
            }

            // INX - Increment X Register
            case 0xE8: {
                this.X = (this.X + 1) & 0xFF;
                this.updateZN(this.X);
                break;
            }

            // INY - Increment Y Register
            case 0xC8: {
                this.Y = (this.Y + 1) & 0xFF;
                this.updateZN(this.Y);
                break;
            }

            // DEX - Decrement X Register
            case 0xCA: {
                this.X = (this.X - 1) & 0xFF;
                this.updateZN(this.X);
                break;
            }

            // DEY - Decrement Y Register
            case 0x88: {
                this.Y = (this.Y - 1) & 0xFF;
                this.updateZN(this.Y);
                break;
            }

            // AND - Logical AND
            case 0x29: { // AND immediate
                this.A &= this.addrImmediate();
                this.updateZN(this.A);
                break;
            }
            case 0x2D: { // AND absolute
                const addr = this.addrAbsolute();
                this.A &= this.readByte(addr);
                this.updateZN(this.A);
                break;
            }

            // ORA - Logical OR
            case 0x09: { // ORA immediate
                this.A |= this.addrImmediate();
                this.updateZN(this.A);
                break;
            }

            // EOR - Exclusive OR
            case 0x49: { // EOR immediate
                this.A ^= this.addrImmediate();
                this.updateZN(this.A);
                break;
            }

            // CMP - Compare accumulator
            case 0xC9: { // CMP immediate
                const operand = this.addrImmediate();
                const result = this.A - operand;
                this.setFlag('C', this.A >= operand); // Carry clear if A < operand
                this.updateZN(result & 0xFF);
                break;
            }
            case 0xC5: { // CMP zero page
                const addr = this.addrZeroPage();
                const operand = this.readByte(addr);
                const result = this.A - operand;
                this.setFlag('C', this.A >= operand);
                this.updateZN(result & 0xFF);
                break;
            }
            case 0xCD: { // CMP absolute
                const addr = this.addrAbsolute();
                const operand = this.readByte(addr);
                const result = this.A - operand;
                this.setFlag('C', this.A >= operand);
                this.updateZN(result & 0xFF);
                break;
            }
            case 0xD5: { // CMP zero page,X
                const addr = this.addrZeroPageX();
                const operand = this.readByte(addr);
                const result = this.A - operand;
                this.setFlag('C', this.A >= operand);
                this.updateZN(result & 0xFF);
                break;
            }
            case 0xD1: { // CMP (zero page),Y
                const addr = this.addrIndirectY();
                const operand = this.readByte(addr);
                const result = this.A - operand;
                this.setFlag('C', this.A >= operand);
                this.updateZN(result & 0xFF);
                break;
            }
            case 0xDD: { // CMP absolute,X
                const addr = this.addrAbsoluteX();
                const operand = this.readByte(addr);
                const result = this.A - operand;
                this.setFlag('C', this.A >= operand);
                this.updateZN(result & 0xFF);
                break;
            }
            case 0xD9: { // CMP absolute,Y
                const addr = this.addrAbsoluteY();
                const operand = this.readByte(addr);
                const result = this.A - operand;
                this.setFlag('C', this.A >= operand);
                this.updateZN(result & 0xFF);
                break;
            }

            // CPX - Compare X register
            case 0xE0: { // CPX immediate
                const operand = this.addrImmediate();
                const result = this.X - operand;
                this.setFlag('C', this.X >= operand);
                this.updateZN(result & 0xFF);
                break;
            }
            case 0xE4: { // CPX zero page
                const addr = this.addrZeroPage();
                const operand = this.readByte(addr);
                const result = this.X - operand;
                this.setFlag('C', this.X >= operand);
                this.updateZN(result & 0xFF);
                break;
            }
            case 0xEC: { // CPX absolute
                const addr = this.addrAbsolute();
                const operand = this.readByte(addr);
                const result = this.X - operand;
                this.setFlag('C', this.X >= operand);
                this.updateZN(result & 0xFF);
                break;
            }

            // CPY - Compare Y register
            case 0xC0: { // CPY immediate
                const operand = this.addrImmediate();
                const result = this.Y - operand;
                this.setFlag('C', this.Y >= operand);
                this.updateZN(result & 0xFF);
                break;
            }
            case 0xC4: { // CPY zero page
                const addr = this.addrZeroPage();
                const operand = this.readByte(addr);
                const result = this.Y - operand;
                this.setFlag('C', this.Y >= operand);
                this.updateZN(result & 0xFF);
                break;
            }
            case 0xCC: { // CPY absolute
                const addr = this.addrAbsolute();
                const operand = this.readByte(addr);
                const result = this.Y - operand;
                this.setFlag('C', this.Y >= operand);
                this.updateZN(result & 0xFF);
                break;
            }

            // JMP - Jump
            case 0x4C: { // JMP absolute
                this.PC = this.addrAbsolute();
                break;
            }

            // BEQ - Branch if Equal (Zero set)
            case 0xF0: {
                const offset = this.addrImmediate();
                if (this.getFlag('Z')) {
                    // Branch target is PC + signed offset
                    const signedOffset = offset < 128 ? offset : offset - 256;
                    this.PC = (this.PC + signedOffset) & 0xFFFF;
                }
                break;
            }

            // BNE - Branch if Not Equal (Zero clear)
            case 0xD0: {
                const offset = this.addrImmediate();
                if (!this.getFlag('Z')) {
                    // Branch target is PC + signed offset
                    const signedOffset = offset < 128 ? offset : offset - 256;
                    this.PC = (this.PC + signedOffset) & 0xFFFF;
                }
                break;
            }

            // BCS - Branch if Carry Set
            case 0xB0: {
                const offset = this.addrImmediate();
                if (this.getFlag('C')) {
                    // Branch target is PC + signed offset
                    const signedOffset = offset < 128 ? offset : offset - 256;
                    this.PC = (this.PC + signedOffset) & 0xFFFF;
                }
                break;
            }

            // PHA - Push Accumulator
            case 0x48: {
                this.push(this.A);
                break;
            }

            // PLA - Pull Accumulator
            case 0x68: {
                this.A = this.pop();
                this.updateZN(this.A);
                break;
            }

            // VLD - Video Load (stub: read from video buffer)
            case 0x8B: { // VLD immediate block index
                const blockIndex = this.addrImmediate();
                // TODO: Implement actual video block loading from $0200-$05FF
                // For now, just set success flag and load dummy data
                this.setFlag('C', true); // Success flag
                break;
            }

            // VST - Video Store (write to video buffer)
            case 0x9B: { // VST immediate block index
                const blockIndex = this.addrImmediate();
                // Write current A register to video buffer position
                const addr = 0x0200 + blockIndex;
                if (addr <= 0x05FF) { // Stay within video buffer range
                    this.memory.writeByte(addr, this.A);
                    this.setFlag('C', false); // Success
                } else {
                    this.setFlag('C', true); // Error - out of bounds
                }
                break;
            }

            // VUP - Video Update (update display)
            case 0xAB: { // VUP implied
                // Trigger video display update if available
                if (window.videoDisplay) {
                    window.videoDisplay.updateDisplay();
                    this.setFlag('C', false); // Success
                } else {
                    this.setFlag('C', true); // Error - no display
                }
                break;
            }

            // VDL - Video Delay (timing control)
            case 0xBB: { // VDL immediate frames
                const frames = this.addrImmediate();
                // Simple delay implementation (16ms per frame = ~60fps)
                const delayMs = frames * 16;
                setTimeout(() => {
                    // Resume execution after delay
                }, delayMs);
                this.setFlag('C', false); // Success
                break;
            }

            // HLT - Halt
            case 0x3A: {
                this.running = false;
                break;
            }

            default:
                // Unknown opcode - treat as NOP
                break;
        }

        return cycles;
    }

    /**
     * Execute one instruction (alias for executeInstruction for UI compatibility)
     * @returns {number} Cycles used
     */
    step() {
        return this.executeInstruction();
    }

    /**
     * Run multiple instructions
     * @param {number} stepsOrTimeout - Maximum steps to execute, or 0 for unlimited
     * @returns {number} Steps executed
     */
    run(stepsOrTimeout = 0) {
        let steps = 0;
        const maxSteps = stepsOrTimeout > 0 ? stepsOrTimeout : Infinity;

        while (this.running && steps < maxSteps) {
            this.executeInstruction();
            steps++;
        }

        return steps;
    }
}
