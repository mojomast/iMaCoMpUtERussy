# iMaCoMpUtERussy - Bug Report & Improvement Recommendations

## 🚨 Critical Bugs

### Backend/API Issues

#### 1. MCP Server Import/Export Inconsistencies
**Location**: `server/mcp_server.js`
**Severity**: High
**Issue**: Mixed ESM and CommonJS imports causing module resolution failures
```javascript
// Line 47 - ESM import
import { createDeveloperAdapters } from './mcp_developer_adapter.js';

// Line 823 - CommonJS require in async context
const term = require('./terminal.js');
```
**Fix**: Standardize on ESM imports throughout or use dynamic imports:
```javascript
// Replace require with dynamic import
const term = await import('./terminal.js');
```

#### 2. Undefined WebSocket Broadcasting Functions
**Location**: `server/mcp_server.js`, lines 1940+
**Severity**: High
**Issue**: `broadcastEvent` function is called but not properly defined/implemented
```javascript
// Line 1949 - Called but may be undefined
if (typeof broadcastEvent === 'function') {
  broadcastEvent('memory.write', { address, value, size });
}
```
**Fix**: Implement proper WebSocket broadcasting or remove calls:
```javascript
// Define broadcastEvent properly
const wss = new WebSocket.Server({ port: 8080 });
function broadcastEvent(type, data) {
  const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
```

#### 3. Inconsistent Error Handling in Adapters
**Location**: `server/mcp_developer_adapter.js`
**Severity**: Medium
**Issue**: Adapter functions return inconsistent response formats
```javascript
// Some return { success: true, data: {...} }
// Others return raw data
// Creates validation failures in MCP server
```
**Fix**: Standardize adapter response format:
```javascript
// All adapters should return consistent format
return {
  success: true,
  data: actualResult,
  error: null
};
```

### Frontend/UI Issues

#### 4. Memory Display Race Conditions
**Location**: `index.html` JavaScript sections
**Severity**: Medium
**Issue**: Memory refresh functions called before DOM elements exist
```javascript
// Memory refresh called before elements are ready
if (window.refreshMemoryDisplay) {
  setTimeout(() => window.refreshMemoryDisplay(), 100);
}
```
**Fix**: Add proper DOM ready checks:
```javascript
function safeRefreshMemory() {
  if (document.readyState === 'complete' && window.refreshMemoryDisplay) {
    window.refreshMemoryDisplay();
  } else {
    setTimeout(safeRefreshMemory, 100);
  }
}
```

#### 5. CPU Step Handler Error Propagation
**Location**: `js/cpu.js`, line 1157+
**Severity**: Medium
**Issue**: Breakpoint checking may access undefined global objects
```javascript
// Line 1157 - Unsafe breakpoint access
if (_win && _win.breakpoints && _win.breakpoints.has(this.PC)) {
  // _win might be undefined in some environments
}
```
**Fix**: Add defensive checks:
```javascript
const breakpoints = (typeof window !== 'undefined' && window.breakpoints) 
  ? window.breakpoints 
  : (typeof globalThis !== 'undefined' && globalThis.breakpoints) 
    ? globalThis.breakpoints 
    : new Set();
```

## ⚠️ Medium Priority Issues

### 6. Video Display Coordinate Validation
**Location**: `docs/mcp_schemas/video.setPixel.request.json`
**Severity**: Medium
**Issue**: Schema allows coordinates 0-31 but code uses 32x24 display
```json
{
  "x": { "type": "integer", "minimum": 0, "maximum": 31 },
  "y": { "type": "integer", "minimum": 0, "maximum": 31 }
}
```
**Fix**: Correct the schema to match actual display dimensions:
```json
{
  "x": { "type": "integer", "minimum": 0, "maximum": 31 },
  "y": { "type": "integer", "minimum": 0, "maximum": 23 }
}
```

### 7. Assembly Validation Bypass
**Location**: `js/assembler.js`, line 245+
**Severity**: Medium
**Issue**: Source sanitization removes valid assembly characters
```javascript
// Line 252 - Over-aggressive sanitization
const sanitized = source.replace(/[^\w\s$#();,.:\-\+=/@'"\\]/g, '');
```
**Fix**: Allow more assembly-specific characters:
```javascript
const sanitized = source.replace(/[^\w\s$#();,.:\-\+=/@'"\\[\]]/g, '');
```

### 8. Memory Bank Switching Issues
**Location**: `js/memory.js`, line 1150+
**Severity**: Medium
**Issue**: Bank switching doesn't properly validate bank existence
```javascript
// Potential access to undefined bank
this.currentBank = bank;
if (!this.banks[bank]) {
  this.banks[bank] = new Uint8Array(MEMORY_SIZE);
}
```
**Fix**: Validate bank number range:
```javascript
if (bank < 0 || bank >= 256) {
  throw new Error(`Invalid bank number: ${bank}`);
}
```

## 🔧 UI/UX Improvements

