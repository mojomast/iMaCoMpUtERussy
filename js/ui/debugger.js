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
            </div>
            <div class="control-buttons">
                <button id="run-btn">Run</button>
                <button id="step-btn">Step</button>
                <button id="reset-btn">Reset</button>
            </div>
            <div class="speed-control">
                <label>Speed: <span id="speed-value">100</span> Hz</label>
                <input type="range" id="speed-slider" min="1" max="1000" value="100">
            </div>
        `;
        rootElement.appendChild(controlsDiv);
        console.log('Controls container created and appended');

        // Get elements after creation
        runBtn = document.getElementById('run-btn');
        stepBtn = document.getElementById('step-btn');
        resetBtn = document.getElementById('reset-btn');
        speedSlider = document.getElementById('speed-slider');
        speedValue = document.getElementById('speed-value');
        console.log('Controls elements retrieved after creation');
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
}

/**
 * Handle run button click
 */
function handleRun() {
    const runBtn = document.getElementById('run-btn');
    if (!runBtn) return;

    if (runIntervalId) {
        // Stop running
        clearInterval(runIntervalId);
        runIntervalId = null;
        runBtn.textContent = 'Run';
    } else {
        // Start running
        const interval = 1000 / currentSpeed;
        runIntervalId = setInterval(() => {
            cpu.step();
            renderRegisters();
        }, interval);
        runBtn.textContent = 'Stop';
    }
}

/**
 * Handle step button click
 */
function handleStep() {
    cpu.step();
    renderRegisters();
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
 * TODO: Implement full debugger features:
 * - Web worker offload for run loop to avoid blocking UI
 * - Cycle-accurate timing instead of simple setInterval
 * - Breakpoint setting and management
 * - Memory inspection integration
 * - Step over/step into functionality
 * - Call stack display
 * - Performance profiling
 */
