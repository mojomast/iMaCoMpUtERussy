import { assemble } from './js/assembler.js';
import fs from 'fs';

// Read the fibonacci.asm file
const asmContent = fs.readFileSync('./samples/fibonacci.asm', 'utf8');
console.log('ASM Content:');
console.log(asmContent);
console.log('\n=== Assembling ===');

try {
    const result = assemble(asmContent);
    console.log('Assembly result:', result);
    
    if (result && result.bytes) {
        console.log('Bytes:', Array.from(result.bytes));
        console.log('Origin:', result.origin);
        console.log('Length:', result.bytes.length);
    } else {
        console.log('No bytes produced');
    }
} catch (error) {
    console.error('Assembly error:', error);
    console.error('Stack:', error.stack);
}
