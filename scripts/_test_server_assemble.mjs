import fs from 'fs';
import path from 'path';
const { sanitizeProgramSource } = await import('../lib/validators.js');
const { assemble } = await import('../js/assembler.js');

const p = path.join(new URL(import.meta.url).pathname.replace(/^\//, '').replace(/%3A/, ':'), '..', 'samples', 'hello-world.asm');
// Better: build path using fileURLToPath
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const samplePath = path.join(__dirname, '..', 'samples', 'hello-world.asm');

const src = fs.readFileSync(samplePath, 'utf8');
console.log('raw length:', src.length);
const sanitized = sanitizeProgramSource(src);
console.log('sanitized length:', sanitized.length);
try {
  const bytes = assemble(sanitized, { origin: 0x0600 });
  console.log('assembled bytes length:', bytes?.length);
} catch (e) {
  console.error('assembly error:', e && e.stack ? e.stack : e);
}
