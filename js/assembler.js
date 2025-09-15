/**
 * VideoStorage-8 Assembler
 *
 * Converts simple VideoStorage-8 assembly into bytes for loading into memory.
 * Supports implied, immediate, absolute, zero-page, and indexed addressing modes.
 * Supports basic expression evaluation with + and - operators (left-to-right).
 *
 * Example assembly:
 * .org 0x0600
 * start: LDA #10
 * STA 0x00
 * LDA $1234,X  ; Absolute indexed by X
 * STA $12,Y    ; Zero-page indexed by Y
 * LDA #$10+5   ; Expression in immediate
 * HLT
 *
 * TODO: Add support for expression precedence and parentheses.
 * TODO: Add support for more operators (*, /, etc.).
 * TODO: Add support for indirect addressing ((ind),X ; (ind),Y).
 * TODO: Add support for indirect indexed and other advanced modes.
 */

/**
 * Opcode table mapping mnemonics and addressing modes to numeric opcode values.
 * Opcodes are assigned consistently but do not necessarily match real 6502.
 */
export const opcodeTable = {
  'LDA': { '#': 0xA9, 'zp': 0xA5, 'abs': 0xAD, 'zpx': 0xB5, 'zpy': 0xB1, 'absx': 0xBD, 'absy': 0xB9 },
  'LDX': { '#': 0xA2, 'zp': 0xA6, 'abs': 0xAE, 'zpy': 0xB6, 'absy': 0xBE },
  'LDY': { '#': 0xA0, 'zp': 0xA4, 'abs': 0xAC, 'zpx': 0xB4, 'absx': 0xBC },
  'STA': { 'zp': 0x85, 'abs': 0x8D, 'zpx': 0x95, 'zpy': 0x91, 'absx': 0x9D, 'absy': 0x99 },
  'STX': { 'zp': 0x86, 'abs': 0x8E, 'zpy': 0x96, 'absy': 0x9E },
  'STY': { 'zp': 0x84, 'abs': 0x8C, 'zpx': 0x94, 'absx': 0x9C },
  'ADC': { '#': 0x69, 'zp': 0x65, 'abs': 0x6D, 'zpx': 0x75, 'zpy': 0x71, 'absx': 0x7D, 'absy': 0x79 },
  'SBC': { '#': 0xE9, 'zp': 0xE5, 'abs': 0xED, 'zpx': 0xF5, 'zpy': 0xF1, 'absx': 0xFD, 'absy': 0xF9 },
  'INC': { 'zp': 0xE6, 'abs': 0xEE, 'zpx': 0xF6, 'absx': 0xFE },
  'DEC': { 'zp': 0xC6, 'abs': 0xCE, 'zpx': 0xD6, 'absx': 0xDE },
  'INX': { 'imp': 0xE8 },
  'INY': { 'imp': 0xC8 },
  'DEX': { 'imp': 0xCA },
  'DEY': { 'imp': 0x88 },
  'AND': { '#': 0x29, 'zp': 0x25, 'abs': 0x2D, 'zpx': 0x35, 'zpy': 0x31, 'absx': 0x3D, 'absy': 0x39 },
  'ORA': { '#': 0x09, 'zp': 0x05, 'abs': 0x0D, 'zpx': 0x15, 'zpy': 0x11, 'absx': 0x1D, 'absy': 0x19 },
  'EOR': { '#': 0x49, 'zp': 0x45, 'abs': 0x4D, 'zpx': 0x55, 'zpy': 0x51, 'absx': 0x5D, 'absy': 0x59 },
  'CMP': { '#': 0xC9, 'zp': 0xC5, 'abs': 0xCD, 'zpx': 0xD5, 'zpy': 0xD1, 'absx': 0xDD, 'absy': 0xD9 },
  'CPX': { '#': 0xE0, 'zp': 0xE4, 'abs': 0xEC },
  'CPY': { '#': 0xC0, 'zp': 0xC4, 'abs': 0xCC },
  'JMP': { 'abs': 0x4C },
  'BEQ': { 'rel': 0xF0 },
  'BNE': { 'rel': 0xD0 },
  'BCS': { 'rel': 0xB0 },
  'PHA': { 'imp': 0x48 },
  'PLA': { 'imp': 0x68 },
  'VLD': { 'zp': 0x32, 'abs': 0x33 },
  'VST': { '#': 0x9B },
  'VUP': { 'imp': 0xAB },
  'VDL': { '#': 0xBB },
  'HLT': { 'imp': 0x3A }
};

/**
 * Parse a number from string: hex ($ or 0x), binary (0b), or decimal.
 */
