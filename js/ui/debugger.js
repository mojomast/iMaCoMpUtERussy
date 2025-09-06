/**
 * Debugger UI for iMaCoMpUtERussy Emulator
 * CPU integration with register display and control buttons
 * Kyle Durepos - iMaCoMpUtERussy Project
 */

import { iMaCoMpUtERussyCPU } from '../cpu.js';
import { iMaCoMpUtERussyMemory } from '../memory.js';
import { assemble } from '../assembler.js';

// Global instances for other modules to access
export let cpu, memory;

// Run loop variables
let runIntervalId = null;
let currentSpeed = 100; // Hz

/**
 * Initialize debugger UI
 * @param {string} rootElementId - ID of root element for debugger UI
 */
export function initializeDebugger(rootElementId) {
    console.log('🔧 Initializing debugger with rootElementId:', rootElementId);
    const rootElement = document.getElementById(rootElementId);
    if (!rootElement) {
        console.warn(`Debugger root element '${rootElementId}' not found`);
        return;
    }
    console.log('Debugger root element found:', rootElement);

    // Instantiate memory and CPU
    console.log('Creating memory and CPU instances...');
    memory = new iMaCoMpUtERussyMemory();
    cpu = new iMaCoMpUtERussyCPU({ memory });
    console.log('Memory and CPU created');

    // Set up memory breakpoint integration
    if (memory && memory.setBreakpointHitCallback) {
        memory.setBreakpointHitCallback((type, addr, val) => {
            console.log(`Memory breakpoint hit: ${type} at 0x${addr.toString(16).toUpperCase()} = 0x${val.toString(16).toUpperCase()}`);
            // Stop execution if running
            if (runIntervalId) {
                clearInterval(runIntervalId);
                runIntervalId = null;
                const runBtn = document.getElementById('run-btn');
                if (runBtn) runBtn.textContent = 'Run';
            }
            updateStatus(`Memory breakpoint hit: ${type} at 0x${addr.toString(16).toUpperCase()}`, 'warning');
            // Highlight in memory view if available
            if (typeof window.refreshMemoryDisplay === 'function') {
                window.refreshMemoryDisplay(addr);
            }
        });
    }

    // Listen for memory breakpoint events
    if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('memoryBreakpointHit', (event) => {
            const { type, address, value, paused } = event.detail;
            console.log(`Memory event: ${type} at 0x${address.toString(16).toUpperCase()} = 0x${value.toString(16).toUpperCase()}, paused: ${paused}`);
            
            // Stop execution if running
            if (runIntervalId) {
                clearInterval(runIntervalId);
                runIntervalId = null;
                const runBtn = document.getElementById('run-btn');
                if (runBtn) runBtn.textContent = 'Run';
            }
            
            updateStatus(`Memory breakpoint: ${type} at 0x${address.toString(16).toUpperCase()}`, 'warning');
            
            // Update memory view to highlight breakpoint location
            if (typeof window.refreshMemoryDisplay === 'function') {
                window.refreshMemoryDisplay(address);
            }
            
            // Update pause state display
            updatePauseStatus(paused);
        });
    }

    // Create register panel
    const registersDiv = document.createElement('div');
    registersDiv.id = 'registers';
    rootElement.appendChild(registersDiv);
    console.log('Registers div created and appended');

    // Check if controls exist, create if not
    console.log('Checking for existing controls...');
    let runBtn = document.getElementById('run-btn');
    let stepBtn = document.getElementById('step-btn');
    let resetBtn = document.getElementById('reset-btn');
    let speedSlider = document.getElementById('speed-slider');
    let speedValue = document.getElementById('speed-value');

    console.log('Existing controls:', { runBtn: !!runBtn, stepBtn: !!stepBtn, resetBtn: !!resetBtn });

    if (!runBtn || !stepBtn || !resetBtn) {
        // Create controls container
        console.log('Creating controls container...');
        const controlsDiv = document.createElement('div');
        controlsDiv.id = 'debugger-controls';
        controlsDiv.innerHTML = `
            <div class="file-load-section">
                <label>Load Assembly File:
                    <input type="file" id="asm-load-input" accept=".asm,.txt" />
                </label>
                <button id="load-sample-btn">Load Sample Program</button>
                <button id="save-memory-dump-btn">Save Memory Dump</button>
            </div>
            <div class="control-buttons">
                <button id="run-btn">Run</button>
                <button id="step-btn">Step</button>
                <button id="resume-btn" style="display:none;">Resume</button>
                <button id="reset-btn">Reset</button>
            </div>
            <div class="speed-control">
                <label>Speed: <span id="speed-value">100</span> Hz</label>
                <input type="range" id="speed-slider" min="1" max="1000" value="100">
            </div>
            <div class="breakpoint-controls">
                <label>Memory Breakpoints:</label>
                <div class="breakpoint-manager">
                    <input type="text" id="breakpoint-address" placeholder="0x0600" size="8" />
                    <select id="breakpoint-type">
                        <option value="write">Write</option>
                        <option value="read">Read</option>
                        <option value="all">Read/Write</option>
                    </select>
                    <button id="add-breakpoint-btn">Add</button>
                    <button id="remove-breakpoint-btn">Remove</button>
                    <button id="clear-breakpoints-btn">Clear All</button>
                    <button id="list-breakpoints-btn">List</button>
                    <div id="breakpoints-list" style="margin-top: 5px; font-size: 10px; max-height: 100px; overflow-y: auto; background: rgba(0,0,0,0.5); padding: 5px;"></div>
                </div>
            </div>
            <div class="pause-status" id="pause-status" style="display:none; color: orange; font-weight: bold;">
                Execution Paused - Check Breakpoints
            </div>
        `;
        rootElement.appendChild(controlsDiv);
        console.log('Controls container created and appended');

        // Get elements after creation
        runBtn = document.getElementById('run-btn');
        stepBtn = document.getElementById('step-btn');
        const resumeBtn = document.getElementById('resume-btn');
        resetBtn = document.getElementById('reset-btn');
        speedSlider = document.getElementById('speed-slider');
        speedValue = document.getElementById('speed-value');
        
        // Memory breakpoint controls
        const breakpointAddressInput = document.getElementById('breakpoint-address');
        const breakpointTypeSelect = document.getElementById('breakpoint-type');
        const addBreakpointBtn = document.getElementById('add-breakpoint-btn');
        const removeBreakpointBtn = document.getElementById('remove-breakpoint-btn');
        const clearBreakpointsBtn = document.getElementById('clear-breakpoints-btn');
        const listBreakpointsBtn = document.getElementById('list-breakpoints-btn');
        const breakpointsList = document.getElementById('breakpoints-list');
        const pauseStatusDiv = document.getElementById('pause-status');
        
        console.log('Controls elements retrieved after creation');
    
        // Memory breakpoint event handlers
        if (addBreakpointBtn && breakpointAddressInput && breakpointTypeSelect && memory && memory.addBreakpoint) {
            addBreakpointBtn.addEventListener('click', () => {
                const addressStr = breakpointAddressInput.value.trim();
                const type = breakpointTypeSelect.value;
                try {
                    const address = parseInt(addressStr, 16);
                    if (isNaN(address) || address < 0 || address > 0xFFFF) {
                        updateStatus('Invalid memory breakpoint address', 'error');
                        return;
                    }
                    const id = memory.addBreakpoint(address, type);
                    updateStatus(`Memory breakpoint ${id} added at 0x${address.toString(16).toUpperCase()} (${type})`, 'success');
                    // Refresh display
                    refreshDisplay();
                } catch (error) {
                    updateStatus(`Failed to add memory breakpoint: ${error.message}`, 'error');
                }
            });
        }
    
        if (removeBreakpointBtn && breakpointAddressInput && memory && memory.removeBreakpoint) {
            removeBreakpointBtn.addEventListener('click', () => {
                const addressStr = breakpointAddressInput.value.trim();
                try {
                    const address = parseInt(addressStr, 16);
                    if (isNaN(address)) {
                        updateStatus('Invalid address for removal', 'error');
                        return;
                    }
                    // Find and remove breakpoint at this address
                    const breakpoints = memory.getBreakpoints ? memory.getBreakpoints() : [];
                    const breakpoint = breakpoints.find(bp => bp.address === address);
                    if (breakpoint) {
                        const removed = memory.removeBreakpoint(breakpoint.id);
                        if (removed) {
                            updateStatus(`Memory breakpoint removed at 0x${address.toString(16).toUpperCase()}`, 'success');
                        } else {
                            updateStatus('Failed to remove memory breakpoint', 'error');
                        }
                    } else {
                        updateStatus(`No memory breakpoint at 0x${address.toString(16).toUpperCase()}`, 'warning');
                    }
                    refreshDisplay();
                } catch (error) {
                    updateStatus(`Failed to remove memory breakpoint: ${error.message}`, 'error');
                }
            });
        }
    
        if (clearBreakpointsBtn && memory && memory.clearBreakpoints) {
            clearBreakpointsBtn.addEventListener('click', () => {
                const count = memory.clearBreakpoints();
                updateStatus(`Cleared ${count} memory breakpoints`, 'info');
                refreshDisplay();
            });
        }
    
        if (listBreakpointsBtn && memory && memory.getBreakpoints) {
            listBreakpointsBtn.addEventListener('click', () => {
                const breakpoints = memory.getBreakpoints();
                if (breakpoints.length === 0) {
                    breakpointsList.innerHTML = '<span style="color: #666;">No memory breakpoints set</span>';
                } else {
                    breakpointsList.innerHTML = breakpoints.map(bp =>
                        `<div style="margin: 2px 0; padding: 2px; background: rgba(255,0,0,0.1); border-left: 3px solid #ff0000;">
                            ID:${bp.id} 0x${bp.address.toString(16).toUpperCase()} (${bp.type})${bp.hasCondition ? ' [conditional]' : ''}${bp.hasCallback ? ' [callback]' : ''}
                        </div>`
                    ).join('');
                }
                updateStatus(`Found ${breakpoints.length} memory breakpoint(s)`, 'info');
            });
        }
    
        // Resume button for memory pause
        if (resumeBtn && memory && memory.resume) {
            resumeBtn.addEventListener('click', () => {
                memory.resume();
                updatePauseStatus(false);
                resumeBtn.style.display = 'none';
                updateStatus('Execution resumed', 'success');
            });
        }
    
        // Pause status updater
        function updatePauseStatus(isPaused) {
            if (pauseStatusDiv) {
                if (isPaused) {
                    pauseStatusDiv.style.display = 'block';
                    resumeBtn.style.display = 'inline-block';
                } else {
                    pauseStatusDiv.style.display = 'none';
                    resumeBtn.style.display = 'none';
                }
            }
            if (memory && memory.isPaused) {
                console.log(`Memory pause state: ${memory.isPaused()}`);
            }
        }
    
        // Periodically check memory pause state during run
        setInterval(() => {
            if (memory && memory.isPaused && runIntervalId && memory.isPaused()) {
                clearInterval(runIntervalId);
                runIntervalId = null;
                const runBtn = document.getElementById('run-btn');
                if (runBtn) runBtn.textContent = 'Run';
                updatePauseStatus(true);
            }
        }, 50); // Check every 50ms
    }
    
    // Get file loading elements (they should exist now)
    const asmLoadInput = document.getElementById('asm-load-input');
    const loadSampleBtn = document.getElementById('load-sample-btn');

    // Render initial state
    renderRegisters();

    // Wire up button events
    if (runBtn) {
        runBtn.addEventListener('click', handleRun);
    } else {
        console.warn('Run button not found');
    }

    if (stepBtn) {
        stepBtn.addEventListener('click', handleStep);
    } else {
        console.warn('Step button not found');
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', handleReset);
    } else {
        console.warn('Reset button not found');
    }

    if (speedSlider && speedValue) {
        speedSlider.addEventListener('input', (e) => {
            currentSpeed = parseInt(e.target.value);
            speedValue.textContent = currentSpeed;
        });
    } else {
        console.warn('Speed control elements not found');
    }

    // Assembly file loading
    if (asmLoadInput) {
        asmLoadInput.addEventListener('change', handleAssemblyFileLoad);
    }

    if (loadSampleBtn) {
        loadSampleBtn.addEventListener('click', handleLoadSample);
    }

    // Save memory dump button
    const saveDumpBtn = document.getElementById('save-memory-dump-btn');
    if (saveDumpBtn) {
        saveDumpBtn.addEventListener('click', handleSaveMemoryDump);
    }

    // Breakpoint controls
    const breakpointAddressInput = document.getElementById('breakpoint-address');
    const addBreakpointBtn = document.getElementById('add-breakpoint-btn');
    const removeBreakpointBtn = document.getElementById('remove-breakpoint-btn');
    const listBreakpointsBtn = document.getElementById('list-breakpoints-btn');
    const breakpointsList = document.getElementById('breakpoints-list');

    if (addBreakpointBtn) {
        addBreakpointBtn.addEventListener('click', () => handleAddBreakpoint(breakpointAddressInput.value));
    }

    if (removeBreakpointBtn) {
        removeBreakpointBtn.addEventListener('click', () => handleRemoveBreakpoint(breakpointAddressInput.value));
    }

    if (listBreakpointsBtn) {
        listBreakpointsBtn.addEventListener('click', () => handleListBreakpoints());
    }

    // Initialize breakpoint list
    updateBreakpointList();
}

