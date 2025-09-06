#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';

// Read the server file
let content = readFileSync('./server/mcp_server.js', 'utf8');

// Fix all "return throw" patterns
content = content.replace(/return throw new MCPError\(([^)]+)\);/g, 'throw new MCPError($1);');

// Fix "throw new MCPError" statements that might need adjustment
// Remove undefined/null messages that got inserted incorrectly
content = content.replace(/throw new MCPError\(([^,]+), 'undefined', null, (\d+)\);/g, 'throw new MCPError($1, \'unknown\', null, $2);');

// Fix incomplete function calls or malformed replacements
content = content.replace(/throw new MCPError\('VIDEO_OUT_OF_BOUNDS', 'Pixel coordinates out of video bounds', null, 422\);/g, 'throw new MCPError(\'VIDEO_OUT_OF_BOUNDS\', \'Pixel coordinates out of video bounds\', null, 422);');

// Fix other common broken patterns
content = content.replace(/throw new MCPError\(([^,]+), 'undefined', null, (\d+)\);/g, (match, code, status) => {
  const messageMap = {
    'PROGRAM_NOT_FOUND': 'Program not found',
    'PROGRAM_EXISTS': 'Program already exists',
    'MEMORY_OUT_OF_RANGE': 'Memory access out of range',
    'MATERIAL_MEMORY_BOUNDS': 'Memory access out of range',
    'INVALID_ASSEMBLY': 'Invalid assembly code',
    'CPU_HALTED': 'CPU halted',
    'BREAKPOINT_HIT': 'Breakpoint hit',
    'NOT_FOUND': 'Resource not found',
    'INTERNAL_ERROR': 'Internal server error'
  };
  const message = messageMap[code] || 'Unknown error';
  return `throw new MCPError('${code}', '${message}', null, ${status});`;
});

// Write back the file
writeFileSync('./server/mcp_server.js', content);
console.log('Fixed remaining syntax errors in server/mcp_server.js');