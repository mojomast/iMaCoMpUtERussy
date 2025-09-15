/**
 * Memory Viewer UI for VideoStorage-8 Emulator
 * Hex + ASCII renderer for memory slices
 */

// Enhanced WebSocket integration for real-time memory viewer synchronization
if (window.mcpWebSocket) {
  const originalOnMessage = window.mcpWebSocket.onmessage;
  window.mcpWebSocket.onmessage = function(event) {
    try {
      const { type, data, timestamp } = JSON.parse(event.data);
      
      // Call original handler if it exists
      if (originalOnMessage && typeof originalOnMessage === 'function') {
        originalOnMessage.call(this, event);
      }
      
      // Enhanced memory viewer specific handling
      switch (type) {
        case 'memory.saveState':
        case 'memory.loadState':
        case 'memory.write':
        case 'programs.save':
        case 'programs.load':
          console.log(`📱 Memory viewer: Refreshing for memory event - ${type}`);
          if (window.refreshMemoryDisplay) {
            window.refreshMemoryDisplay();
          }
          break;
          
        case 'cpu.state':
        case 'cpu.step':
          console.log(`🖥️ Memory viewer: Updating for CPU event - ${type}`);
          if (window.refreshMemoryDisplay) {
            window.refreshMemoryDisplay();
          }
          if (window.updateCPUStateDisplay) {
            window.updateCPUStateDisplay(data);
          }
          break;
          
        case 'queue.status':
          console.log(`📋 Memory viewer: Queue update received - ${data.items?.length || 0} items`);
          if (window.updateQueueDisplay) {
            window.updateQueueDisplay(data);
          }
          // Optionally refresh memory if queue affects memory state
          if (data.nextProgram && window.refreshMemoryDisplay) {
            setTimeout(() => window.refreshMemoryDisplay(), 100);
          }
          break;
          
        case 'error':
          console.error(`❌ MCP Error in memory viewer: ${data.message || 'Unknown error'}`);
          if (window.logToMCP) {
            window.logToMCP('error', `MCP Error: ${data.message || 'Unknown error'}`, { type, data, timestamp });
          }
          if (window.feedbackSystem && window.feedbackSystem.showToast) {
            window.feedbackSystem.showToast(`MCP Error: ${data.message || 'Unknown error'}`, 'error');
          }
          break;
          
        case 'video.setPixel':
        case 'video.clear':
        case 'video.update':
           // Video events may affect video buffer memory (0x0200-0x05FF) - refresh all regions
           if (window.refreshMemoryDisplay) {
             window.refreshMemoryDisplay();
           }
           break;
          
        default:
          // Log unknown events for debugging
          if (data && window.logToMCP) {
            window.logToMCP('debug', `Memory viewer: Unhandled WebSocket event: ${type}`, { type, data });
          }
      }
      
    } catch (e) {
      console.warn('Memory viewer: Failed to parse WebSocket message:', e);
    }
  };
  
  console.log('✅ Enhanced memory viewer WebSocket integration active for real-time synchronization');
} else {
  console.warn('⚠ No MCP WebSocket available - memory viewer real-time updates disabled');
}

import { iMaCoMpUtERussyMemory } from '../memory.js';

// Memory region definitions
const MEMORY_REGIONS = [
  { name: 'Zero Page', start: 0x0000, end: 0x00FF, color: '#00ffff' },
  { name: 'Stack', start: 0x0100, end: 0x01FF, color: '#ff8800' },
  { name: 'Video Buffer', start: 0x0200, end: 0x05FF, color: '#ff00ff' },
  { name: 'User RAM', start: 0x0600, end: 0x7FFF, color: '#00ff00' },
  { name: 'Video ROM', start: 0x8000, end: 0xBFFF, color: '#ffff00' },
  { name: 'System ROM', start: 0xC000, end: 0xFFFF, color: '#ff4444' }
];

// Global variables for refresh function
let currentMemory, currentContainer;

/**
 * Render multiple memory regions as separate sections with full content
 * @param {iMaCoMpUtERussyMemory|Uint8Array} memory - Memory instance (supports readByte or direct access)
 * @param {HTMLElement} containerElement - Container element for rendering
 */
