/**
 * Voice Control System for iMaCoMpUtERussy Emulator
 *
 * Comprehensive voice control system that integrates with MCP server to enable
 * hands-free programming with speech recognition and synthesis.
 *
 * Features:
 * - Web Speech API for recognition and synthesis
 * - Wake word detection ('computer')
 * - MCP server integration for emulator control
 * - Visual feedback and status indicators
 * - Natural language processing for commands
 * - Real-time audio visualization
 *
 * @version 1.0.0
 * @author Kyle Durepos
 */

export class VoiceControlSystem {
  constructor() {
    // Core state
    this.recognition = null;
    this.synthesis = null;
    this.mcpClient = null;
    this.isListening = false;
    this.isActive = false;
    this.lastTranscript = '';
    this.confidence = 0;

    // Configuration
    this.config = {
      wakeWord: 'computer',
      language: 'en-US',
      continuous: true,
      interimResults: true,
      maxAlternatives: 1,
      voicePitch: 1.0,
      voiceRate: 1.0,
      volume: 1.0
    };

    // DOM elements
    this.elements = {};
  }

  /**
   * Initialize the voice control system
   */
  async initialize() {
    console.log('🎤 Initializing Voice Control System...');

    try {
      this.initializeDOMElements();
      await this.initializeSpeechRecognition();
      await this.initializeSpeechSynthesis();
      await this.initializeMCP();
      this.setupEventListeners();
      this.setupVisualIndicators();

      console.log('✅ Voice Control System initialized successfully');
      this.showCapabilities();

      return true;
    } catch (error) {
      console.error('❌ Voice Control initialization failed:', error);
      this.showError('Failed to initialize voice control: ' + error.message);
      return false;
    }
  }

  /**
   * Initialize DOM element references
   */
  initializeDOMElements() {
    this.elements = {
      panel: document.getElementById('voice-control-panel'),
      indicator: document.getElementById('voice-indicator'),
      levelBar: document.getElementById('voice-level-bar'),
      terminal: document.getElementById('voice-terminal'),
      commands: document.getElementById('voice-commands-list'),
      toggleBtn: document.getElementById('voice-toggle-btn'),
      waveform: document.getElementById('voice-waveform-canvas')
    };

    // Hide panel initially
    if (this.elements.panel) {
      this.elements.panel.classList.add('hidden');
    }
  }