/**
 * Handle run button click
 */
function handleRun() {
    const runBtn = document.getElementById('run-btn');
    if (!runBtn) return;

    // Check if paused by memory breakpoint
    if (memory && memory.isPaused && memory.isPaused()) {
        updateStatus('Cannot run - execution paused by memory breakpoint', 'warning');
        return;
    }

    if (runIntervalId) {
        // Stop running
        clearInterval(runIntervalId);
        runIntervalId = null;
        runBtn.textContent = 'Run';
        updateStatus('Execution stopped', 'info');
        updatePauseStatus(false);
    } else {
        // Start running with memory pause checking
        const interval = 1000 / currentSpeed;
        runIntervalId = setInterval(() => {
            // Check memory pause state before stepping
            if (memory && memory.isPaused && memory.isPaused()) {
                clearInterval(runIntervalId);
                runIntervalId = null;
                runBtn.textContent = 'Run';
                updatePauseStatus(true);
                return;
            }
            
            if (cpu) {
                cpu.step();
                renderRegisters();
                // Check CPU breakpoints after step
                checkBreakpoint();
            }
        }, interval);
        runBtn.textContent = 'Stop';
        updateStatus('Execution started', 'info');
        updatePauseStatus(false);
    }
}

/**
 * Handle step button click
 */
