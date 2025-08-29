import { iMaCoMpUtERussyCPU } from './js/cpu.js';
import { iMaCoMpUtERussyMemory } from './js/memory.js';
import { assemble } from './js/assembler.js';

// Test simple program execution
const testCode = `
.org $0600
LDA #$42
STA $00
HLT
`;

console.log('Testing CPU execution...');

try {
    const memory = new iMaCoMpUtERussyMemory();
    const cpu = new iMaCoMpUtERussyCPU({ memory });
    
    console.log('Initial CPU state:', {
        PC: '0x' + cpu.PC.toString(16),
        A: '0x' + cpu.A.toString(16),
        running: cpu.running
    });
    
    const assembled = assemble(testCode);
    console.log('Assembled bytes:', Array.from(assembled));
    
    memory.loadProgram(0x0600, assembled);
    cpu.PC = 0x0600;
    
    console.log('After loading program:', {
        PC: '0x' + cpu.PC.toString(16),
        running: cpu.running
    });
    
    // Execute step by step
    let step = 0;
    while (cpu.running && step < 10) {
        step++;
        const instruction = memory.readByte(cpu.PC);
        console.log(`Step ${step}: PC=0x${cpu.PC.toString(16)}, Instruction=0x${instruction.toString(16)}`);
        
        cpu.step();
        
        console.log(`  After step: PC=0x${cpu.PC.toString(16)}, A=0x${cpu.A.toString(16)}, running=${cpu.running}`);
        
        if (!cpu.running) {
            console.log('CPU halted');
            break;
        }
    }
    
    // Check result
    const result = memory.readByte(0x00);
    console.log('Result at $00:', '0x' + result.toString(16));
    console.log('Expected: 0x42');
    console.log('Success:', result === 0x42);
    
} catch (error) {
    console.error('Test error:', error);
}
