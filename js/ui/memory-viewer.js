/**
 * Memory Viewer UI for VideoStorage-8 Emulator
 * Hex + ASCII renderer for memory slices
 */

// Add WebSocket listener for memory state changes
if (window.mcpWebSocket) {
  window.mcpWebSocket.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'memory.saveState' || data.type === 'memory.loadState') {
        console.log(`📱 Memory viewer: Refreshing for state change - ${data.type}`);
        if (window.refreshMemoryDisplay) {
          window.refreshMemoryDisplay();
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  });
  
  console.log('Memory viewer integrated with MCP WebSocket for state change notifications');
}

// Global variables for refresh function
let currentMemory, currentStartAddr, currentLength, currentContainer;

/**
 * Render memory slice as hex + ASCII table
  * @param {iMaCoMpUtERussyMemory|Uint8Array} memory - Memory instance (supports readByte or direct access)
 * @param {number} startAddr - Starting address (default: 0x0200 video buffer)
 * @param {number} length - Number of bytes to display (default: 0x200)
 * @param {HTMLElement} containerElement - Container element for rendering
 */
export function renderMemorySlice(memory, startAddr = 0x0200, length = 0x200, containerElement) {
    if (!containerElement) {
        console.warn('Container element not provided for memory viewer');
        return;
    }

    // Store for refresh function
    currentMemory = memory;
    currentStartAddr = startAddr;
    currentLength = length;
    currentContainer = containerElement;

    const bytesPerRow = 16;
    const rows = Math.ceil(length / bytesPerRow);

    let html = '<pre>';

    for (let row = 0; row < rows; row++) {
        const rowStart = startAddr + (row * bytesPerRow);
        const rowEnd = Math.min(rowStart + bytesPerRow, startAddr + length);

        // Address
        html += rowStart.toString(16).padStart(4, '0') + ': ';

        // Hex bytes
        for (let i = rowStart; i < rowEnd; i++) {
            let byte;
            if (memory.readByte) {
                byte = memory.readByte(i);
            } else {
                byte = memory[i];
            }
            const isChanged = window.lastMemoryState && window.lastMemoryState[i] !== byte;
            const highlightClass = isChanged ? ' changed-byte' : '';
            html += `<span class="byte${highlightClass}">${byte.toString(16).padStart(2, '0')}</span> `;
        }

        // Padding for incomplete rows
        for (let i = rowEnd; i < rowStart + bytesPerRow; i++) {
            html += '   ';
        }

        // ASCII representation
        html += ' |';
        for (let i = rowStart; i < rowEnd; i++) {
            let byte;
            if (memory.readByte) {
                byte = memory.readByte(i);
            } else {
                byte = memory[i];
            }
            const isChanged = window.lastMemoryState && window.lastMemoryState[i] !== byte;
            const highlightClass = isChanged ? ' changed-byte' : '';
            const char = (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
            html += `<span class="char${highlightClass}">${char}</span>`;
        }

        html += '|\n';
    }

    html += '</pre>';

    // Add AI/MCP activity log section
    let logSection = containerElement.querySelector('#ai-mcp-log');
    if (!logSection) {
      logSection = document.createElement('div');
      logSection.id = 'ai-mcp-log';
      logSection.className = 'ai-mcp-log-panel';
      logSection.innerHTML = '<h4>AI/MCP Activity Log</h4><div id="activity-log" style="height: 200px; overflow-y: auto; background: #000; color: #0f0; padding: 10px; font-family: monospace; font-size: 12px; border: 1px solid #0f0;"></div>';
      logSection.style.cssText = 'margin-top: 20px; padding: 10px; border: 1px solid #00ff00; background: rgba(0,0,0,0.8);';
      containerElement.appendChild(logSection);
    }

    // Sync with MCP log display if available
    const activityLog = logSection.querySelector('#activity-log');
    const mcpDisplay = document.getElementById('mcp-display');
    if (mcpDisplay && !window.memoryLogSynced) {
      // Mirror MCP logs to memory viewer
      const observer = new MutationObserver(() => {
        activityLog.innerHTML = mcpDisplay.innerHTML;
        activityLog.scrollTop = activityLog.scrollHeight;
      });
      observer.observe(mcpDisplay, { childList: true, subtree: true });
      window.memoryLogSynced = true;
      console.log('Synced MCP logs to memory viewer panel');
    }

    // Store current memory state for change detection
    window.lastMemoryState = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      window.lastMemoryState[i] = memory.readByte ? memory.readByte(startAddr + i) : memory[startAddr + i];
    }

    // Assembly action logging and highlighting
    const assemblyStart = 0x0600; // Typical program origin
    const assemblyEnd = 0x0800;   // Typical program end
    const assemblyChanges = [];
    
    // Detect assembly-related changes (program region writes)
    if (startAddr <= assemblyEnd && startAddr + length >= assemblyStart) {
      const assemblyRangeStart = Math.max(startAddr, assemblyStart);
      const assemblyRangeEnd = Math.min(startAddr + length, assemblyEnd);
      
      for (let i = assemblyRangeStart; i < assemblyRangeEnd; i++) {
        const addrIndex = i - startAddr;
        const currentByte = memory.readByte ? memory.readByte(i) : memory[i];
        const previousByte = window.lastMemoryState[addrIndex];
        
        if (previousByte !== undefined && currentByte !== previousByte) {
          // Check if this looks like program code (non-zero, structured bytes)
          if (currentByte !== 0 && currentByte !== 0xFF) {
            assemblyChanges.push({
              address: i,
              oldValue: previousByte,
              newValue: currentByte,
              isAssembly: true
            });
          }
        }
      }
    }

    // Log assembly changes to MCP if available
    if (assemblyChanges.length > 0 && window.logToMCP) {
      const recentAssemblyAction = assemblyChanges.length;
      window.logToMCP('info', `Assembly Memory Update: ${recentAssemblyAction} bytes changed in program region 0x0600-0x0800`, {
        changes: assemblyChanges,
        region: 'program',
        timestamp: new Date().toISOString()
      });
      
      // Broadcast assembly memory event
      if (window.mcpWebSocket && window.mcpWebSocket.readyState === WebSocket.OPEN) {
        window.mcpWebSocket.send(JSON.stringify({
          type: 'memory.assemblyUpdate',
          data: {
            addressRange: { start: assemblyStart, end: assemblyEnd },
            changes: assemblyChanges.length,
            bytes: assemblyChanges.map(c => ({ addr: c.address, value: c.newValue }))
          },
          timestamp: new Date().toISOString()
        }));
      }
    }

    // Enhanced rendering with assembly highlighting
    let enhancedHtml = html;
    
    // Highlight assembly changes in the hex display
    if (assemblyChanges.length > 0) {
      // Re-render the HTML with special highlighting for assembly changes
      enhancedHtml = this.renderWithAssemblyHighlighting(memory, startAddr, length, assemblyChanges);
    }

    containerElement.innerHTML = enhancedHtml + logSection.outerHTML;
}