export function renderMultiRegionMemory(memory, containerElement) {
    if (!containerElement) {
        console.warn('Container element not provided for memory viewer');
        return;
    }

    // Store for refresh function
    currentMemory = memory;
    currentContainer = containerElement;

    // Clear container and build multi-region view
    let totalHtml = '';

    // Initialize global memory state for all regions
    if (!window.lastMemoryState) {
        window.lastMemoryState = new Map();
    }

    for (const region of MEMORY_REGIONS) {
        const regionHtml = renderRegion(memory, region);
        totalHtml += regionHtml;
    }

    // Add AI/MCP activity log section
    let logSection = '<div id="ai-mcp-log" class="ai-mcp-log-panel" style="margin-top: 20px; padding: 10px; border: 1px solid #00ff00; background: rgba(0,0,0,0.8);">';
    logSection += '<h4 style="color: #00ff00; margin: 0 0 10px 0;">AI/MCP Activity Log</h4>';
    logSection += '<div id="activity-log" style="height: 200px; overflow-y: auto; background: #000; color: #0f0; padding: 10px; font-family: monospace; font-size: 12px; border: 1px solid #0f0;"></div>';
    logSection += '</div>';

    containerElement.innerHTML = totalHtml + logSection;

    // Setup MCP log syncing after DOM is updated
    const activityLog = containerElement.querySelector('#activity-log');
    const mcpDisplay = document.getElementById('mcp-display');
    if (mcpDisplay && !window.memoryLogSynced) {
      const observer = new MutationObserver(() => {
        if (activityLog) {
          activityLog.innerHTML = mcpDisplay.innerHTML;
          activityLog.scrollTop = activityLog.scrollHeight;
        }
      });
      observer.observe(mcpDisplay, { childList: true, subtree: true });
      window.memoryLogSynced = true;
      console.log('Synced MCP logs to multi-region memory viewer');
    }
}

/**
 * Render a single memory region with full content
 */