async function handleStep() {
    // Check if paused by memory breakpoint
    if (memory && memory.isPaused && memory.isPaused()) {
        updateStatus('Cannot step - execution paused by memory breakpoint', 'warning');
        return;
    }

    if (cpu) {
        const wasAtBreakpoint = checkBreakpoint();
        if (wasAtBreakpoint) {
            updateStatus('Stepped from CPU breakpoint', 'info');
            return;
        }
        
        cpu.step();
        renderRegisters();
        
        // Check memory pause after step
        if (memory && memory.isPaused && memory.isPaused()) {
            updateStatus('Paused by memory breakpoint after step', 'warning');
            updatePauseStatus(true);
            return;
        }
        
        // Check CPU breakpoints after step
        checkBreakpoint();
    }
}

/**
 * Refresh the display (registers and memory if available)
 */
function refreshDisplay() {
    renderRegisters();
    
    // Also refresh memory viewer if available
    import('./memory-viewer.js').then(memoryModule => {
        if (memoryModule.refreshMemoryDisplay && memory) {
            memoryModule.refreshMemoryDisplay();
        }
    }).catch(() => {
        // Memory viewer not available, that's ok
    });
}

// Export the refresh function for other modules
export { refreshDisplay };

/**
 * Handle reset button click
 */
function handleReset() {
    // Stop run loop if active
    if (runIntervalId) {
        clearInterval(runIntervalId);
        runIntervalId = null;
        const runBtn = document.getElementById('run-btn');
        if (runBtn) runBtn.textContent = 'Run';
    }

    // Reset CPU
    cpu.reset();

    // Clear video buffer $0200-$05FF
    for (let addr = 0x0200; addr <= 0x05FF; addr++) {
        memory.writeByte(addr, 0);
    }

    renderRegisters();
}

