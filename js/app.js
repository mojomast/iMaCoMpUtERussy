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
        // Add showToast method for MCPError notifications
        window.feedbackSystem.showToast = function(message, type = 'info') {
            // Simple toast implementation with theme support
            const toast = document.createElement('div');
            const bgColor = type === 'error' ? '#ff4444' : type === 'success' ? '#44ff44' : '#4444ff';
            const textColor = type === 'error' ? '#ffffff' : type === 'success' ? '#000000' : '#ffffff';
            toast.style.cssText = `
                position: fixed; top: 20px; right: 20px; background: ${bgColor};
                color: ${textColor}; padding: 12px 20px; border-radius: 4px; z-index: 10000;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3); font-family: var(--font-family);
                font-size: var(--font-size);
            `;
            toast.textContent = `${type.toUpperCase()}: ${message}`;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 5000);
        };
        console.log('📢 Feedback system initialized with MCPError toast support');
        
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
                        const response = await timeoutFetch('/mcp/cpu/reset', { method: 'POST' });
                        window.feedbackSystem.showToast('CPU reset successful', 'success');
                        return response;
                    } catch (error) {
                        if (error instanceof MCPError) {
                            window.feedbackSystem.showToast(`MCP Error: ${error.message}`, 'error');
                        } else {
                            window.feedbackSystem.showToast(`Reset failed: ${error.message}`, 'error');
                        }
                        throw error;
                    }
                });
                voiceSystem.addCommandHandler('step CPU', async () => {
                    try {
                        const response = await timeoutFetch('/mcp/cpu/step', {
                            method: 'POST',
                            body: JSON.stringify({ timeout: 100 })
                        });
                        window.feedbackSystem.showToast('CPU step executed', 'success');
                        return response;
                    } catch (error) {
                        if (error instanceof MCPError) {
                            window.feedbackSystem.showToast(`MCP Error: ${error.message}`, 'error');
                        } else {
                            window.feedbackSystem.showToast(`Step failed: ${error.message}`, 'error');
                        }
                        throw error;
                    }
                });
                voiceSystem.addCommandHandler('run CPU', async () => {
                    try {
                        const response = await timeoutFetch('/mcp/cpu/run', {
                            method: 'POST',
                            body: JSON.stringify({ maxSteps: 1000 })
                        });
                        window.feedbackSystem.showToast('CPU run completed', 'success');
                        return response;
                    } catch (error) {
                        if (error instanceof MCPError) {
                            window.feedbackSystem.showToast(`MCP Error: ${error.message}`, 'error');
                        } else {
                            window.feedbackSystem.showToast(`Run failed: ${error.message}`, 'error');
                        }
                        throw error;
                    }
                });
                voiceSystem.addCommandHandler('recognition error', (error) => {
                    window.feedbackSystem.showToast(`Voice recognition error: ${error.message}`, 'error');
                });
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