function parseNumber(s) {
  s = s.trim();
  if (s.startsWith('$')) {
    return parseInt(s.slice(1), 16);
  } else if (s.startsWith('0x')) {
    return parseInt(s, 16);
  } else if (s.startsWith('0b')) {
    return parseInt(s, 2);
  } else {
    return parseInt(s, 10);
  }
}

/**
 * Strip comments from a line (starting with ; or //).
 */
function stripComment(line) {
  let idx = line.indexOf(';');
  if (idx >= 0) {
    line = line.slice(0, idx);
  }
  idx = line.indexOf('//');
  if (idx >= 0) {
    line = line.slice(0, idx);
  }
  return line;
}

/**
 * Parse an operand string into type and value.
 * Supports indexed addressing ($1234,X), zero-page indexed ($12,Y), and expressions.
 */
function parseOperand(op) {
  if (!op) return null;
  op = op.trim();
  let baseOp = op;
  let index = null;
  let isIndexed = false;

  // Check for indexed addressing
  const commaIdx = op.indexOf(',');
  if (commaIdx >= 0) {
    baseOp = op.slice(0, commaIdx).trim();
    const indexPart = op.slice(commaIdx + 1).trim().toUpperCase();
    if (indexPart === 'X' || indexPart === 'Y') {
      index = indexPart;
      isIndexed = true;
    } else {
      throw new Error(`Invalid index register: ${indexPart}`);
    }
  }

  if (op.startsWith('#')) {
    const val = baseOp.slice(1).trim();
    if (isIndexed) {
      throw new Error('Indexed addressing not supported for immediate operands');
    }
    // Check if expression
    if (val.includes('+') || val.includes('-')) {
      return { type: 'imm', value: val };
    }
    const num = parseNumber(val);
    return isNaN(num) ? { type: 'imm', value: val } : { type: 'imm', value: num };
  } else {
    let type = 'addr';
    if (isIndexed) {
      // For indexed, determine type based on address value or assume abs for expressions/labels
      if (baseOp.includes('+') || baseOp.includes('-')) {
        type = index === 'X' ? 'absx' : 'absy'; // Assume abs for expressions
      } else {
        const addrNum = parseNumber(baseOp);
        if (!isNaN(addrNum)) {
          if (addrNum < 256) {
            type = index === 'X' ? 'zpx' : 'zpy';
          } else {
            type = index === 'X' ? 'absx' : 'absy';
          }
        } else {
          // Label, assume abs
          type = index === 'X' ? 'absx' : 'absy';
        }
      }
    } else {
      if (baseOp.includes('+') || baseOp.includes('-')) {
        type = 'abs'; // Assume abs for expressions
      } else {
        const num = parseNumber(baseOp);
        if (!isNaN(num) && num < 256) {
          type = 'zp';
        } else {
          type = 'abs';
        }
      }
    }
    if (baseOp.includes('+') || baseOp.includes('-')) {
      return { type, value: baseOp };
    }
    const num = parseNumber(baseOp);
    return isNaN(num) ? { type, value: baseOp } : { type, value: num };
  }
}

/**
 * Evaluate a simple expression with + and - operators (left-to-right, no precedence).
 * Supports numbers (hex 0x, bin 0b, dec), labels, and + - operators.
 */
function evaluateExpression(expr, labels) {
  expr = expr.trim();
  if (!expr.includes('+') && !expr.includes('-')) {
    // No operators, just resolve as normal
    const num = parseNumber(expr);
    return isNaN(num) ? resolveValue(expr, labels) : num;
  }

  // Tokenize: split on + and - but keep the operators
  const tokens = expr.split(/(\+|-)/).map(t => t.trim()).filter(t => t.length > 0);
  if (tokens.length < 3 || tokens.length % 2 === 0) {
    throw new Error(`Invalid expression: ${expr}`);
  }

  let result = 0;
  let op = '+'; // Start with + for first operand

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '+' || token === '-') {
      op = token;
    } else {
      // Operand: number or label
      let val;
      const num = parseNumber(token);
      val = isNaN(num) ? resolveValue(token, labels) : num;

      if (op === '+') {
        result += val;
      } else if (op === '-') {
        result -= val;
      }
    }
  }
  return result;
}

/**
 * Resolve a value (number, label, or expression) using the labels map.
 */
function resolveValue(val, labels) {
  if (typeof val === 'number') {
    return val;
  } else if (typeof val === 'string') {
    if (val.includes('+') || val.includes('-')) {
      return evaluateExpression(val, labels);
    } else {
      if (labels.has(val)) {
        return labels.get(val);
      } else {
        const num = parseNumber(val);
        if (isNaN(num)) {
          throw new Error(`Undefined label: ${val}`);
        }
        return num;
      }
    }
  } else {
    throw new Error(`Invalid value type: ${typeof val}`);
  }
}