/**
 * Refresh the current memory view
 */
export function refresh() {
    if (currentMemory && currentContainer) {
        renderMemorySlice(currentMemory, currentStartAddr, currentLength, currentContainer);
    } else {
        console.warn('No current memory view to refresh');
    }
}

/**
 * Alias for refresh function (for compatibility)
 */
export const refreshMemoryDisplay = refresh;

/**
 * Initialize memory viewer UI
 * @param {string} rootElementId - ID of root element for memory viewer UI
 */
export function initializeMemoryViewer(rootElementId) {
    const rootElement = document.getElementById(rootElementId);
    if (!rootElement) {
        console.warn(`Memory viewer root element '${rootElementId}' not found`);
        return;
    }

    // Import the CPU and memory from debugger module if available
    import('./debugger.js').then(debuggerModule => {
        if (debuggerModule.memory) {
            const memoryDisplay = document.getElementById('memory-display') || rootElement.querySelector('#memory-display');
            if (memoryDisplay) {
                // Start at 0x0200 (video buffer) and show more useful memory regions
                // Show video buffer + user RAM (0x0200-0x0800 = 1536 bytes)
                renderMemorySlice(debuggerModule.memory, 0x0200, 0x600, memoryDisplay);
            }
        }
    }).catch(err => {
        console.warn('Could not import debugger module for memory viewer:', err);
    });

    // Add CSS for highlighting changed bytes (retro theme compatible)
    if (!document.getElementById('memory-highlight-css')) {
      const style = document.createElement('style');
      style.id = 'memory-highlight-css';
      style.textContent = `
        .changed-byte, .char.changed-byte {
          background-color: rgba(255, 0, 0, 0.3) !important;
          border: 1px solid #ff0000 !important;
          animation: pulse 1s ease-in-out;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .ai-mcp-log-panel {
          font-family: 'Courier New', monospace;
          border: 2px solid #00ff00;
        }
        #activity-log .mcp-log-entry {
          margin-bottom: 5px;
          padding: 2px;
          border-left: 3px solid #00ff00;
        }
        #activity-log .mcp-info { color: #00ff00; }
        #activity-log .mcp-error { color: #ff0000; }
      `;
      document.head.appendChild(style);
      console.log('Added memory highlighting CSS for retro theme');
    }

    // Make the container resizable via layout manager if available
    if (window.layoutManager) {
      window.layoutManager.makePanelResizable(containerElement.parentElement);
      console.log('Memory viewer panel made resizable');
    }
}

