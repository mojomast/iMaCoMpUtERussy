// Console/Terminal UI for iMaCoMpUtERussy Emulator
// Handles I/O operations and keyboard input integration

import { iMaCoMpUtERussyMemory } from '../memory.js';

/**
 * Console UI class for terminal emulation
 */
export class ConsoleUI {
    constructor() {
        this.memory = null;
        this.outputElement = null;
        this.inputElement = null;
        this.sendButton = null;
        this.ioAddress = 0x0600; // Default I/O address for input/output
    }

    /**
     * Initialize console UI
     * @param {string} rootElementId - ID of root element for console UI
     */
    initialize(rootElementId) {
        const rootElement = document.getElementById(rootElementId);
        if (!rootElement) {
            console.warn(`Console root element '${rootElementId}' not found`);
            return;
        }

        // Import memory from debugger if available
        import('./debugger.js').then(debuggerModule => {
            if (debuggerModule.memory) {
                this.memory = debuggerModule.memory;
                console.log('Console connected to memory instance');
            }
        }).catch(err => {
            console.warn('Could not connect console to memory:', err);
        });

        // Create console content
        rootElement.innerHTML = `
            <div class="console-header">
                <span>Terminal I/O</span>
            </div>
            <div class="console-content">
                <div id="console-output" class="console-output" style="height: 200px; overflow-y: auto; background: #000; color: #00ff00; padding: 10px; font-family: monospace; border: 1px solid #00ff00; margin-bottom: 10px;"></div>
                <div class="console-input-section">
                    <input type="text" id="console-input" placeholder="Enter input (press Enter to send)" style="width: 70%; padding: 5px; background: #333; color: #00ff00; border: 1px solid #00ff00;">
                    <button id="console-send-btn" style="padding: 5px 10px; background: #00ff00; color: #000; border: none; cursor: pointer; margin-left: 5px;">Send</button>
                    <label style="margin-left: 10px;">
                        I/O Addr: <input type="text" id="io-address-input" value="0x0600" size="6" style="width: 60px; padding: 2px; background: #333; color: #00ff00; border: 1px solid #00ff00;">
                    </label>
                </div>
            </div>
        `;

        // Get elements
        this.outputElement = rootElement.querySelector('#console-output');
        this.inputElement = rootElement.querySelector('#console-input');
        this.sendButton = rootElement.querySelector('#console-send-btn');
        const ioAddressInput = rootElement.querySelector('#io-address-input');

        // Event listeners
        if (this.sendButton) {
            this.sendButton.addEventListener('click', () => this.handleSend());
        }
        if (this.inputElement) {
            this.inputElement.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSend();
                }
            });
        }
        if (ioAddressInput) {
            ioAddressInput.addEventListener('change', (e) => {
                this.ioAddress = parseInt(e.target.value, 16);
                console.log(`I/O address set to 0x${this.ioAddress.toString(16).toUpperCase()}`);
            });
        }

        // Initial output
        this.writeOutput('Terminal ready. Connected to memory I/O at 0x0600.\n');
        console.log('Console UI initialized');
    }

    /**
     * Write output to console
     * @param {string} text - Text to write
     */
    writeOutput(text) {
        if (this.outputElement) {
            this.outputElement.innerHTML += text.replace(/\n/g, '<br>');
            this.outputElement.scrollTop = this.outputElement.scrollHeight;
        }
        console.log('Console output:', text.trim());
    }

    /**
     * Handle send input to memory
     */
    handleSend() {
        if (!this.inputElement || !this.memory) return;

        const inputText = this.inputElement.value;
        if (!inputText.trim()) return;

        // Write each character as ASCII byte to memory starting at ioAddress
        for (let i = 0; i < inputText.length; i++) {
            const charCode = inputText.charCodeAt(i);
            this.memory.writeByte(this.ioAddress + i, charCode & 0xFF);
        }
        // Null terminate
        this.memory.writeByte(this.ioAddress + inputText.length, 0);

        this.writeOutput(`> ${inputText}\n`);
        this.inputElement.value = '';
        console.log(`Input sent to memory at 0x${this.ioAddress.toString(16).toUpperCase()}: "${inputText}"`);
    }

    /**
     * Clear console output
     */
    clear() {
        if (this.outputElement) {
            this.outputElement.innerHTML = '';
        }
    }
}

// Global console instance
window.consoleUI = new ConsoleUI();

// Export for app.js initialization
export { ConsoleUI, window as consoleUI };