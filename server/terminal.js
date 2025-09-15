// Simple server-side terminal helper
// Exposes write(value) to append bytes and read() to return accumulated text

const buffer = [];

function write(value) {
  const v = typeof value === 'number' ? value & 0xFF : String(value).charCodeAt(0) & 0xFF;
  try { if (typeof console !== 'undefined' && console.log) console.log(`[server/terminal] write byte=0x${v.toString(16).padStart(2,'0')}`); } catch(e) {}
  buffer.push(v);
  try { if (typeof globalThis !== 'undefined') globalThis.__SERVER_TERMINAL_BUFFER = buffer; } catch(e) {}
}

function readAll() {
  // Return and clear buffer as string
  const bytes = buffer.splice(0, buffer.length);
  return String.fromCharCode.apply(null, bytes);
}

function peekBytes() {
  return buffer.slice();
}

export { write, readAll, peekBytes };
module.exports = { write, readAll, peekBytes };