/**
 * Refresh memory display with current memory state
 * Called by debugger when memory changes
 */
export function refreshMemoryDisplay() {
    // Import the CPU and memory from debugger module
    import('./debugger.js').then(debuggerModule => {
        if (debuggerModule.memory) {
            const memoryDisplay = document.getElementById('memory-display');
            if (memoryDisplay) {
                // Start at 0x0200 (video buffer) and show useful memory regions
                renderMemorySlice(debuggerModule.memory, 0x0200, 0x600, memoryDisplay);
            }
        }
    }).catch(err => {
        console.warn('Could not refresh memory display:', err);
    });
}

/**
 * Render memory slice with assembly action highlighting
 */
function renderWithAssemblyHighlighting(memory, startAddr, length, assemblyChanges) {
    const bytesPerRow = 16;
    const rows = Math.ceil(length / bytesPerRow);
    
    let html = '<pre>';
    
    // Create a Set of assembly change addresses for quick lookup
    const assemblyChangeSet = new Set(assemblyChanges.map(change => change.address));
    
    for (let row = 0; row < rows; row++) {
        const rowStart = startAddr + (row * bytesPerRow);
        const rowEnd = Math.min(rowStart + bytesPerRow, startAddr + length);
        
        // Address
        html += rowStart.toString(16).padStart(4, '0') + ': ';
        
        // Hex bytes with assembly highlighting
        for (let i = rowStart; i < rowEnd; i++) {
            let byte;
            if (memory.readByte) {
                byte = memory.readByte(i);
            } else {
                byte = memory[i];
            }
            
            let highlightClass = '';
            const isChanged = window.lastMemoryState && window.lastMemoryState[i - startAddr] !== byte;
            const isAssemblyChange = assemblyChangeSet.has(i);
            
            if (isAssemblyChange) {
                highlightClass = ' assembly-change';
            } else if (isChanged) {
                highlightClass = ' changed-byte';
            }
            
            html += `<span class="byte${highlightClass}">${byte.toString(16).padStart(2, '0')}</span> `;
        }
        
        // Padding for incomplete rows
        for (let i = rowEnd; i < rowStart + bytesPerRow; i++) {
            html += '   ';
        }
        
        // ASCII representation with highlighting
        html += ' |';
        for (let i = rowStart; i < rowEnd; i++) {
            let byte;
            if (memory.readByte) {
                byte = memory.readByte(i);
            } else {
                byte = memory[i];
            }
            
            let highlightClass = '';
            const isAssemblyChange = assemblyChangeSet.has(i);
            
            if (isAssemblyChange) {
                highlightClass = ' assembly-change';
            }
            
            const char = (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
            html += `<span class="char${highlightClass}">${char}</span>`;
        }
        
        html += '|\n';
    }
    
    html += '</pre>';
    
    return html;
}

/**
 * Enhanced refresh function with assembly logging
 */
export function refreshMemoryDisplayWithLogging() {
    // Import debugger to get memory instance
    import('./debugger.js').then(debuggerModule => {
        if (debuggerModule.memory) {
            const memoryDisplay = document.getElementById('memory-display');
            if (memoryDisplay) {
                // Show program region (0x0600-0x0800) plus some context
                const programStart = 0x0600 - 0x0100; // Show 256 bytes before program
                const programLength = 0x0200 + 0x0100; // 512 bytes of program + context
                renderMemorySlice(debuggerModule.memory, programStart, programLength, memoryDisplay);
                
                // Log assembly region status
                const programBytes = [];
                for (let i = 0x0600; i < 0x0800; i++) {
                    programBytes.push(debuggerModule.memory.readByte(i));
                }
                
                const nonZeroBytes = programBytes.filter(b => b !== 0).length;
                const assemblyDensity = (nonZeroBytes / programBytes.length * 100).toFixed(1);
                
                if (window.logToMCP) {
                    window.logToMCP('info', `Memory Viewer: Program region 0x0600-0x0800 status`, {
                        nonZeroBytes,
                        totalBytes: programBytes.length,
                        assemblyDensity: `${assemblyDensity}%`,
                        firstNonZero: programBytes.findIndex(b => b !== 0) + 0x0600
                    });
                }
            }
        }
    }).catch(err => {
        console.warn('Could not refresh memory display:', err);
    });
}

/**
 * TODO: Implement full memory viewer features:
 * - Scrollable view with navigation controls
 * - Address input for jumping to specific locations
 * - Memory editing capability
 * - Enhanced highlighting for different memory regions (stack, video, program)
 * - Search functionality for bytes/patterns
 * - Different view modes (binary, decimal, octal)
 * - Memory region labels and annotations
 * - Export/import memory dumps
 * - Assembly disassembly view integration
 * - Real-time MCP event visualization
 */
