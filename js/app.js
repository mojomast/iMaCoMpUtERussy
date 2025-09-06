/* global initializeSettingsPanel */

// Use browser-compatible MCP client (imports work in browser)
let initializeMCPIntegration;
try {
  const mcpModule = await import('./mcp-client.js');
  initializeMCPIntegration = mcpModule.initializeMCPIntegration;
  // Set up MCP integration properly
} catch (e) {
  console.warn('Could not import browser MCP client:', e.message);
  initializeMCPIntegration = async function() {
    console.log('MCP integration unavailable (server-side libraries detected in browser context)');
  };
}

/**
 * Main application initialization for iMaCoMpUtERussy Emulator
 * Initializes all UI components when the DOM is loaded
 * Created by Kyle Durepos
 */

import { initializeDebugger } from './ui/debugger.js';
import { initializeMemoryViewer } from './ui/memory-viewer.js';
import { initializeVideoManager } from './ui/video-manager.js';
import { initializeNaturalLanguageInput } from './ui/natural-language-input.js';
import { initializeAssemblyPanel } from './ui/assembly-panel.js';
import { ConsoleUI } from './ui/console.js';
import VoiceControlSystem from './ui/voice-control.js';
import { UIFeedbackSystem } from './ui/feedback-system.js';
import LayoutManager from './ui/layout-manager.js';
import { MCPError } from '../server/mcp_errors.js';
import { timeoutFetch } from './mcp-client.js';

/**
 * Initialize MCP client with error handling
 */
function initializeMCPClient() {
    try {
        if (initializeMCPIntegration) {
            console.log('🎛️ Initializing MCP integration...');
            initializeMCPIntegration();
            console.log('✅ MCP integration initialized successfully');
        } else {
            console.log('ℹ️ MCP integration not available (browser mode)');
        }
    } catch (error) {
        console.error('❌ Failed to initialize MCP integration:', error);
    }

    // Expose mcpClient methods globally for UI components
    if (window.mcpClient && window.mcpClient.serverAvailable) {
        console.log('🌐 Exposing MCP client methods globally for UI integration');
        
        // CPU control methods
        window.cpuReset = window.mcpClient.resetCPU.bind(window.mcpClient);
        window.cpuStep = window.mcpClient.stepCPU.bind(window.mcpClient);
        window.cpuRun = window.mcpClient.runCPU.bind(window.mcpClient);
        window.getCPUState = window.mcpClient.getCPUState.bind(window.mcpClient);
        
        // Program management methods
        window.saveProgram = window.mcpClient.saveProgram.bind(window.mcpClient);
        window.loadProgram = window.mcpClient.loadProgram.bind(window.mcpClient);
        
        // Queue management methods
        window.addToQueue = window.mcpClient.addToQueue.bind(window.mcpClient);
        window.listQueue = window.mcpClient.listQueue.bind(window.mcpClient);
        
        // WebSocket callback stubs (for real-time updates)
        window.updateQueueDisplay = function(queueData) {
            console.log('📋 Queue update received:', queueData);
            // UI components can override this for custom queue display
            if (window.logToMCP) {
                window.logToMCP('info', `Queue updated: ${queueData.items?.length || 0} items`);
            }
        };
        
        window.updateCPUStateDisplay = function(cpuState) {
            console.log('🖥️ CPU state update received:', cpuState);
            // UI components can override this for custom CPU display
            if (window.logToMCP) {
                window.logToMCP('info', `CPU: PC=0x${cpuState.pc?.toString(16)} A=0x${cpuState.a?.toString(16)}`);
            }
        };
        
        console.log('✅ MCP client methods exposed globally');
    } else {
        console.warn('⚠ MCP client not available - global methods not exposed');
        // Create no-op stubs for UI compatibility
        ['cpuReset', 'cpuStep', 'cpuRun', 'getCPUState', 'saveProgram', 'loadProgram', 'addToQueue', 'listQueue'].forEach(method => {
            window[method] = async function() {
                console.info(`📱 Offline mode: ${method} (simulated)`);
                return { success: true, message: `${method} in offline mode` };
            };
        });
        window.updateQueueDisplay = function() { console.log('📋 Offline queue update') };
        window.updateCPUStateDisplay = function() { console.log('🖥️ Offline CPU state update') };
    }
}

/**
 * Initialize the application
 */