/**
 * Render CPU registers to UI
 */
function renderRegisters() {
    const container = document.getElementById('registers');
    if (!container) return;

    // Decode flags from P register
    const flags = cpu.P;
    const flagBits = {
        C: (flags & 0x01) !== 0, // Carry
        Z: (flags & 0x02) !== 0, // Zero
        I: (flags & 0x04) !== 0, // Interrupt disable
        D: (flags & 0x08) !== 0, // Decimal mode
        B: (flags & 0x10) !== 0, // Break
        V: (flags & 0x40) !== 0, // Overflow
        N: (flags & 0x80) !== 0  // Negative
    };

    container.innerHTML = `
        <div class="register-row">
            <span>PC: ${cpu.PC.toString(16).padStart(4, '0')}</span>
            <span>SP: ${cpu.SP.toString(16).padStart(2, '0')}</span>
        </div>
        <div class="register-row">
            <span>A: ${cpu.A.toString(16).padStart(2, '0')}</span>
            <span>X: ${cpu.X.toString(16).padStart(2, '0')}</span>
            <span>Y: ${cpu.Y.toString(16).padStart(2, '0')}</span>
        </div>
        <div class="register-row">
            <span>P: ${cpu.P.toString(16).padStart(2, '0')}</span>
            <span>Flags: C=${flagBits.C ? 1 : 0} Z=${flagBits.Z ? 1 : 0} I=${flagBits.I ? 1 : 0} D=${flagBits.D ? 1 : 0} B=${flagBits.B ? 1 : 0} V=${flagBits.V ? 1 : 0} N=${flagBits.N ? 1 : 0}</span>
        </div>
    `;
}

