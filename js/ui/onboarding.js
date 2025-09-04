/**
 * OnboardingSystem - Interactive tutorial for new users
 * Guides users through their first assembly program with contextual help
 */

export class OnboardingSystem {
    constructor() {
        this.currentStep = 0;
        this.tutorialSteps = [
            {
                title: "Welcome to iMaCoMpUtERussy",
                content: "Let's begin the journey of learning 6502 assembly! We'll build a hello world program together.",
                target: null, // Global overlay
                action: null
            },
            {
                title: "Step 1: Load the Hello World Sample",
                content: "First, let's load a simple assembly program. Use the sample selector to choose 'Hello World'. This will demonstrate basic LDA (LoaD Accumulator) and STA (STore Accumulator) instructions.",
                target: "#sample-select",
                action: "Select 'Hello World' sample",
                verify: () => this.checkSampleLoaded("hello-world")
            },
            {
                title: "Step 2: Understand the Registers",
                content: "Look at the Registers panel. The Program Counter (PC) shows the current instruction address. The Accumulator (A) is the main working register where we'll store values. These display in real-time as your program executes.",
                target: ".panel:has(span:contains('Registers'))",
                action: null,
                tooltip: "Hover over individual registers for more details"
            },
            {
                title: "Step 3: Load Sample Program",
                content: "Click the 'Load Sample' button to assemble and load the hello world program into memory.",
                target: "#load-sample-btn",
                action: "Click 'Load Sample'",
                verify: () => this.checkProgramLoaded()
            },
            {
                title: "Step 4: Run the Program Step-by-Step",
                content: "Use the 'Step' button to execute one instruction at a time. Watch how the registers change! The Program Counter advances and the Accumulator loads the value 10.",
                target: "#step-btn",
                action: "Click 'Step' to execute LDA instruction",
                verify: () => this.checkLDAExecuted()
            },
            {
                title: "Step 5: Memory Viewer",
                content: "The Memory Viewer shows program data and runtime memory. Notice how address $00 gets updated when our program stores the value 10. This is the video buffer area that controls the display.",
                target: "#memory-display",
                action: null,
                tooltip: "Memory locations highlight when modified"
            },
            {
                title: "Step 6: Watch the Video Display",
                content: "When the program runs, you'll see a pixel appear on the Video Display. This demonstrates how programs can directly control hardware output in assembly!",
                target: "#video-canvas",
                action: null
            },
            {
                title: "Step 7: Interactive Terminal",
                content: "Type messages in the terminal below to communicate with your program. This is how you can test I/O functionality.",
                target: "#terminal-input",
                action: "Try typing 'Hello Assembly!' and press Send"
            },
            {
                title: "Final Step: Save Your Workspace",
                content: "Your progress and workspace state are automatically saved. Next time you visit, you can continue where you left off. Try running the full program with the 'Run' button!",
                target: "#run-btn",
                action: null
            }
        ];
        this.isActive = false;
        this.helpActive = false;
        this.overlay = null;
        this.tooltips = [];
    }

    initialize() {
        this.createTutorialOverlay();
        this.setupHelpTooltips();
        this.loadSavedProgress();

        // Add tutorial trigger button
        this.addTutorialButton();

        console.log('Onboarding system initialized');
    }

    createTutorialOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'tutorial-overlay';
        overlay.innerHTML = `
            <div class="tutorial-modal">
                <div class="tutorial-header">
                    <h2 id="tutorial-title"></h2>
                    <button id="tutorial-close-btn">&times;</button>
                </div>
                <div class="tutorial-content">
                    <p id="tutorial-text"></p>
                </div>
                <div class="tutorial-actions">
                    <button id="tutorial-prev-btn" disabled>Previous</button>
                    <button id="tutorial-next-btn">Next</button>
                    <button id="tutorial-skip-btn">Skip Tutorial</button>
                </div>
                <div class="tutorial-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" id="tutorial-progress-fill"></div>
                    </div>
                    <span id="tutorial-step-counter">1 / ${this.tutorialSteps.length}</span>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        this.overlay = overlay;

        this.setupTutorialEventListeners();
    }

    setupTutorialEventListeners() {
        const overlay = this.overlay;

        // Close button
        overlay.querySelector('#tutorial-close-btn').addEventListener('click', () => {
            this.closeTutorial();
        });

        // Navigation buttons
        overlay.querySelector('#tutorial-prev-btn').addEventListener('click', () => {
            this.goToStep(this.currentStep - 1);
        });

        overlay.querySelector('#tutorial-next-btn').addEventListener('click', () => {
            if (this.currentStep < this.tutorialSteps.length - 1) {
                this.goToStep(this.currentStep + 1);
            } else {
                this.completeTutorial();
            }
        });

        // Skip button
        overlay.querySelector('#tutorial-skip-btn').addEventListener('click', () => {
            this.skipTutorial();
        });

        // Click outside to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                // Don't close on overlay click during tutorial
            }
        });
    }

    addTutorialButton() {
        const controls = document.querySelector('.controls');
        if (!controls) return;

        const tutorialBtn = document.createElement('button');
        tutorialBtn.id = 'tutorial-launch-btn';
        tutorialBtn.textContent = '📚 Tutorial';
        tutorialBtn.title = 'Start interactive tutorial';

        controls.insertBefore(tutorialBtn, controls.firstElementChild);

        tutorialBtn.addEventListener('click', () => {
            this.startTutorial();
        });
    }

    startTutorial() {
        this.isActive = true;
        this.currentStep = 0;
        this.overlay.style.display = 'flex';
        this.goToStep(0);

        // Save progress
        this.saveProgress();
    }

    goToStep(stepIndex) {
        this.currentStep = stepIndex;
        const step = this.tutorialSteps[stepIndex];

        // Update content
        this.overlay.querySelector('#tutorial-title').textContent = step.title;
        this.overlay.querySelector('#tutorial-text').textContent = step.content;

        // Update step counter
        const counter = this.overlay.querySelector('#tutorial-step-counter');
        counter.textContent = `${stepIndex + 1} / ${this.tutorialSteps.length}`;

        // Update progress bar
        const progressFill = this.overlay.querySelector('#tutorial-progress-fill');
        const progressPercent = ((stepIndex + 1) / this.tutorialSteps.length) * 100;
        progressFill.style.width = `${progressPercent}%`;

        // Update navigation buttons
        const prevBtn = this.overlay.querySelector('#tutorial-prev-btn');
        const nextBtn = this.overlay.querySelector('#tutorial-next-btn');

        prevBtn.disabled = stepIndex === 0;
        nextBtn.textContent = stepIndex === this.tutorialSteps.length - 1 ? 'Finish' : 'Next';

        // Highlight target element
        this.highlightTargetElement(step.target);

        // Check if step needs verification
        if (step.verify) {
            this.monitorStepProgress(step);
        }
    }

    highlightTargetElement(selector) {
        // Remove previous highlights
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight');
        });

        if (!selector) return;

        try {
            const element = document.querySelector(selector);
            if (element) {
                element.classList.add('tutorial-highlight');
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } catch (error) {
            console.warn('Invalid selector:', selector);
        }
    }

    monitorStepProgress(step) {
        const checkAction = () => {
            if (step.verify && step.verify()) {
                // Auto-advance or enable next
                const nextBtn = this.overlay.querySelector('#tutorial-next-btn');
                if (!nextBtn.disabled) return; // Already enabled

                nextBtn.disabled = false;
                nextBtn.textContent = '✓ Next';
            }
        };

        // Check immediately and then periodically
        setTimeout(checkAction, 100);
        const interval = setInterval(checkAction, 500);

        // Clear interval when moving to next step
        setTimeout(() => clearInterval(interval), 20000); // Max 20 seconds
    }

    setupHelpTooltips() {
        const helpElements = [
            {
                selector: '#registers',
                content: 'Shows current CPU register values. PC (Program Counter), A (Accumulator), X/Y (Index registers), SP (Stack Pointer), P (Processor flags).',
                position: 'right'
            },
            {
                selector: '#memory-display',
                content: 'Displays memory contents showing your program code (top) and data/VRAM (bottom). Modified locations highlight in yellow.',
                position: 'top'
            },
            {
                selector: '#video-canvas',
                content: 'Visual output buffer. Your programs can write pixels here to display graphics directly.',
                position: 'left'
            },
            {
                selector: '#terminal-display',
                content: 'Interactive terminal for I/O. Type commands and see program output here.',
                position: 'top'
            },
            {
                selector: '#step-btn',
                content: 'Execute one assembly instruction at a time. Watch registers and memory change!',
                position: 'bottom'
            },
            {
                selector: '#run-btn',
                content: 'Run the full program continuously until HLT or reset.',
                position: 'bottom'
            },
            {
                selector: '#reset-btn',
                content: 'Reset CPU state and clear memory back to initial conditions.',
                position: 'bottom'
            },
            {
                selector: '#load-sample-btn',
                content: 'Load and assemble a sample program into memory.',
                position: 'bottom'
            }
        ];

        helpElements.forEach(config => {
            const element = document.querySelector(config.selector);
            if (element) {
                this.createTooltip(element, config.content, config.position);
            }
        });

        // Help button to toggle help tooltips
        const helpBtn = document.createElement('button');
        helpBtn.id = 'help-toggle-btn';
        helpBtn.textContent = '❓ Help';
        helpBtn.title = 'Toggle contextual help tooltips';

        const controls = document.querySelector('.controls');
        if (controls) {
            controls.insertBefore(helpBtn, controls.firstElementChild.nextSibling);

            helpBtn.addEventListener('click', () => {
                this.toggleHelp();
            });
        }
    }

    createTooltip(element, content, position = 'top') {
        const tooltip = document.createElement('div');
        tooltip.className = `help-tooltip tooltip-${position}`;
        tooltip.innerHTML = `
            <div class="tooltip-content">${content}</div>
            <div class="tooltip-arrow"></div>
        `;

        element.addEventListener('mouseenter', () => {
            if (this.helpActive) {
                document.body.appendChild(tooltip);
                this.positionTooltip(tooltip, element, position);
            }
        });

        element.addEventListener('mouseleave', () => {
            if (document.body.contains(tooltip)) {
                document.body.removeChild(tooltip);
            }
        });

        this.tooltips.push(tooltip);
    }

    positionTooltip(tooltip, target, position) {
        const rect = target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        let top, left;

        switch (position) {
            case 'top':
                top = rect.top - tooltip.offsetHeight - 10;
                left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2);
                break;
            case 'bottom':
                top = rect.bottom + 10;
                left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2);
                break;
            case 'left':
                top = rect.top + (rect.height / 2) - (tooltip.offsetHeight / 2);
                left = rect.left - tooltip.offsetWidth - 10;
                break;
            case 'right':
                top = rect.top + (rect.height / 2) - (tooltip.offsetHeight / 2);
                left = rect.right + 10;
                break;
        }

        // Keep tooltip within viewport
        if (left < 10) left = 10;
        if (top < 10) top = 10;
        if (left + tooltip.offsetWidth > window.innerWidth - 10) {
            left = window.innerWidth - tooltip.offsetWidth - 10;
        }
        if (top + tooltip.offsetHeight > window.innerHeight - 10) {
            top = window.innerHeight - tooltip.offsetHeight - 10;
        }

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
    }

    toggleHelp() {
        this.helpActive = !this.helpActive;
        const helpBtn = document.querySelector('#help-toggle-btn');

        if (this.helpActive) {
            helpBtn.textContent = '❓ Help (ON)';
            helpBtn.classList.add('active');
        } else {
            helpBtn.textContent = '❓ Help';
            helpBtn.classList.remove('active');
        }
    }

    saveProgress() {
        const state = {
            tutorialActive: this.isActive,
            currentStep: this.currentStep,
            lastUpdate: Date.now()
        };
        localStorage.setItem('onboarding-progress', JSON.stringify(state));
    }

    loadSavedProgress() {
        const saved = localStorage.getItem('onboarding-progress');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                if (state.tutorialActive && Date.now() - state.lastUpdate < 3600000) { // 1 hour
                    // Resume tutorial if it was recently in progress
                    this.currentStep = state.currentStep;
                    setTimeout(() => this.startTutorial(), 1000);
                }
            } catch (error) {
                console.warn('Failed to load saved tutorial progress');
            }
        }
    }

    saveWorkspace() {
        const state = {
            registers: window.cpu ? {
                PC: window.cpu.PC,
                A: window.cpu.A,
                X: window.cpu.X,
                Y: window.cpu.Y,
                SP: window.cpu.SP,
                P: window.cpu.P
            } : null,
            memory: window.memory ? window.memory.memory.slice(0, 0x200) : null, // Save first 512 bytes
            videoBuffer: window.memory ? window.memory.memory.slice(0x200, 0x600) : null,
            lastSave: Date.now()
        };
        localStorage.setItem('workspace-state', JSON.stringify(state));
    }

    restoreWorkspace() {
        const saved = localStorage.getItem('workspace-state');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                if (window.cpu && state.registers) {
                    window.cpu.PC = state.registers.PC;
                    window.cpu.A = state.registers.A;
                    window.cpu.X = state.registers.X;
                    window.cpu.Y = state.registers.Y;
                    window.cpu.SP = state.registers.SP;
                    window.cpu.P = state.registers.P;
                }
                if (window.memory && state.memory) {
                    state.memory.forEach((byte, i) => {
                        window.memory.writeByte(i, byte);
                    });
                }
                if (window.memory && state.videoBuffer) {
                    state.videoBuffer.forEach((byte, i) => {
                        window.memory.writeByte(0x200 + i, byte);
                    });
                }
                // Refresh UI
                if (window.updateVideo) window.updateVideo();
                console.log('Workspace restored from saved state');
                return true;
            } catch (error) {
                console.warn('Failed to restore workspace state');
                return false;
            }
        }
        return false;
    }

    checkSampleLoaded(sampleName) {
        const selector = document.querySelector('#sample-select');
        return selector && selector.value === sampleName;
    }

    checkProgramLoaded() {
        // Check if Hello World sample is loaded
        if (!window.cpu || !window.memory) return false;

        // Check if instruction at PC matches hello world pattern
        const pc = window.cpu.PC;
        return window.memory.readByte(pc) === 0xA9; // LDA #immediate instruction
    }

    checkLDAExecuted() {
        if (!window.cpu) return false;
        return window.cpu.A === 10; // Value from hello world LDA #10
    }

    completeTutorial() {
        this.isActive = false;

        // Show completion message
        const overlay = this.overlay;
        overlay.querySelector('.tutorial-content').innerHTML = `
            <div class="tutorial-completion">
                <h3>🎉 Tutorial Completed!</h3>
                <p>Congratulations! You've successfully:</p>
                <ul>
                    <li>✓ Loaded your first assembly program</li>
                    <li>✓ Executed instructions step-by-step</li>
                    <li>✓ Observed register and memory changes</li>
                    <li>✓ Controlled hardware output</li>
                </ul>
                <p>Your workspace is automatically saved. Use the ❓ Help button anytime for contextual assistance.</p>
            </div>
        `;

        overlay.querySelector('.tutorial-actions').innerHTML = `
            <button id="tutorial-finish-btn">Got it!</button>
        `;

        overlay.querySelector('#tutorial-finish-btn').addEventListener('click', () => {
            this.closeTutorial();
        });

        // Save completion
        this.saveProgress();
    }

    skipTutorial() {
        this.isActive = false;
        this.closeTutorial();
        this.saveProgress();
    }

    closeTutorial() {
        this.overlay.style.display = 'none';
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight');
        });
    }
}