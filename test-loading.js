import { assemble } from './js/assembler.js';
import { VideoStorage8Memory } from './js/memory.js';

// Test the assembly loading process
const testCode = `
.org $0600
LDA #$00
STA $00
LDA #$01  
STA $01
LDA $01
ADC $00
STA $02
LDA $01
ADC $02
STA $03
HLT
`;

console.log('Testing assembly loading...');
console.log('Test code:', testCode);

try {
    const assembled = assemble(testCode);
    console.log('Assembled bytes:', assembled);
    console.log('Length:', assembled.length);
    console.log('Bytes array:', Array.from(assembled));
    
    // Test parsing .org directive
    const orgMatch = testCode.match(/\.org\s+(\$[0-9a-fA-F]+|0x[0-9a-fA-F]+|\d+)/);
    if (orgMatch) {
        let origin;
        const str = orgMatch[1];
        if (str.startsWith('$')) {
            origin = parseInt(str.slice(1), 16);
        } else if (str.startsWith('0x') || str.startsWith('0X')) {
            origin = parseInt(str, 16);
        } else {
            origin = parseInt(str, 10);
        }
        console.log('Origin address:', '0x' + origin.toString(16));
        
        // Test loading into memory
        const memory = new VideoStorage8Memory();
        memory.loadProgram(origin, assembled);
        
        console.log('Memory at origin:');
        for (let i = 0; i < assembled.length; i++) {
            console.log(`$${(origin + i).toString(16).toUpperCase()}: $${memory.readByte(origin + i).toString(16).toUpperCase()}`);
        }
    } else {
        console.log('No .org directive found');
    }
    
} catch (error) {
    console.error('Assembly error:', error);
}