/**
 * Handle assembly file loading
 * @param {Event} event - File input change event
 */
async function handleAssemblyFileLoad(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const content = await file.text();
        const assembled = assemble(content);
        
        if (assembled && assembled.bytes && assembled.bytes.length > 0) {
            // Reset CPU and load program
            cpu.reset();
            memory.loadProgram(assembled.bytes, assembled.origin || 0x0600);
            
            updateStatus(`Loaded ${file.name}: ${assembled.bytes.length} bytes at $${(assembled.origin || 0x0600).toString(16).toUpperCase()}`, 'success');
            refreshDisplay();
        } else {
            updateStatus(`Failed to assemble ${file.name}`, 'error');
        }
    } catch (error) {
        updateStatus(`Error loading ${file.name}: ${error.message}`, 'error');
        console.error('Assembly file load error:', error);
    }
}

/**
 * Handle loading a sample program
 */
async function handleLoadSample() {
    try {
        // Load a sample program (fibonacci.asm)
        const response = await fetch('samples/fibonacci.asm');
        if (!response.ok) {
            throw new Error('Sample file not found');
        }
        
        const content = await response.text();
        const assembled = assemble(content);
        
        if (assembled && assembled.bytes && assembled.bytes.length > 0) {
            cpu.reset();
            memory.loadProgram(assembled.bytes, assembled.origin || 0x0600);
            
            updateStatus(`Loaded fibonacci.asm: ${assembled.bytes.length} bytes at $${(assembled.origin || 0x0600).toString(16).toUpperCase()}`, 'success');
            refreshDisplay();
        } else {
            updateStatus('Failed to assemble sample program', 'error');
        }
    } catch (error) {
        updateStatus(`Error loading sample: ${error.message}`, 'error');
        console.error('Sample load error:', error);
    }
}

