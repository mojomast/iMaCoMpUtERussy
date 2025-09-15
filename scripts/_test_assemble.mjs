import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const p = path.join(__dirname, '..', 'samples', 'hello-world.asm');
const src = fs.readFileSync(p, 'utf8');
console.log('Loaded source length:', src.length);
try {
  const { assemble } = await import('../js/assembler.js');
  const bytes = assemble(src, { origin: 0x0600 });
  console.log('Assembled bytes length:', bytes?.length);
  console.log('First 64 bytes:', Array.from(bytes).slice(0,64));
} catch (e) {
  console.error('Assembly error:', e && e.stack ? e.stack : e);
  process.exit(2);
}
