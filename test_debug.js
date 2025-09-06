/* global console */
/* eslint-env node */
import { iMaCoMpUtERussyCPU } from './js/cpu.js';

const cpu = new iMaCoMpUtERussyCPU();

// Test basic flag operations
console.log('Initial P register:', cpu.P.toString(2).padStart(8, '0'));

cpu.setFlag('C', true);
console.log('After setFlag C=true:', cpu.P.toString(2).padStart(8, '0'));
console.log('getFlag C:', cpu.getFlag('C'));

cpu.setFlag('Z', true);
console.log('After setFlag Z=true:', cpu.P.toString(2).padStart(8, '0'));
console.log('getFlag Z:', cpu.getFlag('Z'));

cpu.setFlag('C', false);
console.log('After setFlag C=false:', cpu.P.toString(2).padStart(8, '0'));
console.log('getFlag C:', cpu.getFlag('C'));

// Test ADC
cpu.reset();
cpu.A = 0xFF;
cpu.setFlag('C', false);

const result = cpu.A + 0x01 + (cpu.getFlag('C') ? 1 : 0);
console.log('ADC calculation: 0xFF + 0x01 + carry(0) =', result);
cpu.setFlag('C', result > 0xFF);
cpu.A = result & 0xFF;
cpu.updateZN(cpu.A);

console.log('After ADC: A=', cpu.A.toString(16), 'C=', cpu.getFlag('C'), 'Z=', cpu.getFlag('Z'));

// Test stack
cpu.reset();
cpu.A = 0x42;
cpu.push(cpu.A);
console.log('After push, SP=', cpu.SP.toString(16));
const popped = cpu.pop();
console.log('After pop, SP=', cpu.SP.toString(16), 'popped=', popped.toString(16));