/**
 * Update status display
 * @param {string} message - Status message
 * @param {string} type - Message type ('success', 'error', 'warning', 'info')
 */
function updateStatus(message, type = 'info') {
    // Find or create status display
    let statusDiv = document.getElementById('debugger-status');
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'debugger-status';
        statusDiv.className = 'status-display';
        
        const debuggerSection = document.getElementById('debugger');
        if (debuggerSection) {
            debuggerSection.appendChild(statusDiv);
        }
    }
    
    statusDiv.textContent = message;
    statusDiv.className = `status-display ${type}`;
    
    // Auto-clear after 5 seconds for non-error messages
    if (type !== 'error') {
        setTimeout(() => {
            if (statusDiv.textContent === message) {
                statusDiv.textContent = '';
                statusDiv.className = 'status-display';
            }
        }, 5000);
    }
}

/**
 * Update pause status display and controls
 * @param {boolean} isPaused
 */
function updatePauseStatus(isPaused) {
    const pauseStatusDiv = document.getElementById('pause-status');
    const resumeBtn = document.getElementById('resume-btn');
    if (pauseStatusDiv && resumeBtn) {
        if (isPaused) {
            pauseStatusDiv.style.display = 'block';
            resumeBtn.style.display = 'inline-block';
        } else {
            pauseStatusDiv.style.display = 'none';
            resumeBtn.style.display = 'none';
        }
    }
}

/**
 * Breakpoint management functions
 */
let breakpoints = new Set(); // Store breakpoint addresses

/**
 * Add breakpoint at address
 */
async function handleAddBreakpoint(addressStr) {
    try {
        const address = parseInt(addressStr, 16);
        if (isNaN(address) || address < 0 || address > 0xFFFF) {
            updateStatus('Invalid breakpoint address', 'error');
            return;
        }

        if (breakpoints.has(address)) {
            updateStatus(`Breakpoint already exists at 0x${address.toString(16).toUpperCase()}`, 'warning');
            return;
        }

        breakpoints.add(address);
        updateBreakpointList();
        updateStatus(`Breakpoint added at 0x${address.toString(16).toUpperCase()}`, 'success');

        // Notify MCP if available
        if (window.mcpClient && window.mcpClient.serverAvailable) {
            try {
                const result = await window.mcpClient.post('/mcp/debug/breakpoints', {
                    action: 'set',
                    address
                });
                if (result.success) {
                    console.log('MCP breakpoint set:', result);
                }
            } catch (error) {
                console.warn('MCP breakpoint set failed:', error);
            }
        }

        // Refresh display
        refreshDisplay();

    } catch (error) {
        updateStatus(`Failed to add breakpoint: ${error.message}`, 'error');
    }
}

/**
 * Remove breakpoint at address
 */
async function handleRemoveBreakpoint(addressStr) {
    try {
        const address = parseInt(addressStr, 16);
        if (isNaN(address)) {
            updateStatus('Invalid address', 'error');
            return;
        }

        if (!breakpoints.has(address)) {
            updateStatus(`No breakpoint at 0x${address.toString(16).toUpperCase()}`, 'warning');
            return;
        }

        breakpoints.delete(address);
        updateBreakpointList();
        updateStatus(`Breakpoint removed at 0x${address.toString(16).toUpperCase()}`, 'success');

        // Notify MCP if available
        if (window.mcpClient && window.mcpClient.serverAvailable) {
            try {
                const result = await window.mcpClient.post('/mcp/debug/breakpoints', {
                    action: 'remove',
                    address
                });
                if (result.success) {
                    console.log('MCP breakpoint removed:', result);
                }
            } catch (error) {
                console.warn('MCP breakpoint remove failed:', error);
            }
        }

        refreshDisplay();

    } catch (error) {
        updateStatus(`Failed to remove breakpoint: ${error.message}`, 'error');
    }
}

