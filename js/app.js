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
            // Simple toast implementation
            const toast = document.createElement('div');
            toast.style.cssText = `
                position: fixed; top: 20px; right: 20px; background: ${type === 'error' ? '#ff4444' : type === 'success' ? '#44ff44' : '#4444ff'};
                color: white; padding: 12px 20px; border-radius: 4px; z-index: 10000;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3); font-family: monospace;
            `;
            toast.textContent = `${type.toUpperCase()}: ${message}`;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 5000);
        };
        console.log('📢 Feedback system initialized with MCPError toast support');

        // Initialize layout manager for dynamic panels
        if (typeof LayoutManager !== 'undefined') {
            window.layoutManager = new LayoutManager();
            const mainLayout = document.getElementById('main-layout');
            const panelSidebar = document.getElementById('panel-sidebar');
            if (mainLayout) {
                window.layoutManager.init('#main-layout', '#panel-sidebar');
                console.log('🖼️ Layout manager initialized for emulator panels');
            } else {
                console.warn('⚠ Main layout not found for layout manager');
            }
        } else {
            console.warn('⚠ LayoutManager not available');
        }

        // Initialize debugger UI
        const debuggerElement = document.getElementById('debugger');
        console.log('Debugger element found:', !!debuggerElement);
        if (debuggerElement) {
            console.log('Calling initializeDebugger...');
            initializeDebugger('debugger');
            console.log('✓ Debugger initialized');
        } else {
            console.warn('⚠ Debugger element not found');
        }

        // Initialize memory viewer UI
        const memoryViewerElement = document.getElementById('memory-viewer');
        console.log('Memory viewer element found:', !!memoryViewerElement);
        if (memoryViewerElement) {
            console.log('Calling initializeMemoryViewer...');
            initializeMemoryViewer('memory-viewer');
            
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
            console.log('✓ Enhanced memory viewer initialized with AI activity log panel');
        } else {
            console.warn('⚠ Memory viewer element not found');
        }

        // Initialize video manager UI
        const videoManagerElement = document.getElementById('video-manager');
        console.log('Video manager element found:', !!videoManagerElement);
        if (videoManagerElement) {
            console.log('Calling initializeVideoManager...');
            initializeVideoManager('video-manager');
            console.log('✓ Video manager initialized');
        } else {
            console.warn('⚠ Video manager element not found');
        }

        // Initialize natural language input
        const nlInputElement = document.getElementById('mcp-input-panel');
        console.log('Natural language input element found:', !!nlInputElement);
        if (nlInputElement) {
            console.log('Calling initializeNaturalLanguageInput...');
            initializeNaturalLanguageInput();
            console.log('✓ Natural language input initialized');
        } else {
            console.warn('⚠ Natural language input element not found');
        }
    
        // Initialize assembly panel
        console.log('🔧 Initializing assembly panel...');
        try {
            const assemblyPanel = initializeAssemblyPanel();
            if (assemblyPanel) {
                console.log('✓ Assembly panel initialized successfully');
            } else {
                console.warn('⚠ Assembly panel initialization returned null');
            }
        } catch (error) {
            console.error('❌ Assembly panel initialization failed:', error);
        }
    
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

// Global hook for MCP events to ensure memory viewer updates
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    // Ensure layout manager integrates the memory viewer panel
    if (window.layoutManager) {
      const memoryPanel = document.getElementById('memory-viewer');
      if (memoryPanel) {
        window.layoutManager.makePanelResizable(memoryPanel);
        console.log('Memory viewer integrated as resizable panel via layout manager');
      }
    }
    
    // Test MCP action to verify logging (optional, for development)
    if (window.mcpClient && window.mcpClient.serverAvailable) {
      console.log('MCP client ready - test memory write to trigger logging');
      // Uncomment for testing: window.mcpClient.writeMemory(0x0200, 0xFF, 1);
    }
  });
}