function renderRegion(memory, region) {
    const { name, start, end, color } = region;
    const length = end - start + 1;
    const bytesPerRow = 16;
    const rows = Math.ceil(length / bytesPerRow);

    // Region header
    let html = `<div class="memory-region" style="margin-bottom: 20px; border: 2px solid ${color}; padding: 10px; background: rgba(0,0,0,0.9);">
        <h3 style="color: ${color}; margin: 0 0 10px 0; font-family: monospace; font-size: 14px; border-bottom: 1px solid ${color}; padding-bottom: 5px;">
            ${name} (0x${start.toString(16).toUpperCase()}-0x${end.toString(16).toUpperCase()})
        </h3>
        <div class="memory-content" style="max-height: 400px; overflow-y: auto; font-family: monospace; font-size: 12px; line-height: 1.2;">`;

    // Memory content
    for (let row = 0; row < rows; row++) {
        const rowStart = start + (row * bytesPerRow);
        const rowEnd = Math.min(rowStart + bytesPerRow, end + 1);

        // Address
        html += `<div style="display: flex; margin-bottom: 2px;">
            <span style="color: ${color}; font-weight: bold; min-width: 70px;">${rowStart.toString(16).padStart(4, '0')}:</span>
            <span style="margin-left: 10px;">`;

        // Hex bytes
        for (let i = rowStart; i < rowEnd; i++) {
            let byte;
            if (memory.readByte) {
                byte = memory.readByte(i);
            } else {
                byte = memory[i] || 0;
            }

            // Check for changes
            const regionKey = `${name}_${i}`;
            const isChanged = window.lastMemoryState.has(regionKey) && window.lastMemoryState.get(regionKey) !== byte;
            const highlightClass = isChanged ? ' changed-byte' : '';

            html += `<span class="byte${highlightClass}" style="margin-right: 3px; ${isChanged ? 'background-color: rgba(255, 0, 0, 0.3); border: 1px solid #ff0000;' : ''}">${byte.toString(16).padStart(2, '0')}</span>`;

            // Update last memory state
            window.lastMemoryState.set(regionKey, byte);
        }

        // Padding for incomplete rows
        for (let i = rowEnd; i < rowStart + bytesPerRow; i++) {
            html += '<span style="margin-right: 3px;">  </span>';
        }

        // ASCII representation
        html += '</span><span style="margin-left: 20px; color: #ccc;">|';
        for (let i = rowStart; i < rowEnd; i++) {
            let byte;
            if (memory.readByte) {
                byte = memory.readByte(i);
            } else {
                byte = memory[i] || 0;
            }

            const regionKey = `${name}_${i}`;
            const isChanged = window.lastMemoryState.has(regionKey) && window.lastMemoryState.get(regionKey) !== byte;
            const highlightClass = isChanged ? ' changed-byte' : '';
            const char = (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';

            html += `<span class="char${highlightClass}" style="${isChanged ? 'background-color: rgba(255, 0, 0, 0.3);' : ''}">${char}</span>`;
        }
        html += '|</span></div>';
    }

    html += '</div></div>';
    return html;
}

/**
 * Refresh the current memory view
 */
export function refresh() {
    if (currentMemory && currentContainer) {
        renderMultiRegionMemory(currentMemory, currentContainer);
    } else {
        console.warn('No current memory view to refresh');
    }
}


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

    // Create navigation and search controls
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'memory-controls';
    controlsDiv.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; padding: 5px; background: rgba(0,0,0,0.5); border: 1px solid #00ff00;';
    controlsDiv.innerHTML = `
        <label style="color: #00ff00; font-family: monospace;">
            Address: <input type="text" id="memory-address-input" value="0x0200" size="6" style="width: 80px; padding: 2px; background: #333; color: #00ff00; border: 1px solid #00ff00;">
        </label>
        <button id="memory-goto-btn" style="padding: 5px 10px; background: #00ff00; color: #000; border: none; cursor: pointer;">Go To</button>
        <button id="memory-prev-page-btn" style="padding: 5px 10px; background: #0080ff; color: white; border: none; cursor: pointer;">Prev Page</button>
        <button id="memory-next-page-btn" style="padding: 5px 10px; background: #0080ff; color: white; border: none; cursor: pointer;">Next Page</button>
        <label style="color: #00ff00; font-family: monospace;">
            Search: <input type="text" id="memory-search-input" placeholder="e.g. FF or 41" size="6" style="width: 60px; padding: 2px; background: #333; color: #00ff00; border: 1px solid #00ff00;">
        </label>
        <button id="memory-search-btn" style="padding: 5px 10px; background: #ff8000; color: white; border: none; cursor: pointer;">Search</button>
    `;
    rootElement.appendChild(controlsDiv);

    // Get control elements
    const addressInput = controlsDiv.querySelector('#memory-address-input');
    const gotoBtn = controlsDiv.querySelector('#memory-goto-btn');
    const prevPageBtn = controlsDiv.querySelector('#memory-prev-page-btn');
    const nextPageBtn = controlsDiv.querySelector('#memory-next-page-btn');
    const searchInput = controlsDiv.querySelector('#memory-search-input');
    const searchBtn = controlsDiv.querySelector('#memory-search-btn');

    // Event listeners
    if (gotoBtn) {
        gotoBtn.addEventListener('click', () => {
            const addr = parseInt(addressInput.value, 16);
            if (!isNaN(addr) && addr >= 0 && addr <= 0xFFFF) {
                currentStartAddr = addr;
                addressInput.value = `0x${addr.toString(16).toUpperCase()}`;
                refresh();
                console.log(`Memory view jumped to 0x${addr.toString(16).toUpperCase()}`);
            } else {
                console.warn('Invalid address');
            }
        });
    }

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            currentStartAddr = Math.max(0, currentStartAddr - currentLength);
            addressInput.value = `0x${currentStartAddr.toString(16).toUpperCase()}`;
            refresh();
            console.log(`Memory view previous page to 0x${currentStartAddr.toString(16).toUpperCase()}`);
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            currentStartAddr = Math.min(0xFFFF - currentLength, currentStartAddr + currentLength);
            addressInput.value = `0x${currentStartAddr.toString(16).toUpperCase()}`;
            refresh();
            console.log(`Memory view next page to 0x${currentStartAddr.toString(16).toUpperCase()}`);
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const searchValue = searchInput.value.trim();
            if (!searchValue) return;

            let searchByte;
            if (searchValue.startsWith('0x')) {
                searchByte = parseInt(searchValue.slice(2), 16);
            } else {
                searchByte = parseInt(searchValue, 16);
            }

            if (isNaN(searchByte) || searchByte < 0 || searchByte > 255) {
                console.warn('Invalid search value');
                return;
            }

            // Search from current address
            for (let i = currentStartAddr; i < 0x10000; i++) {
                if (currentMemory.readByte(i) === searchByte) {
                    currentStartAddr = Math.max(0, i - currentLength/2); // Center on match
                    addressInput.value = `0x${currentStartAddr.toString(16).toUpperCase()}`;
                    refresh();
                    console.log(`Memory search found 0x${searchByte.toString(16).toUpperCase()} near 0x${i.toString(16).toUpperCase()}`);
                    return;
                }
            }
            console.log('Search value not found');
        });
    }

    // Import the CPU and memory from debugger module if available
    import('./debugger.js').then(debuggerModule => {
        if (debuggerModule.memory) {
            const memoryDisplay = document.getElementById('memory-display') || rootElement.querySelector('#memory-display') || rootElement;
            if (memoryDisplay) {
                // Create memory display div if it doesn't exist
                if (memoryDisplay.id !== 'memory-display') {
                    const displayDiv = document.createElement('div');
                    displayDiv.id = 'memory-display';
                    rootElement.appendChild(displayDiv);
                    memoryDisplay = displayDiv;
                }
                // Render all memory regions with full content
                renderMultiRegionMemory(debuggerModule.memory, memoryDisplay);
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
        .memory-controls button:hover {
          opacity: 0.8;
        }
        .memory-controls input:focus {
          outline: 1px solid #00ff00;
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
      window.layoutManager.makePanelResizable(rootElement);
      console.log('Memory viewer panel made resizable');
    }

    console.log('Enhanced memory viewer with navigation and search initialized');
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
                // Render all memory regions with full content
                renderMultiRegionMemory(debuggerModule.memory, memoryDisplay);
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
                // Render all memory regions with full content
                renderMultiRegionMemory(debuggerModule.memory, memoryDisplay);

                // Log assembly region status
                const programBytes = [];
                for (let i = 0x0600; i < 0x0800; i++) {
                    programBytes.push(debuggerModule.memory.readByte(i));
                }

                const nonZeroBytes = programBytes.filter(b => b !== 0).length;
                const assemblyDensity = (nonZeroBytes / programBytes.length * 100).toFixed(1);

                if (window.logToMCP) {
                    window.logToMCP('info', `Multi-Region Memory Viewer: Program region 0x0600-0x0800 status`, {
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