/**
 * List all breakpoints
 */
function handleListBreakpoints() {
    updateBreakpointList();
    updateStatus(`Found ${breakpoints.size} breakpoint(s)`, 'info');
}

/**
 * Update breakpoint list display
 */
function updateBreakpointList() {
    if (!breakpointsList) return;

    if (breakpoints.size === 0) {
        breakpointsList.innerHTML = '<span style="color: #666;">No breakpoints set</span>';
        return;
    }

    const breakpointArray = Array.from(breakpoints).sort((a, b) => a - b);
    breakpointsList.innerHTML = breakpointArray.map(addr =>
        `<div style="margin: 2px 0; padding: 2px; background: rgba(255,0,0,0.1); border-left: 3px solid #ff0000;">
            0x${addr.toString(16).toUpperCase()}
        </div>`
    ).join('');
}

/**
 * Check if current PC is at a breakpoint
 */
function checkBreakpoint() {
    if (cpu && breakpoints.has(cpu.PC)) {
        // Stop execution and notify
        if (runIntervalId) {
            clearInterval(runIntervalId);
            runIntervalId = null;
            const runBtn = document.getElementById('run-btn');
            if (runBtn) runBtn.textContent = 'Run';
        }
        
        updateStatus(`Breakpoint hit at 0x${cpu.PC.toString(16).toUpperCase()}`, 'warning');
        
        // Notify MCP
        if (window.mcpWebSocket && window.mcpWebSocket.readyState === WebSocket.OPEN) {
            window.mcpWebSocket.send(JSON.stringify({
                type: 'debug.breakpoint',
                data: { pc: cpu.PC, message: 'Breakpoint hit' },
                timestamp: new Date().toISOString()
            }));
        }
        
        return true;
    }
    return false;
}

/**
 * Enhanced step function with breakpoint checking
 */
async function handleStep() {
    // Check if paused by memory breakpoint
    if (memory && memory.isPaused && memory.isPaused()) {
        updateStatus('Cannot step - execution paused by memory breakpoint. Click Resume.', 'warning');
        return;
    }

    if (cpu) {
        const wasAtBreakpoint = checkBreakpoint();
        if (wasAtBreakpoint) {
            updateStatus('Stepped from CPU breakpoint', 'info');
            return;
        }
        
        cpu.step();
        renderRegisters();
        
        // Check memory pause after step
        if (memory && memory.isPaused && memory.isPaused()) {
            updateStatus('Paused by memory breakpoint after step', 'warning');
            updatePauseStatus(true);
            return;
        }
        
        // Check CPU breakpoints after step
        checkBreakpoint();
    }
}

/**
 * Enhanced run function with breakpoint checking
 */
function handleRun() {
    const runBtn = document.getElementById('run-btn');
    if (!runBtn) return;

    // Check if paused by memory breakpoint
    if (memory && memory.isPaused && memory.isPaused()) {
        updateStatus('Cannot run - execution paused by memory breakpoint. Click Resume.', 'warning');
        return;
    }

    if (runIntervalId) {
        // Stop running
        clearInterval(runIntervalId);
        runIntervalId = null;
        runBtn.textContent = 'Run';
        updateStatus('Execution stopped', 'info');
        updatePauseStatus(false);
    } else {
        // Start running with comprehensive breakpoint checking
        if (checkBreakpoint()) {
            updateStatus('Cannot run - CPU breakpoint at current PC', 'warning');
            return;
        }
        
        const interval = 1000 / currentSpeed;
        runIntervalId = setInterval(() => {
            if (cpu) {
                // Check memory pause state first
                if (memory && memory.isPaused && memory.isPaused()) {
                    clearInterval(runIntervalId);
                    runIntervalId = null;
                    runBtn.textContent = 'Run';
                    updatePauseStatus(true);
                    return;
                }
                
                // Check CPU breakpoint before each step
                if (checkBreakpoint()) {
                    clearInterval(runIntervalId);
                    runIntervalId = null;
                    runBtn.textContent = 'Run';
                    return;
                }
                
                cpu.step();
                renderRegisters();
            }
        }, interval);
        runBtn.textContent = 'Stop';
        updateStatus('Execution started with breakpoint checking', 'info');
        updatePauseStatus(false);
    }
}

