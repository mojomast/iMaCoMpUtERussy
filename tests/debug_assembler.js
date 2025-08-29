import { assemble } from '../js/assembler.js';

const source = `
.org 0x0600
loop: LDA #0
JMP loop+2
HLT
`;
const bytes = assemble(source);
console.log(Array.from(bytes));