  /**
   * Initialize Web Speech Recognition API
   */
  async initializeSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      throw new Error('Web Speech API not supported in this browser');
    }

    const RecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new RecognitionClass();

    // Configure recognition
    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.lang = this.config.language;
    this.recognition.maxAlternatives = this.config.maxAlternatives;

    // Event handlers
    this.recognition.onstart = () => this.onRecognitionStart();
    this.recognition.onresult = (event) => this.onRecognitionResult(event);
    this.recognition.onend = () => this.onRecognitionEnd();
    this.recognition.onerror = (event) => this.onRecognitionError(event);
    this.recognition.onaudioend = () => this.onAudioEnd();

    console.log('🎙️ Speech recognition initialized');
  }

  /**
   * Initialize Web Speech Synthesis API
   */
  async initializeSpeechSynthesis() {
    if (!('speechSynthesis' in window)) {
      throw new Error('Speech Synthesis API not supported');
    }

    this.synthesis = window.speechSynthesis;
    console.log('🔊 Speech synthesis initialized');
  }

  /**
   * Initialize MCP client for voice commands
   */
  async initializeMCP() {
    try {
      // Import MCP client dynamically
      const { MCPClient } = await import('../../lib/mcp-client.js');
      this.mcpClient = new MCPClient('http://localhost:8001');
      console.log('🔗 MCP Client initialized for voice control');
      return true;
    } catch (error) {
      console.warn('⚠️ Failed to initialize MCP client:', error);
      return false;
    }
  }

  /**
   * Show browser capabilities
   */
  showCapabilities() {
    const capabilities = {
      speechRecognition: !!('webkitSpeechRecognition' in window) || !!('SpeechRecognition' in window),
      speechSynthesis: !!('speechSynthesis' in window),
      audioContext: !!('AudioContext' in window) || !!('webkitAudioContext' in window),
      mediaDevices: !!navigator.mediaDevices
    };

    console.log('🎤 Voice Control Capabilities:', capabilities);
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    if (this.elements.toggleBtn) {
      this.elements.toggleBtn.addEventListener('click', () => this.toggleVoiceControl());
    }

    // Shortcut keys (press 'V' to toggle voice control)
    document.addEventListener('keydown', (event) => {
      if (event.key === 'V' && event.ctrlKey) {
        event.preventDefault();
        this.toggleVoiceControl();
      }
    });
  }

  /**
   * Set up visual indicators
   */
  setupVisualIndicators() {
    if (!this.elements.waveform) return;

    const canvas = this.elements.waveform;
    const ctx = canvas.getContext('2d');
    canvas.width = 280;
    canvas.height = 40;

    // Draw initial waveform
    this.drawWaveform(ctx, []);
  }

  /**
   * Toggle voice control on/off
   */
  toggleVoiceControl() {
    if (this.isActive) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  /**
   * Activate voice control
   */
  activate() {
    if (this.isActive) return;

    try {
      this.isActive = true;
      this.updatePanelVisibility();
      this.startListening();
      this.speakResponse('Voice control activated. Try saying "computer" followed by a command.');
      this.updateStatus('listening', 'Listening for wake word...');
      this.logToTerminal('Voice control activated - Listening for "computer" wake word');

      if (this.elements.toggleBtn) {
        this.elements.toggleBtn.textContent = 'Stop Voice Control';
        this.elements.toggleBtn.classList.add('active');
      }

      console.log('🎤 Voice control activated');
    } catch (error) {
      console.error('Failed to activate voice control:', error);
      this.deactivate();
    }
  }

  /**
   * Deactivate voice control
   */
  deactivate() {
    if (!this.isActive) return;

    this.isActive = false;
    this.updatePanelVisibility();
    this.stopListening();

    if (this.elements.toggleBtn) {
      this.elements.toggleBtn.textContent = 'Start Voice Control';
      this.elements.toggleBtn.classList.remove('active');
    }

    this.updateStatus('idle', 'Voice control inactive');
    this.logToTerminal('Voice control deactivated');

    console.log('🎤 Voice control deactivated');
  }

  /**
   * Start speech recognition
   */
  startListening() {
    if (this.recognition && !this.isListening) {
      this.recognition.start();
    }
  }

  /**
   * Stop speech recognition
   */
  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  /**
   * Recognition event handlers
   */
  onRecognitionStart() {
    this.isListening = true;
    console.log('🎙️ Recognition started');
  }

  onRecognitionResult(event) {
    const results = event.results;
    const result = results[results.length - 1];

    this.lastTranscript = result[0].transcript;
    this.confidence = result[0].confidence;

    // Update UI with current speech
    this.logToTerminal(`"${this.lastTranscript}" (${Math.round(this.confidence * 100)}%)`);

    // Check for wake word
    if (this.lastTranscript.toLowerCase().includes(this.config.wakeWord)) {
      this.onWakeWordDetected();
    } else if (this.elements.panel && !this.elements.panel.classList.contains('hidden')) {
      // Process as command only if already activated
      this.processCommand(this.lastTranscript);
    }
  }

  onRecognitionEnd() {
    this.isListening = false;

    // Auto-restart if still active
    if (this.isActive) {
      setTimeout(() => this.startListening(), 100);
    }
  }

  onRecognitionError(event) {
    console.error('Speech recognition error:', event.error);
    this.updateStatus('error', `Recognition error: ${event.error}`);
    this.logToTerminal(`Error: ${event.error}`);
  }

  onAudioEnd() {
    // Recognition ended naturally
  }

  /**
   * Handle wake word detection
   */
  onWakeWordDetected() {
    console.log('🔥 Wake word detected!');
    this.updateStatus('listening', 'Wake word detected - Listening for commands...');
    this.speakResponse('Yes? I\'m listening for commands.');
    this.logToTerminal('⇒ Wake word detected - Ready for commands');
  }

  /**
   * Process voice command
   */
  async processCommand(transcript) {
    const parsed = this.parseVoiceCommand(transcript);

    if (parsed.action === 'unknown') {
      this.speakResponse(parsed.response);
      return;
    }

    if (parsed.action === 'help') {
      this.speakResponse(parsed.response);
      return;
    }

    if (parsed.action === 'reset' && parsed.params?.target === 'voice') {
      this.deactivate();
      return;
    }

    // Execute MCP command
    await this.executeCommand(parsed);
  }

  /**
   * Parse voice command to MCP action
   */
  parseVoiceCommand(transcript) {
    const command = transcript.toLowerCase().trim();

    // CPU Commands
    if ((command.includes('reset') || command.includes('restart')) && command.includes('cpu')) {
      return {
        action: 'resetCPU',
        mcpMethod: 'cpu/reset',
        params: {},
        response: 'CPU has been reset successfully'
      };
    }

    if (command.includes('step') && command.includes('cpu')) {
      return {
        action: 'stepCPU',
        mcpMethod: 'cpu/step',
        params: { timeout: 1000 },
        response: 'CPU stepped one instruction'
      };
    }

    if (command.includes('run cpu')) {
      // Extract number of steps
      const stepsMatch = command.match(/(\d+)\s*steps?/);
      const steps = stepsMatch ? parseInt(stepsMatch[1]) : 10;

      return {
        action: 'runCPU',
        mcpMethod: 'cpu/run',
        params: { maxSteps: steps },
        response: `CPU running ${steps} steps`
      };
    }

    if (command.includes('cpu status') || command.includes('cpu state')) {
      return {
        action: 'getCPUState',
        mcpMethod: 'cpu/state',
        params: {},
        response: 'Retrieving CPU status'
      };
    }

    // Memory Commands
    if (command.includes('read memory')) {
      // Try to extract address
      const addressMatch = command.match(/address\s*(?:\$|0x)?([0-9a-f]+)/i);
      const address = addressMatch ? parseInt(addressMatch[1], 16) : 0x600;

      return {
        action: 'readMemory',
        mcpMethod: 'memory/read',
        params: { address, bytes: 1 },
        response: `Reading memory at address 0x${address.toString(16)}`
      };
    }

    if (command.includes('write') && command.includes('memory')) {
      // Extract value and address
      const valueMatch = command.match(/write\s+(\d+).*address\s*(?:\$|0x)?([0-9a-f]+)/i);
      let value = 0, address = 0x600;

      if (valueMatch) {
        value = parseInt(valueMatch[1]);
        address = parseInt(valueMatch[2], 16);
      }

      return {
        action: 'writeMemory',
        mcpMethod: 'memory/write',
        params: { address, value, bytes: 1 },
        response: `Writing ${value} to address 0x${address.toString(16)}`
      };
    }

    // Assembly Commands
    if (command.includes('compile') || command.includes('assemble')) {
      return {
        action: 'assemble',
        mcpMethod: 'assemble/source',
        params: { sourceCode: this.getCodeFromEditor() },
        response: 'Assembling code...'
      };
    }

    if (command.includes('load') && command.includes('sample')) {
      // Extract sample name
      const sampleNames = ['fibonacci', 'hello-terminal', 'echo', 'graphics-demo', 'video-demo'];
      let sample = sampleNames[0]; // default

      for (const sampleName of sampleNames) {
        if (command.includes(sampleName)) {
          sample = sampleName;
          break;
        }
      }

      return {
        action: 'loadProgram',
        mcpMethod: 'programs/load',
        params: { name: sample },
        response: `Loading ${sample} program`
      };
    }

    if (command.includes('generate') && command.includes('code')) {
      // Extract description from command
      const descriptionMatch = command.match(/generation.*code.*to\s+(.+?)(?:\s|$)/i);
      const description = descriptionMatch ? descriptionMatch[1] : 'simple program';

      return {
        action: 'generateAssembly',
        mcpMethod: 'cpu/generateAndRun',
        params: { specification: description, maxSteps: 10 },
        response: `Generating code to ${description}`
      };
    }

    if (command.includes('list') && command.includes('program')) {
      return {
        action: 'listPrograms',
        mcpMethod: 'programs/list',
        params: {},
        response: 'Listing available programs'
      };
    }

    if (command.includes('debug')) {
      return {
        action: 'traceExecution',
        mcpMethod: 'debug/trace',
        params: { steps: 10 },
        response: 'Starting execution trace'
      };
    }

    if (command.includes('memory dump')) {
      return {
        action: 'inspectMemory',
        mcpMethod: 'debug/memoryView',
        params: { address: 0x600, size: 256 },
        response: 'Inspecting memory region'
      };
    }

    if (command.includes('clear terminal') || command.includes('clear screen')) {
      return {
        action: 'clearTerminal',
        mcpMethod: 'terminal/clear',
        params: {},
        response: 'Terminal cleared'
      };
    }

    if (command.includes('update display')) {
      return {
        action: 'updateVideoDisplay',
        mcpMethod: 'video/update',
        params: {},
        response: 'Video display updated'
      };
    }

    if (command.includes('set pixel')) {
      // Extract coordinates and color
      const pixelMatch = command.match(/set pixel\s+(\d+)\s+(\d+)\s+(?:to\s+)?(\d+)/i);
      if (pixelMatch) {
        const x = parseInt(pixelMatch[1]);
        const y = parseInt(pixelMatch[2]);
        const color = parseInt(pixelMatch[3]);

        return {
          action: 'setPixel',
          mcpMethod: 'video/setPixel',
          params: { x, y, color },
          response: `Setting pixel at (${x}, ${y}) to color ${color}`
        };
      }
    }

    // Voice control commands
    if (command.includes('stop') && command.includes('voice')) {
      return {
        action: 'reset',
        params: { target: 'voice' },
        response: 'Voice control stopped'
      };
    }

    // Help commands
    if (command.includes('help') || command.includes('commands')) {
      this.showVoiceHelp();
      return {
        action: 'help',
        response: 'Showing available voice commands'
      };
    }

    return {
      action: 'unknown',
      response: `I didn't understand: "${command}". Try saying "help" for available commands.`
    };
  }

  /**
   * Get code from editor (placeholder - integrate with actual editor)
   */
  getCodeFromEditor() {
    // For now, return a simple default program
    return `.org $0600
LDA #$42
STA $00
HLT`;
  }

  /**
   * Execute MCP action based on voice command
   */
  async executeCommand(parsedCommand) {
    if (!parsedCommand || !parsedCommand.action) return;

    if (!this.mcpClient) {
      this.speakResponse('MCP server not available');
      this.updateStatus('error', 'MCP Server Not Connected');
      return;
    }

    try {
      this.updateStatus('processing', 'Executing Command...');

      let result;

      // Execute the appropriate MCP method
      switch (parsedCommand.action) {
        case 'resetCPU':
          result = await this.mcpClient.resetCPU();
          break;
        case 'stepCPU':
          result = await this.mcpClient.stepCPU(parsedCommand.params.timeout);
          break;
        case 'runCPU':
          result = await this.mcpClient.runCPU(parsedCommand.params.maxSteps);
          break;
        case 'getCPUState':
          result = await this.mcpClient.getCPUState();
          break;
        case 'readMemory':
          result = await this.mcpClient.readMemory(
            parsedCommand.params.address,
            parsedCommand.params.bytes
          );
          break;
        case 'writeMemory':
          result = await this.mcpClient.writeMemory(
            parsedCommand.params.address,
            parsedCommand.params.value,
            parsedCommand.params.bytes
          );
          break;
        case 'assemble':
          result = await this.mcpClient.assemble(parsedCommand.params.sourceCode);
          break;
        case 'loadProgram':
          result = await this.mcpClient.loadProgram(parsedCommand.params.name);
          if (result && result.bytecode) {
            await this.mcpClient.loadProgramToMemory(result.bytecode);
          }
          break;
        case 'generateAssembly':
          result = await this.mcpClient.assembleAndRun(
            parsedCommand.params.specification,
            parsedCommand.params
          );
          break;
        case 'listPrograms':
          result = await this.mcpClient.listPrograms();
          break;
        case 'traceExecution':
          result = await this.mcpClient.traceExecution(parsedCommand.params.steps);
          break;
        case 'inspectMemory':
          result = await this.mcpClient.inspectMemory(
            parsedCommand.params.address,
            parsedCommand.params.size
          );
          break;
        case 'clearTerminal':
          result = await this.mcpClient.clearTerminal();
          break;
        case 'updateVideoDisplay':
          result = await this.mcpClient.updateVideoDisplay();
          break;
        case 'setPixel':
          result = await this.mcpClient.setPixel(
            parsedCommand.params.x,
            parsedCommand.params.y,
            parsedCommand.params.color
          );
          break;
        default:
          this.speakResponse('Command not implemented');
          this.updateStatus('idle', 'Ready');
          return;
      }

      this.updateStatus('listening', 'Ready');
      this.speakResponse(`${parsedCommand.response}`);

      // Log command to MCP console
      this.logToMCPConsole(
        'voice_command',
        `🎤 Voice: "${this.lastTranscript}" → ${parsedCommand.action}`,
        { result: result ? result.slice(0, 100) + (result.length > 100 ? '...' : '') : 'N/A' }
      );

      // Log result to console
      if (result && typeof result === 'object') {
        console.log(`Voice command result (${parsedCommand.action}):`, result);
        if (typeof logToConsole === 'function') {
          logToConsole(`Voice command executed: ${parsedCommand.action}`, 'info');
        }
      }

    } catch (error) {
      console.error('Voice command error:', error);
      this.speakResponse(`Error executing command: ${error.message}`);
      this.updateStatus('error', 'Command Failed');

      this.logToMCPConsole(
        'voice_error',
        `❌ Voice command failed: ${parsedCommand.action}`,
        { error: error.message }
      );
    }
  }

  /**
   * Speak response using speech synthesis
   */
  speakResponse(text, context = 'response') {
    if (!this.synthesis) return;

    // Cancel any ongoing speech
    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Configure voice settings based on context
    switch (context) {
      case 'error':
        utterance.pitch = 0.7;
        utterance.rate = 0.9;
        break;
      case 'success':
        utterance.pitch = 1.2;
        utterance.rate = 1.1;
        break;
      case 'help':
        utterance.pitch = 1.1;
        utterance.rate = 0.95;
        break;
      default:
        utterance.pitch = this.config.voicePitch;
        utterance.rate = this.config.voiceRate;
    }

    utterance.volume = this.config.volume;
    utterance.lang = this.config.language;

    // Set up event handlers
    utterance.onstart = () => this.updateStatus('speaking', 'Speaking...');
    utterance.onend = () => {
      if (this.isActive) {
        this.updateStatus('listening', 'Listening...');
      } else {
        this.updateStatus('idle', 'Ready');
      }
    };

    // Start speech
    this.synthesis.speak(utterance);
  }

  /**
   * Show voice help UI
   */
  showVoiceHelp() {
    const helpHtml = `
<div style="font-family: 'Courier New', monospace; background: rgba(0, 0, 0, 0.9); border: 1px solid #00ff00; padding: 10px; border-radius: 5px; color: #00ff00; max-width: 400px;">
<h3 style="color: #ffff00;">🎤 Voice Commands Available:</h3>
<h4>CPU Commands:</h4>
- "reset CPU" - Reset processor<br>
- "step CPU" - Execute one instruction<br>
- "run CPU" - Execute multiple instructions<br>
- "CPU status" - Get current CPU state<br>

<h4>Memory Commands:</h4>
- "read memory at address FFF" - Read memory location<br>
- "write 42 to memory address 600" - Write to memory<br>

<h4>Assembly Commands:</h4>
- "compile code" - Assemble current code<br>
- "load fibonacci program" - Load sample program<br>
- "generate code to add two numbers" - AI code generation<br>

<h4>Debug Commands:</h4>
- "start trace CPU" - Trace execution<br>
- "memory dump" - View memory contents<br>

<h4>Other Commands:</h4>
- "clear terminal" - Clear terminal output<br>
- "update display" - Refresh video display<br>
- "stop voice control" - Stop voice commands<br>
- "help" - Show this help<br>
</div>
`;

    // Create overlay element for help
    const helpOverlay = document.createElement('div');
    helpOverlay.id = 'voice-help-overlay';
    helpOverlay.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10000;
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #00ff00;
      border-radius: 10px;
      padding: 0;
      max-width: 500px;
      box-shadow: 0 0 30px rgba(0, 255, 0, 0.5);
    `;

    helpOverlay.innerHTML = helpHtml;

    // Add close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
    closeButton.style.cssText = `
      position: absolute;
      top: 5px;
      right: 5px;
      background: #ff0000;
      color: white;
      border: none;
      border-radius: 50%;
      width: 25px;
      height: 25px;
      cursor: pointer;
      font-size: 12px;
    `;
    closeButton.onclick = () => document.body.removeChild(helpOverlay);
    helpOverlay.appendChild(closeButton);

    document.body.appendChild(helpOverlay);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (document.body.contains(helpOverlay)) {
        document.body.removeChild(helpOverlay);
      }
    }, 10000);

    this.speakResponse('Voice commands help displayed. Available commands include reset CPU, step CPU, run CPU, memory operations, assemble code, and load programs.');
  }

  /**
   * Update UI status
   */
  updateStatus(state, text) {
    if (!this.elements.indicator) return;

    // Update status indicator
    this.elements.indicator.className = `voice-indicator ${state}`;
    this.elements.indicator.textContent = text;

    console.log(`🎤 Voice status: ${state} - ${text}`);
  }

  /**
   * Update panel visibility
   */
  updatePanelVisibility() {
    if (!this.elements.panel) return;

    if (this.isActive) {
      this.elements.panel.classList.remove('hidden');
    } else {
      this.elements.panel.classList.add('hidden');
    }
  }

  /**
   * Log message to voice terminal
   */
  logToTerminal(message) {
    if (!this.elements.terminal) return;

    const timestamp = new Date().toLocaleTimeString();
    this.elements.terminal.textContent += `${timestamp}: ${message}\n`;

    // Auto-scroll to bottom
    this.elements.terminal.scrollTop = this.elements.terminal.scrollHeight;
  }

  /**
   * Log voice command to MCP console
   */
  logToMCPConsole(level, message, data = null) {
    if (window.logToMCP) {
      window.logToMCP(level, message, data);
    }
  }

  /**
   * Draw audio waveform visualization
   */
  drawWaveform(ctx, audioData) {
    const { width, height } = ctx.canvas;

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Draw waveform
    if (audioData.length > 0) {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.beginPath();

      const sliceWidth = width / audioData.length;
      let x = 0;

      for (let i = 0; i < audioData.length; i++) {
        const v = audioData[i] / 128.0;
        const y = v * height / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.stroke();
    } else {
      // Draw placeholder waveform
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      for (let x = 0; x < width; x += 10) {
        const y = height / 2 + Math.sin(x * 0.1) * 10;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    this.updateStatus('error', message);
    this.logToTerminal(`ERROR: ${message}`);
    console.error('Voice Control Error:', message);
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.deactivate();

    if (this.synthesis) {
      this.synthesis.cancel();
    }

    // Remove event listeners
    document.removeEventListener('keydown', this.handleKeyDown);

    console.log('🎤 Voice control system destroyed');
  }
}

export default VoiceControlSystem;