/**
 * MCP WebSocket integration for debugger
 */
if (typeof window !== 'undefined' && window.mcpWebSocket) {
    // Override the existing WebSocket message handler to include debug events
    const originalOnMessage = window.mcpWebSocket.onmessage;
    
    window.mcpWebSocket.onmessage = function(event) {
        try {
            const message = JSON.parse(event.data);
            const { type, data } = message;
            
            // Handle debug breakpoint events
            if (type === 'debug.breakpoint') {
                updateStatus(`MCP Debug: ${data.message} at 0x${data.pc?.toString(16).toUpperCase()}`, 'warning');
                
                // Stop execution if running
                if (runIntervalId) {
                    clearInterval(runIntervalId);
                    runIntervalId = null;
                    const runBtn = document.getElementById('run-btn');
                    if (runBtn) runBtn.textContent = 'Run';
                }
                
                // Highlight current PC in memory view if available
                if (typeof window.refreshMemoryDisplay === 'function') {
                    window.refreshMemoryDisplay();
                }
                
                return; // Don't pass to original handler
            }
            
            // Handle debug step requests from MCP
            if (type === 'debug.step') {
                handleStep();
                
                // Respond to MCP
                if (window.mcpWebSocket && window.mcpWebSocket.readyState === WebSocket.OPEN) {
                    window.mcpWebSocket.send(JSON.stringify({
                        type: 'debug.step.response',
                        data: {
                            pc: cpu ? cpu.PC : null,
                            registers: cpu ? {
                                A: cpu.A, X: cpu.X, Y: cpu.Y,
                                P: cpu.P, SP: cpu.SP
                            } : null
                        },
                        timestamp: new Date().toISOString()
                    }));
                }
                
                return;
            }
            
            // Handle debug run requests from MCP
            if (type === 'debug.run') {
                const maxSteps = data.maxSteps || 1000;
                handleRun();
                
                // Run for specified steps then stop
                setTimeout(() => {
                    if (runIntervalId) {
                        clearInterval(runIntervalId);
                        runIntervalId = null;
                        const runBtn = document.getElementById('run-btn');
                        if (runBtn) runBtn.textContent = 'Run';
                        updateStatus(`MCP Run completed: ${maxSteps} steps`, 'info');
                    }
                }, maxSteps * (1000 / currentSpeed));
                
                return;
            }
            
            // Pass other messages to original handler
            if (originalOnMessage) {
                originalOnMessage.call(this, event);
            }
            
        } catch (error) {
            console.error('Debugger MCP message handling error:', error);
        }
    };
    
    console.log('✅ Debugger MCP integration initialized');
}

/**
 * Export enhanced functions for use by other modules
 */
export {
    handleStep as stepWithBreakpoints,
    handleRun as runWithBreakpoints,
    checkBreakpoint,
    breakpoints,
    updateBreakpointList
};

/**
 * TODO: Implement full debugger features:
 * - Web worker offload for run loop to avoid blocking UI
 * - Cycle-accurate timing instead of simple setInterval
 * - Enhanced breakpoint management (conditional breakpoints, step over/into)
 * - Memory inspection integration with breakpoints
 * - Call stack display
 * - Performance profiling with MCP reporting
 * - Remote debugging via WebSocket
 */
