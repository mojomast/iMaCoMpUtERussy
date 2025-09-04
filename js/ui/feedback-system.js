/**
 * UIFeedbackSystem - Bridges frontend UI states with backend emulator states
 * Implements feedback mechanisms for modern responsive emulator dashboard
 */

export class UIFeedbackSystem {
    constructor() {
        this.lastState = null;
        this.animationQueue = [];
        this.isAnimating = false;
    }

    /**
     * Update CPU state and trigger UI feedback
     * @param {Object} state - CPU state object with registers, memory, execution info
     */
    updateCPUState(state) {
        if (!this.lastState) {
            this.lastState = { ...state };
        }

        // Update register visualizations
        this.animateRegisterChanges(state);

        // Update memory visualization
        this.updateMemoryVisualization(state.memory);

        // Show execution trace/feedback
        this.showExecutionTrace(state.lastInstruction);

        // Store state for next comparison
        this.lastState = { ...state };
    }

    /**
     * Animate changes in CPU registers
     * @param {Object} currentState - Current CPU state
     */
    animateRegisterChanges(currentState) {
        const registerElements = document.querySelectorAll('.register-value');

        registerElements.forEach(element => {
            if (element.dataset.register === 'PC' &&
                this.lastState.PC !== currentState.PC) {
                this.highlightElement(element, 'pc-change');
            } else if (element.dataset.register === 'A' &&
                this.lastState.A !== currentState.A) {
                this.highlightElement(element, 'register-change');
            } else if (element.dataset.register === 'X' &&
                this.lastState.X !== currentState.X) {
                this.highlightElement(element, 'register-change');
            } else if (element.dataset.register === 'Y' &&
                this.lastState.Y !== currentState.Y) {
                this.highlightElement(element, 'register-change');
            } else if (element.dataset.register === 'SP' &&
                this.lastState.SP !== currentState.SP) {
                this.highlightElement(element, 'stack-change');
            } else if (element.dataset.register === 'P' &&
                this.lastState.P !== currentState.P) {
                this.highlightElement(element, 'flags-change');
            }
        });
    }

    /**
     * Update memory visualization with feedback
     * @param {Object} memoryState - Memory state information
     */
    updateMemoryVisualization(memoryState) {
        // Highlight recently modified memory locations in memory viewer
        if (memoryState && memoryState.lastModified) {
            memoryState.lastModified.forEach(address => {
                const memoryCell = document.querySelector(
                    `.memory-cell[data-address="${address.toString(16)}"]`
                );
                if (memoryCell) {
                    this.highlightElement(memoryCell, 'memory-modified');
                }
            });
        }

        // Update stack visualization
        this.updateStackVisualization(memoryState);

        // Update video buffer visualization
        this.updateVideoBufferVisualization(memoryState);
    }

    /**
     * Show execution trace and current instruction feedback
     * @param {Object} lastInstruction - Last executed instruction details
     */
    showExecutionTrace(lastInstruction) {
        if (!lastInstruction) return;

        // Highlight currently executing instruction
        const instructionElement = document.querySelector(
            `.instruction-line[data-address="${lastInstruction.address?.toString(16)}"]`
        );
        if (instructionElement) {
            this.highlightElement(instructionElement, 'current-instruction');
        }

        // Show execution timing/progress
        this.showExecutionProgress(lastInstruction);

        // Update instruction trace history
        this.updateInstructionHistory(lastInstruction);
    }

    /**
     * Show execution progress and timing information
     * @param {Object} instruction - Current instruction details
     */
    showExecutionProgress(instruction) {
        // Update instruction counter
        const counterElement = document.getElementById('instruction-counter');
        if (counterElement) {
            counterElement.textContent = (parseInt(counterElement.textContent) || 0) + 1;
        }

        // Show cycle timing
        const timingElement = document.getElementById('cycle-timing');
        if (timingElement && instruction.cycles) {
            timingElement.textContent = `${instruction.cycles} cycles`;
            this.pulseElement(timingElement, 'timing-pulse');
        }

        // Highlight affected memory locations
        if (instruction.affectedMemory) {
            instruction.affectedMemory.forEach(address => {
                const memElement = document.querySelector(
                    `.memory-location[data-address="${address}"]`
                );
                if (memElement) {
                    this.highlightElement(memElement, 'memory-affected');
                }
            });
        }
    }

    /**
     * Update stack visualization
     * @param {Object} memoryState - Memory state
     */
    updateStackVisualization(memoryState) {
        // Implement stack pointer visual feedback
        // This is a placeholder for stack visualization logic
    }

    /**
     * Update video buffer visualization
     * @param {Object} memoryState - Memory state
     */
    updateVideoBufferVisualization(memoryState) {
        // Implement video buffer sync feedback
        // This is a placeholder for video buffer visualization logic
    }

    /**
     * Update instruction history display
     * @param {Object} instruction - Current instruction
     */
    updateInstructionHistory(instruction) {
        const historyElement = document.getElementById('instruction-history');
        if (historyElement) {
            const instructionText = `${instruction.opcode} ${instruction.operands?.join(' ') || ''}`;
            const listItem = document.createElement('li');
            listItem.className = 'history-item';
            listItem.textContent = instructionText;
            historyElement.appendChild(listItem);

            // Keep only last 10 instructions
            while (historyElement.children.length > 10) {
                historyElement.removeChild(historyElement.firstChild);
            }
        }
    }

    /**
     * Highlight an element with animation style
     * @param {HTMLElement} element - Element to highlight
     * @param {string} highlightClass - CSS class for highlight
     */
    highlightElement(element, highlightClass) {
        element.classList.add(highlightClass);

        // Remove highlight after animation completes
        setTimeout(() => {
            element.classList.remove(highlightClass);
        }, 1000);
    }

    /**
     * Pulse animation for timing updates
     * @param {HTMLElement} element - Element to pulse
     * @param {string} pulseClass - CSS class for pulse
     */
    pulseElement(element, pulseClass) {
        element.classList.add(pulseClass);

        setTimeout(() => {
            element.classList.remove(pulseClass);
        }, 200);
    }

    /**
     * Reset all UI feedback states
     */
    reset() {
        // Clear all highlighted elements
        const highlightedElements = document.querySelectorAll(
            '.register-change, .memory-modified, .current-instruction, ' +
            '.memory-affected, .pc-change, .stack-change, .flags-change, ' +
            '.timing-pulse'
        );

        highlightedElements.forEach(element => {
            element.classList.remove(
                'register-change', 'memory-modified', 'current-instruction',
                'memory-affected', 'pc-change', 'stack-change', 'flags-change',
                'timing-pulse'
            );
        });

        // Reset instruction counter
        const counterElement = document.getElementById('instruction-counter');
        if (counterElement) {
            counterElement.textContent = '0';
        }

        // Clear instruction history
        const historyElement = document.getElementById('instruction-history');
        if (historyElement) {
            historyElement.innerHTML = '';
        }

        this.lastState = null;
    }
}