async function initializeApp() {
    console.log('🚀 Initializing iMaCoMpUtERussy Emulator...');
    console.log('DOM ready state:', document.readyState);

    try {
        // Initialize feedback system first for error handling
        window.feedbackSystem = new UIFeedbackSystem();
        
        // Enhanced showToast method for MCPError handling and categorized notifications
        window.feedbackSystem.showToast = function(errorOrMessage, typeOrSeverity = 'info', details = {}) {
          let message, severity, duration = 5000;
          
          // Handle MCPError objects
          if (errorOrMessage && typeof errorOrMessage === 'object' && (errorOrMessage.isMCPError || errorOrMessage.code)) {
            const mcpError = errorOrMessage;
            message = mcpError.message || 'An error occurred';
            severity = this.getErrorSeverity(mcpError.code, typeOrSeverity);
            
            // Customize message based on error type
            switch (mcpError.code) {
              case 'VALIDATION_FAILED':
              case 'INVALID_REQUEST':
                message = `Validation Error: ${message}`;
                duration = 6000;
                break;
              case 'TIMEOUT_EXCEEDED':
              case 'CPU_TIMEOUT':
                message = `Timeout: ${message} (retrying...)`;
                duration = 4000;
                break;
              case 'SERVICE_UNAVAILABLE':
                if (mcpError.details?.circuitStatus?.state === 'OPEN') {
                  message = `Service Unavailable: Circuit breaker OPEN for ${mcpError.operationType || 'service'} (${Math.round((30000 - (Date.now() - mcpError.details.circuitStatus.lastFailureTime))/1000)}s remaining)`;
                  duration = 8000;
                } else {
                  message = `Service temporarily unavailable: ${message}`;
                }
                break;
              case 'RETRY_EXHAUSTED':
                message = `Operation failed after retries: ${message}`;
                duration = 6000;
                break;
              case 'MEMORY_OUT_OF_BOUNDS':
                message = `Memory Error: ${message} (address out of range)`;
                break;
              case 'VIDEO_OUT_OF_BOUNDS':
                message = `Video Error: ${message} (coordinates out of bounds)`;
                break;
              case 'PROGRAM_NOT_FOUND':
                message = `Program Error: ${message}`;
                break;
              case 'QUEUE_FULL':
                message = `Queue Error: ${message} (try again later)`;
                break;
              default:
                message = `MCP Error [${mcpError.code}]: ${message}`;
            }
            
            // Add retry information if available
            if (mcpError.retryable && mcpError.retryCount < (mcpError.maxRetries || 3)) {
              message += ` (Retry ${mcpError.retryCount + 1}/${mcpError.maxRetries})`;
            }
            
            // Include circuit breaker status if present
            if (mcpError.details?.circuitStatus) {
              const cb = mcpError.details.circuitStatus;
              if (cb.state === 'OPEN') {
                message += ` | Circuit Breaker: ${cb.state} (${cb.failureCount} failures)`;
              } else if (cb.state === 'HALF_OPEN') {
                message += ` | Circuit Breaker: ${cb.state} (testing recovery)`;
              }
            }
            
            details.mcpError = mcpError;
          } else {
            // Simple string message
            message = errorOrMessage;
            severity = typeOrSeverity;
          }
          
          // Create toast with enhanced styling
          const toast = document.createElement('div');
          const theme = getComputedStyle(document.documentElement).getPropertyValue('--ui-theme').trim() || 'dark';
          
          // Determine colors based on severity and theme
          let bgColor, textColor, borderColor;
          switch (severity) {
            case 'error':
              bgColor = theme === 'dark' ? '#ff4444' : '#cc0000';
              textColor = '#ffffff';
              borderColor = '#cc0000';
              break;
            case 'warn':
              bgColor = theme === 'dark' ? '#ffaa00' : '#cc8800';
              textColor = '#000000';
              borderColor = '#cc8800';
              break;
            case 'success':
              bgColor = theme === 'dark' ? '#44ff44' : '#00cc00';
              textColor = '#000000';
              borderColor = '#00cc00';
              break;
            case 'info':
            default:
              bgColor = theme === 'dark' ? '#4444ff' : '#0000cc';
              textColor = '#ffffff';
              borderColor = '#0000cc';
              break;
          }
          
          // Enhanced toast styling with MCP-specific indicators
          toast.style.cssText = `
            position: fixed; top: 20px; right: 20px; background: ${bgColor};
            color: ${textColor}; padding: 12px 20px; border-radius: 6px; z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-family: var(--font-family);
            font-size: var(--font-size); max-width: 400px; border-left: 4px solid ${borderColor};
            animation: slideInRight 0.3s ease-out;
          `;
          
          // Add MCP error icon and code if applicable
          let toastContent = document.createElement('div');
          if (details.mcpError && details.mcpError.code) {
            const icon = document.createElement('span');
            icon.style.cssText = 'font-family: monospace; font-weight: bold; margin-right: 8px;';
            icon.textContent = `❌ ${details.mcpError.code}`;
            toastContent.appendChild(icon);
          }
          const messageSpan = document.createElement('span');
          messageSpan.textContent = message;
          toastContent.appendChild(messageSpan);
          toast.appendChild(toastContent);
          
          // Add details button for complex errors
          if (details.mcpError && (details.mcpError.details || details.mcpError.stack)) {
            const detailsBtn = document.createElement('button');
            detailsBtn.textContent = 'Details';
            detailsBtn.style.cssText = `
              background: transparent; border: 1px solid ${textColor}; color: ${textColor};
              padding: 2px 8px; border-radius: 3px; font-size: 0.8em; margin-left: 10px;
              cursor: pointer; float: right;
            `;
            detailsBtn.onclick = () => {
              const detailToast = document.createElement('div');
              detailToast.style.cssText = `
                position: fixed; top: 80px; right: 20px; background: ${bgColor};
                color: ${textColor}; padding: 12px 20px; border-radius: 6px; z-index: 10001;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-family: monospace;
                max-width: 500px; max-height: 300px; overflow-y: auto; white-space: pre-wrap;
                border-left: 4px solid ${borderColor};
              `;
              detailToast.textContent = JSON.stringify(details.mcpError, null, 2);
              document.body.appendChild(detailToast);
              setTimeout(() => detailToast.remove(), 10000);
            };
            toastContent.appendChild(detailsBtn);
          }
          
          document.body.appendChild(toast);
          
          // Auto-remove with animation
          setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-in forwards';
            setTimeout(() => toast.remove(), 300);
          }, duration);
          
          // Add CSS animations if not present
          if (!document.getElementById('toast-animations')) {
            const style = document.createElement('style');
            style.id = 'toast-animations';
            style.textContent = `
              @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
              }
              @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
              }
            `;
            document.head.appendChild(style);
          }
          
          console.log(`📢 Toast shown: ${severity} - ${message}`);
        };
        
        /**
         * Get severity level for MCP error codes
         */
        window.feedbackSystem.getErrorSeverity = function(errorCode, defaultSeverity = 'error') {
          const severityMap = {
            // Validation errors
            'VALIDATION_FAILED': 'error',
            'INVALID_REQUEST': 'error',
            'INVALID_ASSEMBLY': 'error',
            
            // Timeout errors (retryable)
            'TIMEOUT_EXCEEDED': 'warn',
            'CPU_TIMEOUT': 'warn',
            'VIDEO_UPDATE_TIMEOUT': 'warn',
            
            // Service availability (retryable)
            'SERVICE_UNAVAILABLE': 'warn',
            'RETRYABLE_SERVICE': 'warn',
            'RETRY_EXHAUSTED': 'error',
            
            // Resource errors
            'MEMORY_OUT_OF_BOUNDS': 'error',
            'MEMORY_OUT_OF_RANGE': 'error',
            'VIDEO_OUT_OF_BOUNDS': 'error',
            'PAYLOAD_TOO_LARGE': 'error',
            
            // Business logic errors
            'PROGRAM_NOT_FOUND': 'warn',
            'PROGRAM_EXISTS': 'warn',
            'QUEUE_FULL': 'warn',
            'TASK_NOT_FOUND': 'warn',
            
            // CPU state errors
            'CPU_HALTED': 'info',
            'CPU_NOT_READY': 'warn',
            'BREAKPOINT_HIT': 'info',
            
            // Internal/system errors
            'INTERNAL_ERROR': 'error',
            'NOT_FOUND': 'error',
            'ENDPOINT_NOT_FOUND': 'error'
          };
          
          return severityMap[errorCode] || defaultSeverity;
        };
        
        /**
         * Show offline mode notification
         */
        window.feedbackSystem.showOfflineMode = function(message = 'Switched to offline mode with local simulation') {
          this.showToast(message, 'warn', { offline: true });
          
          // Add persistent offline indicator
          let offlineIndicator = document.getElementById('offline-indicator');
          if (!offlineIndicator) {
            offlineIndicator = document.createElement('div');
            offlineIndicator.id = 'offline-indicator';
            offlineIndicator.style.cssText = `
              position: fixed; top: 0; left: 0; right: 0; background: #ffaa00; color: #000;
              padding: 8px 20px; text-align: center; z-index: 9999; font-weight: bold;
              font-family: var(--font-family); font-size: 14px;
            `;
            offlineIndicator.innerHTML = `
              🌐 <span id="offline-message">Offline Mode: Using Local CPU Simulation</span>
              <button onclick="window.mcpClient?.checkServerAvailability()" style="margin-left: 10px; background: #000; color: #ffaa00; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer;">Reconnect</button>
            `;
            document.body.appendChild(offlineIndicator);
          }
          
          document.getElementById('offline-message').textContent = message;
          offlineIndicator.style.display = 'block';
        };
        
        /**
         * Hide offline mode indicator
         */
        window.feedbackSystem.hideOfflineMode = function() {
          const indicator = document.getElementById('offline-indicator');
          if (indicator) {
            indicator.style.display = 'none';
          }
          this.showToast('Reconnected to server - resuming normal operation', 'success');
        };
        
        console.log('📢 Enhanced feedback system initialized with MCPError handling and offline mode support');
        
        // Initialize settings panel early for CSS variable application
        console.log('⚙️ Initializing settings panel early for CSS variables...');
        try {
            const settingsPanel = initializeSettingsPanel();
            if (settingsPanel) {
                // Listen for settings updates globally
                window.addEventListener('settingsUpdated', (e) => {
                    console.log('Global settings updated:', e.detail);
                    // Apply CSS variables dynamically
                    const root = document.documentElement;
                    root.style.setProperty('--ui-theme', e.detail.theme);
                    root.style.setProperty('--ui-font-family', e.detail.fontFamily);
                    root.style.setProperty('--ui-font-size', e.detail.fontSize);
                    root.style.setProperty('--ui-font-color', e.detail.fontColor);
                    
                    // Update body class for theme
                    document.body.className = e.detail.theme + '-theme';
                    
                    // Re-apply toasts and other dynamic elements
                    if (window.feedbackSystem) {
                        // Update any existing toasts (simplified)
                        document.querySelectorAll('.toast').forEach(toast => {
                            toast.style.fontFamily = 'var(--font-family)';
                            toast.style.fontSize = 'var(--font-size)';
                        });
                    }
                    
                    // Notify other components
                    console.log('✅ CSS variables updated globally');
                });
                
                // Apply initial settings
                settingsPanel.applyAllSettings();
                console.log('✅ Settings panel initialized with dynamic CSS support');
            }
        } catch (error) {
            console.error('❌ Early settings panel initialization failed:', error);
        }

        // Initialize layout manager for dynamic panels with enhanced panel control
        if (typeof LayoutManager !== 'undefined') {
            window.layoutManager = new LayoutManager();
            const mainLayout = document.getElementById('main-layout');
            const panelSidebar = document.getElementById('panel-sidebar');
            if (mainLayout) {
                window.layoutManager.init('#main-layout', '#panel-sidebar');
                console.log('🖼️ Layout manager initialized for emulator panels');
                
                // Set initial visibility states for all panels using layout manager
                const panelsToShow = ['debugger', 'memory-viewer', 'video-manager'];
                panelsToShow.forEach(panelId => {
                    const panelInfo = window.layoutManager.panels.find(p => p.id === panelId);
                    if (panelInfo) {
                        window.layoutManager.togglePanel(panelInfo, true);
                    }
                });
                
                // Hide MCP panels initially
                const mcpPanels = ['mcp-input-panel', 'mcp-display'];
                mcpPanels.forEach(panelId => {
                    const panelInfo = window.layoutManager.panels.find(p => p.id === panelId);
                    if (panelInfo) {
                        window.layoutManager.togglePanel(panelInfo, false);
                    }
                });
                
                console.log('✅ Panel visibility initialized via layout manager');
            } else {
                console.warn('⚠ Main layout not found for layout manager');
            }
        } else {
            console.warn('⚠ LayoutManager not available');
        }

        // Initialize debugger UI with layout manager integration
        const debuggerElement = document.getElementById('debugger');
        console.log('Debugger element found:', !!debuggerElement);
        if (debuggerElement) {
            console.log('Calling initializeDebugger...');
            initializeDebugger('debugger');
            
            // Integrate with layout manager for show/hide control
            if (window.layoutManager) {
                const debuggerPanel = window.layoutManager.panels.find(p => p.id === 'debugger');
                if (debuggerPanel) {
                    // Add show/hide methods to debugger module
                    window.debuggerShow = () => window.layoutManager.togglePanel(debuggerPanel, true);
                    window.debuggerHide = () => window.layoutManager.togglePanel(debuggerPanel, false);
                    console.log('✅ Debugger integrated with layout manager');
                }
            }
            
            console.log('✓ Debugger initialized with layout integration');
        } else {
            console.warn('⚠ Debugger element not found');
        }

        // Initialize memory viewer UI with layout manager integration
        const memoryViewerElement = document.getElementById('memory-viewer');
        console.log('Memory viewer element found:', !!memoryViewerElement);
        if (memoryViewerElement) {
            console.log('Calling initializeMemoryViewer...');
            initializeMemoryViewer('memory-viewer');
            
            // Integrate with layout manager for show/hide control
            if (window.layoutManager) {
                const memoryPanel = window.layoutManager.panels.find(p => p.id === 'memory-viewer');
                if (memoryPanel) {
                    // Add show/hide methods to memory viewer module
                    window.memoryViewerShow = () => window.layoutManager.togglePanel(memoryPanel, true);
                    window.memoryViewerHide = () => window.layoutManager.togglePanel(memoryPanel, false);
                    console.log('✅ Memory viewer integrated with layout manager');
                }
            }
            
            // Ensure enhanced memory viewer features are active
            if (window.refreshMemoryDisplay) {
              // Hook into MCP events for automatic refresh (WebSocket already handles this)
              console.log('✓ Enhanced memory viewer with real-time AI/MCP logging initialized');
              
              // Initial sync of logs if MCP display exists
              const mcpDisplay = document.getElementById('mcp-display');
              const activityLog = document.getElementById('activity-log');
              if (mcpDisplay && activityLog && !window.memoryLogSynced) {
                activityLog.innerHTML = mcpDisplay.innerHTML;
                activityLog.scrollTop = activityLog.scrollHeight;
                console.log('Initial log sync completed');
              }
            } else {
              console.warn('Memory viewer refresh not available');
            }
            console.log('✓ Enhanced memory viewer initialized with layout integration');
        } else {
            console.warn('⚠ Memory viewer element not found');
        }

        // Initialize video manager UI with layout manager integration
        const videoManagerElement = document.getElementById('video-manager');
        console.log('Video manager element found:', !!videoManagerElement);
        if (videoManagerElement) {
            console.log('Calling initializeVideoManager...');
            initializeVideoManager('video-manager');
            
            // Integrate with layout manager for show/hide control
            if (window.layoutManager) {
                const videoPanel = window.layoutManager.panels.find(p => p.id === 'video-manager');
                if (videoPanel) {
                    // Add show/hide methods to video manager module
                    window.videoManagerShow = () => window.layoutManager.togglePanel(videoPanel, true);
                    window.videoManagerHide = () => window.layoutManager.togglePanel(videoPanel, false);
                    console.log('✅ Video manager integrated with layout manager');
                }
            }
            
            console.log('✓ Video manager initialized with layout integration');
        } else {
            console.warn('⚠ Video manager element not found');
        }

        // Initialize natural language input with layout manager integration
        const nlInputElement = document.getElementById('mcp-input-panel');
        console.log('Natural language input element found:', !!nlInputElement);
        if (nlInputElement) {
            console.log('Calling initializeNaturalLanguageInput...');
            const nlInput = initializeNaturalLanguageInput();
            
            // Integrate with layout manager for show/hide control
            if (window.layoutManager) {
                const nlPanel = window.layoutManager.panels.find(p => p.id === 'mcp-input-panel');
                if (nlPanel) {
                    // Add show/hide methods to natural language input module
                    window.nlInputShow = () => window.layoutManager.togglePanel(nlPanel, true);
                    window.nlInputHide = () => window.layoutManager.togglePanel(nlPanel, false);
                    console.log('✅ Natural language input integrated with layout manager');
                }
            }
            
            console.log('✓ Natural language input initialized with layout integration');
        } else {
            console.warn('⚠ Natural language input element not found');
        }
    
        // Initialize assembly panel with layout manager integration
        console.log('🔧 Initializing assembly panel...');
        try {
            const assemblyPanel = initializeAssemblyPanel();
            if (assemblyPanel) {
                // Integrate with layout manager for show/hide control
                if (window.layoutManager) {
                    const assemblyPanelInfo = window.layoutManager.panels.find(p => p.id === 'assembly-panel');
                    if (assemblyPanelInfo) {
                        // Add show/hide methods to assembly panel module
                        window.assemblyShow = () => window.layoutManager.togglePanel(assemblyPanelInfo, true);
                        window.assemblyHide = () => window.layoutManager.togglePanel(assemblyPanelInfo, false);
                        console.log('✅ Assembly panel integrated with layout manager');
                    }
                }
                console.log('✓ Assembly panel initialized with layout integration');
            } else {
                console.warn('⚠ Assembly panel initialization returned null');
            }
        } catch (error) {
            console.error('❌ Assembly panel initialization failed:', error);
        }
    
        // Initialize console/terminal UI with layout manager integration
        const consoleElement = document.getElementById('console');
        console.log('Console element found:', !!consoleElement);
        if (consoleElement) {
            console.log('Calling consoleUI.initialize...');
            window.consoleUI.initialize('console');
            
            // Integrate with layout manager for show/hide control
            if (window.layoutManager) {
                const consolePanel = window.layoutManager.panels.find(p => p.id === 'console');
                if (consolePanel) {
                    // Add show/hide methods to console module
                    window.consoleShow = () => window.layoutManager.togglePanel(consolePanel, true);
                    window.consoleHide = () => window.layoutManager.togglePanel(consolePanel, false);
                    console.log('✅ Console integrated with layout manager');
                }
            }
            
            console.log('✓ Console initialized with layout integration');
        } else {
            console.warn('⚠ Console element not found');
        }
    
        // Global keyboard input handler for I/O
        document.addEventListener('keydown', (e) => {
            // Only handle if console is active/visible
            if (window.layoutManager && window.layoutManager.panels.find(p => p.id === 'console' && p.visible)) {
                // Map key to ASCII and write to I/O address if console input is focused or global I/O mode
                if (window.consoleUI && window.consoleUI.memory) {
                    const ioAddr = window.consoleUI.ioAddress || 0x0600;
                    const charCode = e.key.charCodeAt(0);
                    if (charCode >= 32 && charCode <= 126) { // Printable ASCII
                        window.consoleUI.memory.writeByte(ioAddr, charCode);
                        window.consoleUI.writeOutput(`${e.key}`);
                        console.log(`Keyboard I/O: Wrote 0x${charCode.toString(16).toUpperCase()} to 0x${ioAddr.toString(16).toUpperCase()}`);
                    } else if (e.key === 'Enter') {
                        window.consoleUI.memory.writeByte(ioAddr, 13); // CR
                        window.consoleUI.memory.writeByte(ioAddr + 1, 10); // LF
                        window.consoleUI.writeOutput('\n');
                    }
                }
            }
        });
    
        console.log('✓ Global keyboard I/O handler installed');
    
        // Initialize voice control system with MCP integration and timeoutFetch
        console.log('🎤 Initializing voice control system...');
        try {
            const voiceSystem = new VoiceControlSystem();
            // Enhance with timeoutFetch and MCPError handling
            voiceSystem.timeoutFetch = timeoutFetch;
            voiceSystem.mcpClient = window.mcpClient || { resetCPU: async () => {}, stepCPU: async () => {}, runCPU: async () => {} };
            voiceSystem.feedbackSystem = window.feedbackSystem;
            const voiceInitialized = await voiceSystem.initialize();
            if (voiceInitialized) {
                window.voiceControl = voiceSystem;
                // Add MCP command handlers with error handling
                voiceSystem.addCommandHandler('reset CPU', async () => {
                  try {
                    // Use resilient fetch for voice commands
                    const response = await window.mcpClient.resilientFetch('/mcp/cpu/reset', {
                      method: 'POST',
                      body: JSON.stringify({ hardReset: true })
                    }, 3, 1000, 'voice_cpu_reset');
                    window.feedbackSystem.showToast('CPU reset successful', 'success');
                    return response;
                  } catch (error) {
                    // Enhanced error handling for voice commands
                    window.feedbackSystem.showToast(error, 'error'); // Will handle MCPError automatically
                    if (window.mcpClient.serverAvailable === false) {
                      // Fallback to local simulation
                      window.mcpClient.localCPU?.reset();
                      window.feedbackSystem.showToast('Using local CPU simulation (offline mode)', 'warn');
                    }
                    throw error;
                  }
                });
                voiceSystem.addCommandHandler('step CPU', async () => {
                  try {
                    const response = await window.mcpClient.resilientFetch('/mcp/cpu/step', {
                      method: 'POST',
                      body: JSON.stringify({ steps: 1, timeout: 100 })
                    }, 3, 1000, 'voice_cpu_step');
                    window.feedbackSystem.showToast('CPU step executed', 'success');
                    return response;
                  } catch (error) {
                    window.feedbackSystem.showToast(error, 'error');
                    if (window.mcpClient.serverAvailable === false) {
                      // Fallback to local simulation
                      const result = window.mcpClient.localCPU?.step(1);
                      if (result) {
                        window.feedbackSystem.showToast(`Local CPU step: PC=0x${result.pc.toString(16)}`, 'info');
                      }
                    }
                    throw error;
                  }
                });
                voiceSystem.addCommandHandler('run CPU', async () => {
                  try {
                    const response = await window.mcpClient.resilientFetch('/mcp/cpu/run', {
                      method: 'POST',
                      body: JSON.stringify({ maxSteps: 1000, stepDelay: 1, breakOnHalt: true })
                    }, 3, 1000, 'voice_cpu_run');
                    window.feedbackSystem.showToast('CPU run completed', 'success');
                    return response;
                  } catch (error) {
                    window.feedbackSystem.showToast(error, 'error');
                    if (window.mcpClient.serverAvailable === false) {
                      // Fallback to local simulation
                      const result = window.mcpClient.localCPU?.step(100); // Run 100 steps locally
                      if (result) {
                        window.feedbackSystem.showToast(`Local CPU run: ${result.halted ? 'Halted after' : 'Executed'} ${100} steps`, 'info');
                      }
                    }
                    throw error;
                  }
                });
                voiceSystem.addCommandHandler('recognition error', (error) => {
                  window.feedbackSystem.showToast(`Voice recognition error: ${error.message}`, 'error');
                });
              
                // Add MCP status command handlers
                voiceSystem.addCommandHandler('check connection', async () => {
                  try {
                    const available = await window.mcpClient.checkServerAvailability();
                    if (available) {
                      window.feedbackSystem.showToast('Server connection healthy', 'success');
                    } else {
                      window.feedbackSystem.showOfflineMode('Server connection lost - using local simulation');
                    }
                    return { available };
                  } catch (error) {
                    window.feedbackSystem.showToast('Connection check failed', 'error');
                    return { available: false };
                  }
                });
              
                voiceSystem.addCommandHandler('replay operations', async () => {
                  try {
                    const queueKey = 'mcp_operation_queue';
                    const queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
                    if (queue.length === 0) {
                      window.feedbackSystem.showToast('No queued operations to replay', 'info');
                      return { queued: 0 };
                    }
                    
                    await window.mcpClient.replayQueuedOperations();
                    window.feedbackSystem.showToast(`Replayed ${queue.length} queued operations`, 'success');
                    return { queued: queue.length, replayed: true };
                  } catch (error) {
                    window.feedbackSystem.showToast(`Replay failed: ${error.message}`, 'error');
                    throw error;
                  }
                });
              
                voiceSystem.addCommandHandler('clear queue', async () => {
                  try {
                    window.mcpClient.clearQueuedOperations('', 'manual');
                    window.feedbackSystem.showToast('Cleared all queued operations', 'success');
                    return { cleared: true };
                  } catch (error) {
                    window.feedbackSystem.showToast(`Clear queue failed: ${error.message}`, 'error');
                    throw error;
                  }
                });
              
                console.log('🎤 Voice control enhanced with MCP resilience commands');
                console.log('✓ Voice control enhanced with MCP commands and error handling');
            } else {
                console.warn('⚠ Voice control initialization failed');
            }
        } catch (error) {
            console.error('❌ Voice control initialization error:', error);
            window.feedbackSystem?.showToast(`Voice init failed: ${error.message}`, 'error');
        }
    
        // Initialize MCP client
        console.log('🎛️ Initializing MCP client...');
        initializeMCPClient();
        
        // Set up global error handler for MCP errors
        window.addEventListener('error', (event) => {
          if (event.error && (event.error.isMCPError || event.error.code)) {
            event.preventDefault();
            window.feedbackSystem.showToast(event.error, 'error');
            return false;
          }
        });
        
        // Set up unhandled promise rejection handler for async MCP errors
        window.addEventListener('unhandledrejection', (event) => {
          const error = event.reason;
          if (error && (error.isMCPError || error.code)) {
            event.preventDefault();
            window.feedbackSystem.showToast(error, 'error');
            console.error('Unhandled MCP promise rejection:', error);
            return false;
          }
        });
        
        // Monitor MCP client server availability changes
        const originalCheckServerAvailability = window.mcpClient?.checkServerAvailability;
        if (window.mcpClient && originalCheckServerAvailability) {
          window.mcpClient.checkServerAvailability = async function() {
            const wasAvailable = this.serverAvailable;
            const result = await originalCheckServerAvailability.call(this);
            
            // Notify user of availability changes
            if (result !== wasAvailable) {
              if (result) {
                window.feedbackSystem.hideOfflineMode();
              } else {
                window.feedbackSystem.showOfflineMode('Lost connection to MCP server');
              }
            }
            
            return result;
          };
        }
        
        console.log('🛡️ Global MCP error handling and availability monitoring initialized');

        console.log('✅ iMaCoMpUtERussy Emulator initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize iMaCoMpUtERussy Emulator:', error);
        console.error('Error stack:', error.stack);
    }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM already loaded
    initializeApp();
}