/**
 * Sanitize assembly source code by stripping invalid characters and enforcing length limits.
 * @param {string} source - Raw assembly source code
 * @returns {string} Sanitized source code
 * @throws {Error} If source is invalid or too long
 */
function sanitizeAssemblySource(source) {
  if (!source || typeof source !== 'string') {
    throw new Error('Assembly source must be a non-empty string');
  }

  const MAX_SOURCE_LENGTH = 10000; // 10KB limit

  if (source.length > MAX_SOURCE_LENGTH) {
    throw new Error(`Assembly source too large. Maximum size is ${MAX_SOURCE_LENGTH} characters`);
  }

  // Strip invalid characters - allow only valid assembly language characters
  // Allow: letters, numbers, whitespace, $, #, :, ;, (, ), ,, -, +, =, /, ., ', ", @
  // Remove: control characters, non-printable, potentially dangerous chars
  const sanitized = source.replace(/[^\w\s$#();,.:\-+=/@'"\\]/g, '');

  return sanitized;
}

/**
 * Assemble assembly source code into machine code bytes.
 * Supports indexed addressing ($1234,X; $12,Y) and simple expressions (#$10+5; loop+2).
 * @param {string} source - Assembly source code
 * @param {object} options - Options object
 * @param {number} options.origin - Default program origin (default: 0x0600)
 * @returns {Uint8Array} Assembled bytes
 */
export function assemble(source, options = {}) {
  const origin = options.origin || 0x0600;
  const labels = new Map();

  // Sanitize the input source
  source = sanitizeAssemblySource(source);

  // First pass: collect labels and calculate sizes
  let currentPC = origin;
  const lines = source.split('\n');
  for (const line of lines) {
    const cleanLine = stripComment(line);
    if (!cleanLine.trim()) continue;
    let label = null;
    let rest = cleanLine;
    if (cleanLine.includes(':')) {
      const idx = cleanLine.indexOf(':');
      label = cleanLine.slice(0, idx).trim();
      rest = cleanLine.slice(idx + 1).trim();
    }
    // Support simple assignments like: name = expression
    const assignMatch = rest.match(/^([A-Za-z_][\w]*)\s*=\s*(.+)$/);
    if (assignMatch) {
      const name = assignMatch[1];
      const expr = assignMatch[2];
      // Evaluate using labels known so far (allows forward references only after defined)
      const val = evaluateExpression(expr, labels);
      labels.set(name, val);
      continue;
    }
    if (!rest) {
      if (label) labels.set(label, currentPC);
      continue;
    }
    if (rest.startsWith('.')) {
      const parts = rest.split(/\s+/);
      const dir = parts[0].slice(1);
      if (dir === 'org') {
        const addr = parseNumber(parts[1]);
        currentPC = addr;
      } else if (dir === 'byte' || dir === 'db') {
        const values = parts.slice(1).join(' ').split(',').map(v => v.trim());
        currentPC += values.length;
      } else {
        throw new Error(`Unknown directive: .${dir}`);
      }
    } else {
      const trimmedRest = rest.trim();
      if (!trimmedRest) continue;
      const parts = trimmedRest.split(/\s+/);
      const mnemonic = parts[0].toUpperCase();
      const operand = parts.slice(1).join(' ');
      const op = parseOperand(operand);
      if (!opcodeTable[mnemonic]) {
        throw new Error(`Unknown mnemonic: ${mnemonic}`);
      }
      const modes = opcodeTable[mnemonic];
      let size = 1;
      if (op === null) {
        if (!modes.imp) {
          throw new Error(`${mnemonic} requires operand`);
        }
      } else if (op.type === 'imm') {
        if (!modes['#']) {
          throw new Error(`${mnemonic} does not support immediate`);
        }
        size = 2;
      } else {
        const isBranch = ['BEQ', 'BNE', 'BCS'].includes(mnemonic);
        if (isBranch) {
          size = 2;
        } else {
          // Determine size based on addressing mode
          if (op.type === 'zp' || op.type === 'zpx' || op.type === 'zpy') {
            size = 2;
          } else if (op.type === 'abs' || op.type === 'absx' || op.type === 'absy') {
            size = 3;
          } else {
            throw new Error(`Unsupported operand type: ${op.type}`);
          }
        }
      }
      if (label) labels.set(label, currentPC);
      currentPC += size;
    }
  }

  // Second pass: generate bytes
  const bytes = [];
  currentPC = origin;
  for (const line of lines) {
    const cleanLine = stripComment(line);
    if (!cleanLine.trim()) continue;
    let rest = cleanLine;
    if (cleanLine.includes(':')) {
      const idx = cleanLine.indexOf(':');
      rest = cleanLine.slice(idx + 1).trim();
    }
  // Skip assignment lines like: name = expr
  const assignMatch2 = rest.match(/^([A-Za-z_][\w]*)\s*=\s*(.+)$/);
  if (assignMatch2) continue;
    if (!rest) continue;
    if (rest.startsWith('.')) {
      const parts = rest.split(/\s+/);
      const dir = parts[0].slice(1);
      if (dir === 'org') {
        const addr = parseNumber(parts[1]);
        currentPC = addr;
      } else if (dir === 'byte' || dir === 'db') {
        const values = parts.slice(1).join(' ').split(',').map(v => v.trim());
        for (const v of values) {
          const val = resolveValue(v, labels);
          const num = typeof val === 'string' ? parseNumber(val) : val;
          if (num < 0 || num > 255) {
            throw new Error(`Byte value out of range: ${num}`);
          }
          bytes.push(num);
          currentPC++;
        }
      }
    } else {
      const trimmedRest = rest.trim();
      if (!trimmedRest) continue;
      const parts = trimmedRest.split(/\s+/);
      const mnemonic = parts[0].toUpperCase();
      const operand = parts.slice(1).join(' ');
      const op = parseOperand(operand);
      const modes = opcodeTable[mnemonic];
      let opcode;
      let operandBytes = [];
      if (op === null) {
        opcode = modes.imp;
      } else if (op.type === 'imm') {
        opcode = modes['#'];
        const val = resolveValue(op.value, labels);
        const num = typeof val === 'string' ? parseNumber(val) : val;
        if (num < 0 || num > 255) {
          throw new Error(`Immediate value out of range: ${num}`);
        }
        operandBytes = [num];
      } else {
        const val = resolveValue(op.value, labels);
        const num = typeof val === 'string' ? parseNumber(val) : val;
        const isBranch = ['BEQ', 'BNE', 'BCS'].includes(mnemonic);
        if (isBranch) {
          opcode = modes.rel;
          const offset = num - currentPC - 2;
          if (offset < -128 || offset > 127) {
            throw new Error(`Branch offset out of range: ${offset}`);
          }
          operandBytes = [offset & 0xFF];
        } else {
          // Handle indexed and regular addressing
          if (op.type === 'zp' || op.type === 'zpx' || op.type === 'zpy') {
            if (!modes[op.type]) {
              throw new Error(`${mnemonic} does not support ${op.type} addressing`);
            }
            opcode = modes[op.type];
            operandBytes = [num & 0xFF];
          } else if (op.type === 'abs' || op.type === 'absx' || op.type === 'absy') {
            if (!modes[op.type]) {
              throw new Error(`${mnemonic} does not support ${op.type} addressing`);
            }
            opcode = modes[op.type];
            operandBytes = [num & 0xFF, num >> 8];
          } else {
            throw new Error(`Unsupported operand type: ${op.type}`);
          }
        }
      }
      bytes.push(opcode, ...operandBytes);
      currentPC += 1 + operandBytes.length;
    }
  }
  return new Uint8Array(bytes);
}

/**
 * Assemble to ArrayBuffer (convenience wrapper).
 * @param {string} source - Assembly source code
 * @param {object} options - Options object
 * @returns {ArrayBuffer} Assembled bytes as ArrayBuffer
 */
export function assembleToArrayBuffer(source, options) {
  return assemble(source, options).buffer;
}

// TODO: Support for indirect addressing modes ((ind),X ; (ind),Y ; (zp,X) ; (zp),Y)
// TODO: Support for more expression operators and precedence (e.g., *, /, parentheses)
// TODO: Macros and include directives
// TODO: Source maps for debugging

// Optional self-test (run with VS8_ASM_SELFTEST=1 in Node.js)
if (typeof process !== 'undefined' && process.env.VS8_ASM_SELFTEST) {
  const testSource = `
.org 0x0600
LDA #10
STA 0x00
HLT
  `;
  try {
    const bytes = assemble(testSource);
    const expected = [0xA9, 10, 0x85, 0x00, 0x3A];
    if (bytes.length === expected.length && expected.every((b, i) => b === bytes[i])) {
      console.log('Assembler self-test passed');
    } else {
      console.log('Assembler self-test failed:', Array.from(bytes), 'expected:', expected);
    }
  } catch (e) {
    console.error('Assembler self-test error:', e.message);
  }
}
