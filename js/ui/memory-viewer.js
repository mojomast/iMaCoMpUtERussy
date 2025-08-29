/**
 * Memory Viewer UI for VideoStorage-8 Emulator
 * Hex + ASCII renderer for memory slices
 */

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
            html += byte.toString(16).padStart(2, '0') + ' ';
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
            const char = (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
            html += char;
        }

        html += '|\n';
    }

    html += '</pre>';
    containerElement.innerHTML = html;
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
 * TODO: Implement full memory viewer features:
 * - Scrollable view with navigation controls
 * - Address input for jumping to specific locations
 * - Memory editing capability
 * - Highlighting of modified bytes
 * - Search functionality for bytes/patterns
 * - Different view modes (binary, decimal, octal)
 * - Memory region labels and annotations
 * - Export/import memory dumps
 */