// Export for manual initialization if needed
export { initializeApp, initializeMCPClient };

// Global hook for MCP events to ensure memory viewer updates with enhanced layout integration
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    // Ensure layout manager integrates all panels
    if (window.layoutManager) {
      // Make all panels resizable
      window.layoutManager.panels.forEach(panelInfo => {
        window.layoutManager.makePanelResizable(panelInfo.element);
      });
      console.log('All panels integrated as resizable via layout manager');
      
      // Create unified show/hide API for all panels
      window.showPanel = (panelId) => {
        const panelInfo = window.layoutManager.panels.find(p => p.id === panelId);
        if (panelInfo) {
          window.layoutManager.togglePanel(panelInfo, true);
          console.log(`Panel ${panelId} shown`);
        }
      };
      
      window.hidePanel = (panelId) => {
        const panelInfo = window.layoutManager.panels.find(p => p.id === panelId);
        if (panelInfo) {
          window.layoutManager.togglePanel(panelInfo, false);
          console.log(`Panel ${panelId} hidden`);
        }
      };
      
      window.togglePanel = (panelId) => {
        const panelInfo = window.layoutManager.panels.find(p => p.id === panelId);
        if (panelInfo) {
          const newState = !panelInfo.visible;
          window.layoutManager.togglePanel(panelInfo, newState);
          console.log(`Panel ${panelId} toggled to ${newState ? 'visible' : 'hidden'}`);
        }
      };
      
      // Initialize panel states from saved layout
      window.layoutManager.loadLayout(JSON.parse(localStorage.getItem('uiLayout') || '[]'));
      console.log('✅ Unified panel show/hide API created and layout loaded');
      
      // Initialize bottom toolbar toggles
      const toolbarToggles = document.querySelectorAll('#panel-toolbar input[type="checkbox"]');
      toolbarToggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
          const panelId = e.target.dataset.panel;
          if (e.target.checked) {
            window.showPanel(panelId);
          } else {
            window.hidePanel(panelId);
          }
          
          // Update layout manager state and save
          const panelInfo = window.layoutManager.panels.find(p => p.id === panelId);
          if (panelInfo) {
            panelInfo.visible = e.target.checked;
          }
          window.layoutManager.saveLayout();
          
          console.log(`Toolbar toggle: ${panelId} = ${e.target.checked}`);
        });
        
        // Set initial checkbox state based on panel visibility
        const panelId = toggle.dataset.panel;
        const panelInfo = window.layoutManager.panels.find(p => p.id === panelId);
        if (panelInfo) {
          toggle.checked = panelInfo.visible;
        }
      });
      
      console.log(`✅ Bottom toolbar initialized with ${toolbarToggles.length} toggles`);
    }
    
    // Test MCP action to verify logging (optional, for development)
    if (window.mcpClient && window.mcpClient.serverAvailable) {
      console.log('MCP client ready - test memory write to trigger logging');
      // Uncomment for testing: window.mcpClient.writeMemory(0x0200, 0xFF, 1);
    }
  });
}
