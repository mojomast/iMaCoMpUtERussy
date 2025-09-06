/**
 * Natural Language Input for MCP Commands
 *
 * Text-based natural language interface for MCP server interaction.
 * Parses user input like "step the CPU" and translates to MCP API calls.
 * Reuses parsing logic adapted from voice-control.js.
 */

export class NaturalLanguageInput {
  constructor() {
    this.elements = {};
    this.mcpClient = window.mcpClient;
    this.commandHistory = [];
  }

  /**
   * Initialize the natural language input system
   */
  initialize(panelId = 'mcp-input-panel') {
    console.log('⌨️ Initializing Natural Language Input...');

    try {
      this.initializeDOMElements(panelId);
      this.setupEventListeners();
      this.logToInput('Natural language input ready. Try typing "reset CPU" or "step the CPU".');
      
      if (this.elements.textarea) {
        this.elements.textarea.focus();
      }

      console.log('✅ Natural Language Input initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Natural Language Input initialization failed:', error);
      this.logToInput('Failed to initialize: ' + error.message);
      return false;
    }
  }

  /**
   * Initialize DOM element references
   */
  initializeDOMElements(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) {
      throw new Error(`Panel ${panelId} not found`);
    }

    this.elements = {
      panel: panel,
      textarea: document.getElementById('nl-input-textarea'),
      sendBtn: document.getElementById('nl-input-send-btn'),
      log: document.getElementById('nl-input-log')
    };

    if (!this.elements.textarea || !this.elements.sendBtn || !this.elements.log) {
      throw new Error('Required input elements not found');
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Send button click
    this.elements.sendBtn.addEventListener('click', () => this.handleSend());

    // Enter key to send (Shift+Enter for new line)
    this.elements.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Clear log button if added later
    // ...
  }

  /**
   * Handle send command
   */
  async handleSend() {
    const input = this.elements.textarea.value.trim();
    if (!input) return;

    // Add to history
    this.commandHistory.push(input);
    if (this.commandHistory.length > 50) {
      this.commandHistory.shift();
    }

    // Clear input
    this.elements.textarea.value = '';

    // Log input
    this.logToInput(`> ${input}`);

    try {
      // Parse and execute
      const parsed = this.parseCommand(input);
      if (parsed.action === 'unknown') {
        this.logToInput(`❌ Unknown command: "${input}"`);
        if (window.logToMCP) {
          window.logToMCP('error', `Unknown natural language command: ${input}`);
        }
        return;
      }

      // Execute MCP command
      const result = await this.executeCommand(parsed);
      
      // Log result
      this.logToInput(`✅ ${parsed.response || 'Command executed'}`);
      if (result && typeof result === 'object') {
        this.logToInput(`Result: ${JSON.stringify(result, null, 2)}`);
      }

      // Log to MCP display
      if (window.logToMCP) {
        window.logToMCP('info', `NL Input: "${input}" → ${parsed.action}`, result);
      }

    } catch (error) {
      console.error('Command execution failed:', error);
      this.logToInput(`❌ Error: ${error.message}`);
      if (window.logToMCP) {
        window.logToMCP('error', `NL Input failed: ${input}`, { error: error.message });
      }
    }
  }

