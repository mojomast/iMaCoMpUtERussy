import { assemble } from './js/assembler.js';

try {
  // Test indexed addressing
  const source1 = 'LDA $1234,X';
  const bytes1 = assemble(source1, { origin: 0x0600 });
  console.log('Indexed test:', Array.from(bytes1));

  // Test expression
  const source2 = 'LDA #$10+5';
  const bytes2 = assemble(source2, { origin: 0x0600 });
  console.log('Expression test:', Array.from(bytes2));

  // Test zero-page indexed
  const source3 = 'STA $12,Y';
  const bytes3 = assemble(source3, { origin: 0x0600 });
  console.log('ZP indexed test:', Array.from(bytes3));

  console.log('New features work!');
} catch (e) {
  console.error('Error:', e.message);
  console.error(e.stack);
}