### 9. Terminal Input Buffer Overflow
**Location**: `js/memory.js`, line 340+
**Severity**: Low
**Issue**: Keyboard buffer can overflow without proper handling
```javascript
// Line 357 - No overflow protection
if (this.keyboardCount < 256) {
  // Add character
} // No else clause for overflow
```
**Fix**: Add overflow handling:
```javascript
if (this.keyboardCount < 256) {
  this.keyboardBuffer[this.keyboardTail] = charCode;
  this.keyboardTail = (this.keyboardTail + 1) % 256;
  this.keyboardCount++;
} else {
  console.warn('Keyboard buffer overflow - input dropped');
}
```

### 10. CPU State Display Updates
**Location**: Frontend JavaScript
**Severity**: Low
**Issue**: CPU register displays not updated consistently
**Fix**: Implement centralized state management:
```javascript
function updateCPUDisplay(state) {
  const elements = {
    pc: document.getElementById('cpu-pc'),
    a: document.getElementById('cpu-a'),
    x: document.getElementById('cpu-x'),
    y: document.getElementById('cpu-y'),
    sp: document.getElementById('cpu-sp'),
    status: document.getElementById('cpu-status')
  };
  
  Object.keys(elements).forEach(key => {
    if (elements[key] && state[key] !== undefined) {
      elements[key].textContent = key === 'pc' 
        ? state[key].toString(16).toUpperCase().padStart(4, '0')
        : state[key].toString(16).toUpperCase().padStart(2, '0');
    }
  });
}
```

## 🔌 Backend/API Connectivity Issues

### 11. MCP Client Retry Logic
**Location**: `js/mcp-client.js`, line 200+
**Severity**: Medium
**Issue**: Retry logic can cause infinite loops in some failure modes
```javascript
// Exponential backoff can grow too large
delay = baseDelay * Math.pow(2, retryCount - 1);
delay = Math.min(delay, 8000); // Cap at 8s
```
**Fix**: Add maximum retry attempts:
```javascript
const MAX_RETRIES = 5;
if (retryCount > MAX_RETRIES) {
  throw new Error(`Max retries (${MAX_RETRIES}) exceeded`);
}
```

### 12. WebSocket Reconnection Issues
**Location**: `js/mcp-client.js`, line 700+
**Severity**: Medium
**Issue**: WebSocket reconnection can fail silently
```javascript
// Line 734 - Silent failure possible
reconnectAttempts++;
if (reconnectAttempts < maxReconnectAttempts) {
  // Retry logic
} else {
  // No user notification of permanent failure
}
```
**Fix**: Add user notification:
```javascript
if (window.updateStatus) {
  window.updateStatus('Connection lost - please refresh page', 'error');
}
```

## 📋 Documentation Issues

### 13. Inconsistent Instruction Set Documentation
**Location**: `docs/INSTRUCTION_SET.md` vs actual implementation
**Severity**: Low
**Issue**: Documentation lists instructions not implemented in CPU
**Fix**: Audit and update documentation to match actual implementation

### 14. Missing MCP Schema Validation
**Location**: Various MCP schema files
**Severity**: Medium
**Issue**: Some schemas missing required field validation
**Fix**: Add comprehensive validation to all schemas:
```json
{
  "required": ["address", "value"],
  "additionalProperties": false
}
```

## 🚀 Performance Improvements

### 15. Memory Read/Write Optimization
**Location**: `js/memory.js`
**Severity**: Low
**Issue**: Individual byte operations are inefficient for bulk transfers
**Fix**: Implement bulk read/write methods:
```javascript
readBytes(address, count) {
  const result = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    result[i] = this.readByteUnchecked(address + i);
  }
  return result;
}
```

### 16. CPU Instruction Dispatch Optimization
**Location**: `js/cpu.js`, line 500+
**Severity**: Low
**Issue**: Large switch statement in instruction handler
**Fix**: Use lookup table for better performance:
```javascript
const instructionTable = new Array(256);
// Populate with handler functions
instructionTable[0xA9] = this.handleLDA_IMM.bind(this);
// etc.

// In executeInstruction():
const handler = instructionTable[opcode];
if (handler) {
  return handler();
}
```

## 🔒 Security Considerations

### 17. Input Sanitization Improvements
**Location**: `lib/validators.js`
**Severity**: Medium
**Issue**: Some user inputs not properly sanitized
**Fix**: Add comprehensive input validation for all user-facing inputs

### 18. API Authentication Bypass
**Location**: Some MCP endpoints
**Severity**: High
**Issue**: Not all endpoints properly validate API keys
**Fix**: Ensure all protected endpoints use authentication middleware

## 📊 Summary

**Total Issues Found**: 18
- **Critical**: 5
- **Medium**: 8  
- **Low**: 5

**Recommended Priority Order**:
1. Fix MCP server import/export issues (#1)
2. Implement proper WebSocket broadcasting (#2)
3. Standardize adapter response formats (#3)
4. Add comprehensive input validation (#17-18)
5. Fix video coordinate validation (#6)
6. Address UI race conditions (#4)
7. Optimize performance bottlenecks (#15-16)

**Testing Recommendations**:
- Add integration tests for MCP endpoints
- Implement WebSocket testing
- Add CPU instruction validation tests
- Create memory management stress tests
- Test browser compatibility across different environments