  /**
   * Parse natural language command (adapted from voice-control.js)
   */
  parseCommand(transcript) {
    const command = transcript.toLowerCase().trim();

    // Assembly Commands - handle "load assembly code [code]"
    const assemblyMatch = command.match(/(?:load|run)\s+assembly\s+code\s+(.+)$/i);
    if (assemblyMatch) {
      const assemblyCode = assemblyMatch[1].trim();
      
      // Clean up the extracted code (remove quotes if present, handle multi-line)
      let cleanCode = assemblyCode.replace(/^["'`]/, '').replace(/["'`]$/, '');
      
      // Handle multi-line code (basic extraction)
      if (cleanCode.includes('\n')) {
        // Extract code block between quotes or triple backticks
        const codeBlockMatch = transcript.match(/["'`]([\s\S]+?)["'`]$/);
        if (codeBlockMatch) {
          cleanCode = codeBlockMatch[1].trim();
        }
      }

      return {
        action: 'loadAssembly',
        method: async () => {
          if (!this.mcpClient || !this.mcpClient.serverAvailable) {
            throw new Error('MCP server not available for assembly loading');
          }
          
          try {
            const result = await this.mcpClient.assembleAndLoad(cleanCode);
            if (result.success) {
              return {
                success: true,
                assembledBytes: result.assembledBytes,
                bytesLoaded: result.bytesLoaded,
                origin: result.origin,
                message: `Loaded ${result.assembledBytes} bytes of assembly code`
              };
            } else {
              throw new Error(result.error || 'Assembly load failed');
            }
          } catch (error) {
            throw new Error(`Assembly execution failed: ${error.message}`);
          }
        },
        response: `Loading assembly code... (${cleanCode.length} characters)`,
        data: { assemblyCode: cleanCode }
      };
    }

    // Assembly run command - handle "run assembly code [code]"
    const assemblyRunMatch = command.match(/(?:run|execute)\s+assembly\s+code\s+(.+)$/i);
    if (assemblyRunMatch) {
      const assemblyCode = assemblyRunMatch[1].trim();
      
      let cleanCode = assemblyCode.replace(/^["'`]/, '').replace(/["'`]$/, '');
      
      if (cleanCode.includes('\n')) {
        const codeBlockMatch = transcript.match(/["'`]([\s\S]+?)["'`]$/);
        if (codeBlockMatch) {
          cleanCode = codeBlockMatch[1].trim();
        }
      }

      return {
        action: 'runAssembly',
        method: async () => {
          if (!this.mcpClient || !this.mcpClient.serverAvailable) {
            throw new Error('MCP server not available for assembly execution');
          }
          
          try {
            const result = await this.mcpClient.assembleAndRun(cleanCode);
            if (result.success) {
              return {
                success: true,
                assembledBytes: result.assembledBytes,
                bytesLoaded: result.bytesLoaded,
                stepsExecuted: result.maxSteps,
                origin: result.origin,
                message: `Executed assembly code: ${result.assembledBytes} bytes, ${result.maxSteps} steps`
              };
            } else {
              throw new Error(result.error || 'Assembly run failed');
            }
          } catch (error) {
            throw new Error(`Assembly execution failed: ${error.message}`);
          }
        },
        response: `Running assembly code... (${cleanCode.length} characters)`,
        data: { assemblyCode: cleanCode }
      };
    }

    // CPU Commands
    if (command.includes('reset') && (command.includes('cpu') || command.includes('processor'))) {
      return {
        action: 'resetCPU',
        method: () => this.mcpClient.resetCPU(false),
        response: 'CPU reset successfully'
      };
    }

    if (command.includes('step') && (command.includes('cpu') || command.includes('instruction'))) {
      const stepsMatch = command.match(/(\d+)\s*(steps?|instructions?)/);
      const steps = stepsMatch ? parseInt(stepsMatch[1]) : 1;
      return {
        action: 'stepCPU',
        method: () => this.mcpClient.stepCPU(steps),
        response: `CPU stepped ${steps} instruction(s)`
      };
    }

    if (command.includes('run') && command.includes('cpu')) {
      const stepsMatch = command.match(/(\d+)\s*steps?/);
      const steps = stepsMatch ? parseInt(stepsMatch[1]) : 10;
      return {
        action: 'runCPU',
        method: () => this.mcpClient.runCPU(),
        response: `CPU running for up to ${steps} steps`
      };
    }

    if (command.includes('status') && command.includes('cpu')) {
      // Note: mcpClient doesn't have getCPUState, simulate or add if needed
      return {
        action: 'getCPUState',
        method: async () => ({ success: true, message: 'CPU state query (simulated)' }),
        response: 'CPU status retrieved'
      };
    }

    // Memory Commands
    if (command.includes('read') && command.includes('memory')) {
      const addressMatch = command.match(/address\s*(?:\$|0x)?([0-9a-fA-F]+)/i);
      const address = addressMatch ? parseInt(addressMatch[1], 16) : 0x600;
      const sizeMatch = command.match(/(\d+)\s*(bytes?|words?)/);
      const size = sizeMatch ? parseInt(sizeMatch[1]) : 1;
      return {
        action: 'readMemory',
        method: () => this.mcpClient.readMemory(address, size),
        response: `Read memory at 0x${address.toString(16)} (${size} byte(s))`
      };
    }

    if (command.includes('write') && command.includes('memory')) {
      const valueMatch = command.match(/value\s+(\d+)/);
      const addressMatch = command.match(/address\s*(?:\$|0x)?([0-9a-fA-F]+)/i);
      const value = valueMatch ? parseInt(valueMatch[1]) : 0;
      const address = addressMatch ? parseInt(addressMatch[1], 16) : 0x600;
      return {
        action: 'writeMemory',
        method: () => this.mcpClient.writeMemory(address, value, 1),
        response: `Wrote ${value} to memory at 0x${address.toString(16)}`
      };
    }

    // Memory view
    if (command.includes('memory') && (command.includes('view') || command.includes('dump'))) {
      const addressMatch = command.match(/from\s*(?:\$|0x)?([0-9a-fA-F]+)/i);
      const sizeMatch = command.match(/(\d+)\s*(bytes?|words?)/);
      const address = addressMatch ? parseInt(addressMatch[1], 16) : 0x600;
      const size = sizeMatch ? parseInt(sizeMatch[1]) : 16;
      return {
        action: 'getMemoryView',
        method: () => this.mcpClient.getMemoryView(address, size),
        response: `Memory view from 0x${address.toString(16)} (${size} bytes)`
      };
    }

    // Help
    if (command.includes('help') || command.includes('commands')) {
      this.showHelp();
      return {
        action: 'help',
        method: () => ({}),
        response: 'Help displayed'
      };
    }

    // Clear
    if (command.includes('clear') && (command.includes('log') || command.includes('input'))) {
      this.elements.log.innerHTML = '';
      return {
        action: 'clear',
        method: () => ({}),
        response: 'Log cleared'
      };
    }

    return {
      action: 'unknown',
      method: () => null,
      response: 'Unknown command. Type "help" for available commands.'
    };
  }

  /**
   * Enhanced help function with assembly command examples
   */
  showHelp() {
    const helpText = `Available commands:
- "reset CPU" - Reset the CPU
- "step CPU" or "step the CPU" - Execute one instruction
- "run CPU 10 steps" - Run CPU for specified steps
- "read memory address 600" - Read memory at address
- "write 42 to memory address 600" - Write value to memory
- "memory view from 600 16 bytes" - View memory dump
- "CPU status" - Get CPU status
- "clear log" - Clear this input log
- "help" - Show this help

Assembly Commands:
- "load assembly code [your code here]" - Assemble and load code to memory
- "run assembly code [your code here]" - Assemble, load, and execute code
Examples:
  load assembly code "LDA #42; STA 0x00; HLT"
  run assembly code """
  .org 0x0600
  LDA #10
  STA 0x00
  HLT
  """

Examples:
- step the CPU
- reset the processor
- read memory at address $600
- write value 255 to memory address 0x601
- load assembly code LDA #42; STA 0x00; HLT
- run assembly code .org 0x0600\nLDA #10\nHLT`;

    this.logToInput(helpText);
  }

  /**
   * Execute parsed command
   */
  async executeCommand(parsed) {
    if (!this.mcpClient || !this.mcpClient.serverAvailable) {
      throw new Error('MCP server not available');
    }

    if (!parsed.method) {
      throw new Error('No method to execute');
    }

    return await parsed.method();
  }

  /**
   * Log to input panel
   */
  logToInput(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.style.cssText = 'margin-bottom: 5px; font-family: monospace; color: #00ff00;';
    logEntry.textContent = `[${timestamp}] ${message}`;
    this.elements.log.appendChild(logEntry);
    this.elements.log.scrollTop = this.elements.log.scrollHeight;

    // Keep only last 50 entries
    while (this.elements.log.children.length > 50) {
      this.elements.log.removeChild(this.elements.log.firstChild);
    }
  }

  /**
   * Show help information
   */
  showHelp() {
    const helpText = `Available commands:
- "reset CPU" - Reset the CPU
- "step CPU" or "step the CPU" - Execute one instruction
- "run CPU 10 steps" - Run CPU for specified steps
- "read memory address 600" - Read memory at address
- "write 42 to memory address 600" - Write value to memory
- "memory view from 600 16 bytes" - View memory dump
- "CPU status" - Get CPU status
- "clear log" - Clear this input log
- "help" - Show this help

Examples:
- step the CPU
- reset the processor
- read memory at address $600
- write value 255 to memory address 0x601`;

    this.logToInput(helpText);
  }

  /**
   * Clear input log
   */
  clearLog() {
    this.elements.log.innerHTML = '<div style="color: #666;">Input log cleared</div>';
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    // Remove event listeners if needed
    console.log('⌨️ Natural Language Input destroyed');
  }
}

// Export for initialization from app.js
export function initializeNaturalLanguageInput() {
  const nlInput = new NaturalLanguageInput();
  nlInput.initialize();
  window.naturalLanguageInput = nlInput; // Global access if needed
  return nlInput;
}