/**
 * Assembly Input Panel for iMaCoMpUtERussy Emulator
 * Provides a text editor for assembly code with assemble/load/run functionality
 * Integrates with MCP client for remote execution
 */

import { assemble } from '../assembler.js';
import { initializeDebugger } from './debugger.js';

/**
 * Assembly Panel class managing the UI and functionality
 */
export class AssemblyPanel {
  constructor(panelId = 'assembly-panel') {
    this.panelId = panelId;
    this.elements = {};
    this.mcpClient = window.mcpClient;
    this.currentProgram = '';
    this.assembledBytes = null;
    this.originAddress = 0x0600;
  }

  /**
   * Initialize the assembly panel UI
   */
  initialize() {
    console.log('🔧 Initializing Assembly Panel...');

    try {
      this.createPanelStructure();
      this.setupEventListeners();
      this.loadSampleProgram();
      
      console.log('✅ Assembly Panel initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Assembly Panel initialization failed:', error);
      this.showStatus('Failed to initialize assembly panel: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * Create the panel HTML structure
   */
  createPanelStructure() {
    const panel = document.getElementById(this.panelId);
    if (!panel) {
      throw new Error(`Assembly panel element '${this.panelId}' not found`);
    }

    // Clear existing content
    panel.innerHTML = '';

    // Panel header
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = `
      <span>Assembly Editor</span>
      <div class="panel-controls">
        <button id="${this.panelId}-load-sample">Load Sample</button>
        <button id="${this.panelId}-clear">Clear</button>
      </div>
    `;
    panel.appendChild(header);

    // Editor section
    const editorSection = document.createElement('div');
    editorSection.className = 'assembly-editor-section';
    editorSection.innerHTML = `
      <div class="editor-controls">
        <label>Origin: <input type="text" id="${this.panelId}-origin" value="0x0600" size="8" /></label>
        <button id="${this.panelId}-assemble">Assemble & Load</button>
        <button id="${this.panelId}-step" disabled>Step CPU</button>
        <button id="${this.panelId}-run" disabled>Run Program</button>
        <button id="${this.panelId}-reset" disabled>Reset CPU</button>
        <button id="${this.panelId}-save-backup">Save Backup</button>
        <button id="${this.panelId}-restore-backup">Restore Backup</button>
      </div>
      <textarea id="${this.panelId}-editor" 
                placeholder="Enter assembly code here&#10;Example:&#10;.org 0x0600&#10;LDA #42&#10;STA 0x00&#10;HLT"
                rows="15" style="width: 100%; font-family: monospace; font-size: 12px; background: #000; color: #0f0; border: 1px solid #0f0; padding: 5px;"></textarea>
    `;
    panel.appendChild(editorSection);

    // Status section
    const statusSection = document.createElement('div');
    statusSection.className = 'assembly-status';
    statusSection.id = `${this.panelId}-status`;
    statusSection.innerHTML = '<div class="status-message">Ready to assemble assembly code</div>';
    panel.appendChild(statusSection);

    // Store element references
    this.elements = {
      panel: panel,
      editor: document.getElementById(`${this.panelId}-editor`),
      origin: document.getElementById(`${this.panelId}-origin`),
      assembleBtn: document.getElementById(`${this.panelId}-assemble`),
      stepBtn: document.getElementById(`${this.panelId}-step`),
      runBtn: document.getElementById(`${this.panelId}-run`),
      resetBtn: document.getElementById(`${this.panelId}-reset`),
      loadSampleBtn: document.getElementById(`${this.panelId}-load-sample`),
      clearBtn: document.getElementById(`${this.panelId}-clear`),
      status: statusSection
    };

    // Add CSS for the panel
    this.addStyles();
  }

  /**
   * Add CSS styles for the assembly panel
   */
  addStyles() {
    if (document.getElementById('assembly-panel-styles')) return;

    const style = document.createElement('style');
    style.id = 'assembly-panel-styles';
    style.textContent = `
      .assembly-editor-section {
        padding: 10px;
        border: 1px solid #00ff00;
        background: rgba(0,0,0,0.8);
      }
      .editor-controls {
        margin-bottom: 10px;
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
      }
      .editor-controls label {
        color: #00ff00;
        font-family: monospace;
      }
      .editor-controls input {
        background: #000;
        color: #0f0;
        border: 1px solid #00ff00;
        padding: 2px 4px;
        font-family: monospace;
        font-size: 12px;
      }
      .editor-controls button {
        background: rgba(0,255,0,0.1);
        border: 1px solid #00ff00;
        color: #00ff00;
        padding: 5px 10px;
        font-family: monospace;
        font-size: 12px;
        cursor: pointer;
        border-radius: 3px;
      }
      .editor-controls button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .editor-controls button:hover:not(:disabled) {
        background: rgba(0,255,0,0.2);
      }
      .assembly-status {
        margin-top: 10px;
        padding: 5px;
        font-family: monospace;
        font-size: 11px;
        min-height: 20px;
      }
      .status-message {
        color: #00ff00;
      }
      .status-error {
        color: #ff0000;
      }
      .status-success {
        color: #00ff00;
      }
      .panel-controls {
        display: flex;
        gap: 5px;
        margin-left: auto;
      }
      .panel-controls button {
        padding: 2px 6px;
        font-size: 11px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Setup event listeners for panel controls
   */
  setupEventListeners() {
    // Assemble button
    this.elements.assembleBtn.addEventListener('click', () => this.handleAssemble());
    
    // Backup/restore buttons
    this.elements.saveBackupBtn = document.getElementById(`${this.panelId}-save-backup`);
    this.elements.restoreBackupBtn = document.getElementById(`${this.panelId}-restore-backup`);
    
    this.elements.saveBackupBtn.addEventListener('click', () => this.handleSaveBackup());
    this.elements.restoreBackupBtn.addEventListener('click', () => this.handleRestoreBackup());

    // Step button
    this.elements.stepBtn.addEventListener('click', async () => {
      try {
        this.showStatus('Stepping CPU...', 'info');
        const result = await window.cpuStep(1);
        if (result.success) {
          this.showStatus('CPU step completed', 'success');
          if (window.refreshMemoryDisplay) window.refreshMemoryDisplay();
          if (window.refreshDisplay) window.refreshDisplay();
        } else {
          this.showStatus(`Step failed: ${result.message}`, 'error');
        }
      } catch (error) {
        this.showStatus(`Step error: ${error.message}`, 'error');
        console.error('CPU step error:', error);
      }
    });

    // Run button
    this.elements.runBtn.addEventListener('click', async () => this.handleRun());

    // Reset button
    this.elements.resetBtn.addEventListener('click', async () => {
      try {
        this.showStatus('Resetting CPU...', 'info');
        const result = await window.cpuReset(true); // Hard reset
        if (result.success) {
          this.showStatus('CPU reset completed', 'success');
          this.elements.stepBtn.disabled = false;
          this.elements.runBtn.disabled = false;
          this.elements.resetBtn.disabled = false;
          if (window.refreshMemoryDisplay) window.refreshMemoryDisplay();
          if (window.refreshDisplay) window.refreshDisplay();
        } else {
          this.showStatus(`Reset failed: ${result.message}`, 'error');
        }
      } catch (error) {
        this.showStatus(`Reset error: ${error.message}`, 'error');
        console.error('CPU reset error:', error);
      }
    });

    // Load sample button
    this.elements.loadSampleBtn.addEventListener('click', () => this.loadSampleProgram());

    // Clear button
    this.elements.clearBtn.addEventListener('click', () => this.handleClear());

    // Origin address change
    this.elements.origin.addEventListener('change', (e) => {
      const addr = this.parseAddress(e.target.value);
      if (addr !== null) {
        this.originAddress = addr;
        this.showStatus(`Origin set to 0x${addr.toString(16).toUpperCase()}`, 'info');
      } else {
        e.target.value = `0x${this.originAddress.toString(16).toUpperCase()}`;
        this.showStatus('Invalid address format', 'error');
      }
    });

    // Auto-assemble on editor change (debounced)
    let timeout;
    this.elements.editor.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        this.currentProgram = this.elements.editor.value;
        if (this.currentProgram.trim()) {
          this.handleAssemble({ auto: true });
        }
      }, 1000);
    });
  }

  /**
   * Parse address from string (hex, decimal)
   */
  parseAddress(addrStr) {
    if (!addrStr) return this.originAddress;
    
    // Remove 0x prefix if present
    addrStr = addrStr.replace(/^0x/i, '');
    
    // Try hex first
    const hexVal = parseInt(addrStr, 16);
    if (!isNaN(hexVal) && hexVal >= 0 && hexVal <= 0xFFFF) {
      return hexVal;
    }
    
    // Try decimal
    const decVal = parseInt(addrStr, 10);
    if (!isNaN(decVal) && decVal >= 0 && decVal <= 0xFFFF) {
      return decVal;
    }
    
    return null;
  }

  /**
   * Handle assemble button click or auto-assemble
   */
  async handleAssemble(options = {}) {
    const isAuto = options.auto || false;
    
    try {
      this.showStatus('Assembling and loading via MCP...', 'info');
      
      const source = this.elements.editor.value.trim();
      if (!source) {
        throw new Error('No assembly code to assemble');
      }

      // Parse origin address
      const originStr = this.elements.origin.value;
      this.originAddress = this.parseAddress(originStr);
      if (this.originAddress === null) {
        throw new Error('Invalid origin address');
      }

      // Use MCP assemble and load method
      const result = await window.mcpClient.assembleAndLoad(source, this.originAddress);
      
      if (!result.success) {
        throw new Error(result.error || 'Assembly and load failed');
      }

      this.assembledBytes = new Uint8Array(result.assembledBytes); // Store for reference
      this.currentProgram = source;

      const byteCount = result.assembledBytes;
      const statusMsg = `Assembled and loaded: ${byteCount} bytes at 0x${this.originAddress.toString(16).toUpperCase()}`;
      
      this.showStatus(statusMsg, 'success');
      
      // Enable CPU control buttons
      this.elements.stepBtn.disabled = false;
      this.elements.runBtn.disabled = false;
      this.elements.resetBtn.disabled = false;

      // Log to MCP if available
      if (window.logToMCP && !isAuto) {
        window.logToMCP('info', `MCP Assembly: ${byteCount} bytes loaded at 0x${this.originAddress.toString(16).toUpperCase()}`, {
          origin: this.originAddress,
          byteCount,
          viaMCP: window.mcpClient?.serverAvailable || false
        });
      }

      // Refresh displays
      if (window.refreshMemoryDisplay) window.refreshMemoryDisplay();
      if (window.refreshDisplay) window.refreshDisplay();

      // If auto-assemble, don't show the full dialog
      if (!isAuto) {
        this.showAssemblyPreview(new Uint8Array(result.assembledBytes));
      }

    } catch (error) {
      console.error('MCP Assembly failed:', error);
      this.showStatus(`Assembly failed: ${error.message}`, 'error');
      
      // Keep buttons disabled on error
      this.elements.stepBtn.disabled = true;
      this.elements.runBtn.disabled = true;
      this.elements.resetBtn.disabled = true;
      
      if (window.logToMCP) {
        window.logToMCP('error', 'MCP Assembly failed', { error: error.message, source: this.currentProgram.substring(0, 100) });
      }
    }
  }

  /**
   * Handle load button click - load assembled bytes to memory
   */
  // Deprecated: handleLoad merged into handleAssemble for MCP integration
  async handleLoad() {
    this.showStatus('Load functionality integrated into Assemble button', 'info');
    // Optionally trigger assemble again or show guidance
    if (this.currentProgram && this.assembledBytes) {
      this.handleAssemble({ auto: true });
    }
  }

  /**
   * Load via MCP client (batch memory writes)
   */
  async loadViaMCP() {
    const results = [];
    let bytesLoaded = 0;
    
    for (let i = 0; i < this.assembledBytes.length; i++) {
      const address = this.originAddress + i;
      const result = await this.mcpClient.writeMemory(address, this.assembledBytes[i], 1);
      
      if (!result.success) {
        throw new Error(`Failed to write byte ${i} at address 0x${address.toString(16)}`);
      }
      
      bytesLoaded++;
      results.push(result);
    }

    return { success: true, bytesLoaded, results };
  }

  /**
   * Load directly via debugger memory
   */
  async loadDirect() {
    // Import debugger to get memory instance
    const debuggerModule = await import('./debugger.js');
    
    if (!debuggerModule.memory) {
      throw new Error('Memory instance not available');
    }

    // Load program directly
    debuggerModule.memory.loadProgram(this.assembledBytes, this.originAddress);
    
    return { success: true, bytesLoaded: this.assembledBytes.length };
  }

  /**
   * Handle run button click - execute the loaded program
   */
  async handleRun() {
    if (!this.assembledBytes) {
      this.showStatus('No program loaded - assemble first', 'error');
      return;
    }

    try {
      this.showStatus('Running program via MCP...', 'info');

      const result = await window.cpuRun();
      
      if (result.success) {
        this.showStatus('Program execution started via MCP', 'success');
        
        // Refresh displays
        if (window.refreshMemoryDisplay) window.refreshMemoryDisplay();
        if (window.refreshDisplay) window.refreshDisplay();

        // Log to MCP
        if (window.logToMCP) {
          window.logToMCP('info', 'MCP Program execution started', {
            origin: this.originAddress,
            bytes: this.assembledBytes.length,
            viaMCP: window.mcpClient?.serverAvailable || true
          });
        }

        // Optionally get and display CPU state after run
        setTimeout(async () => {
          try {
            const state = await window.getCPUState();
            if (state.success && window.logToMCP) {
              window.logToMCP('info', `CPU State after run: PC=0x${state.data.PC?.toString(16)} A=0x${state.data.A?.toString(16)}`);
            }
          } catch (e) {
            console.warn('Could not fetch CPU state after run:', e);
          }
        }, 500);

      } else {
        throw new Error(result.error || 'Execution failed');
      }

    } catch (error) {
      console.error('MCP Run failed:', error);
      this.showStatus(`Execution failed: ${error.message}`, 'error');
      
      if (window.logToMCP) {
        window.logToMCP('error', 'MCP Program execution failed', { error: error.message });
      }
    }
  }

  /**
   * Run directly via CPU instance
   */
  async runDirect() {
    // Import debugger to get CPU instance
    const debuggerModule = await import('./debugger.js');
    
    if (!debuggerModule.cpu) {
      throw new Error('CPU instance not available');
    }

    // Set PC to origin and run
    debuggerModule.cpu.PC = this.originAddress;
    debuggerModule.cpu.run(1000); // Run up to 1000 steps
    
    return { success: true, stepsExecuted: 1000 };
  }

  /**
   * Load a sample program into the editor
   */
  async loadSampleProgram() {
    try {
      this.showStatus('Loading sample...', 'info');
      
      // Load fibonacci sample as default
      const response = await fetch('../samples/fibonacci.asm');
      if (!response.ok) {
        throw new Error('Sample file not found');
      }
      
      const sampleCode = await response.text();
      this.elements.editor.value = sampleCode;
      this.currentProgram = sampleCode;
      
      // Auto-assemble the sample
      setTimeout(() => this.handleAssemble({ auto: true }), 100);
      
      this.showStatus('Sample program loaded', 'success');
      
      if (window.logToMCP) {
        window.logToMCP('info', 'Sample program loaded', { sample: 'fibonacci.asm' });
      }
      
    } catch (error) {
      console.error('Failed to load sample:', error);
      this.showStatus(`Failed to load sample: ${error.message}`, 'error');
    }
  }

  /**
   * Handle clear button - clear editor and reset state
   */
  handleClear() {
    this.elements.editor.value = '';
    this.currentProgram = '';
    this.assembledBytes = null;
    this.elements.loadBtn.disabled = true;
    this.elements.runBtn.disabled = true;
    this.showStatus('Editor cleared', 'info');
    
    if (window.logToMCP) {
      window.logToMCP('info', 'Assembly editor cleared');
    }
  }

  /**
   * Show status message in the panel
   */
  showStatus(message, type = 'info') {
    const statusDiv = this.elements.status.querySelector('.status-message') || 
                     this.elements.status.appendChild(document.createElement('div'));
    statusDiv.className = `status-message ${type}`;
    statusDiv.textContent = message;
    
    // Auto-clear non-error messages after 5 seconds
    if (type !== 'error') {
      setTimeout(() => {
        if (statusDiv.textContent === message) {
          statusDiv.textContent = 'Ready';
          statusDiv.className = 'status-message';
        }
      }, 5000);
    }
  }

  /**
   * Show assembly preview dialog
   */
  showAssemblyPreview(bytes) {
    // Create a simple preview modal or inline display
    const preview = document.createElement('div');
    preview.style.cssText = `
      position: fixed; top: 20%; left: 20%; width: 60%; height: 40%;
      background: rgba(0,0,0,0.9); border: 2px solid #00ff00; color: #0f0;
      padding: 10px; font-family: monospace; font-size: 10px; z-index: 1000;
      overflow: auto;
    `;
    preview.innerHTML = `
      <h4>Assembly Preview (${bytes.length} bytes)</h4>
      <pre>${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ')}</pre>
      <button onclick="this.parentElement.remove()" style="float: right;">Close</button>
    `;
    document.body.appendChild(preview);
  }
}

/**
 * Initialize the assembly panel from app.js
 */
export function initializeAssemblyPanel() {
  const panelElement = document.getElementById('assembly-panel');
  if (!panelElement) {
    console.warn('Assembly panel element not found - creating dynamically');
    
    // Create panel element if it doesn't exist
    const mainLayout = document.getElementById('main-layout');
    if (mainLayout) {
      const panel = document.createElement('div');
      panel.id = 'assembly-panel';
      panel.className = 'panel';
      panel.style.cssText = 'position: absolute; top: 10%; left: 10%; width: 600px; height: 500px;';
      mainLayout.appendChild(panel);
    } else {
      console.error('Main layout not found - cannot create assembly panel');
      return null;
    }
  }

  const assemblyPanel = new AssemblyPanel();
  assemblyPanel.initialize();
  window.assemblyPanel = assemblyPanel; // Global access
  
  return assemblyPanel;
}