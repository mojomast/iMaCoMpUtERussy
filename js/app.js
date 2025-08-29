/**
 * Main application initialization for iMaCoMpUtERussy Emulator
 * Initializes all UI components when the DOM is loaded
 * Created by Kyle Durepos
 */

import { initializeDebugger } from './ui/debugger.js';
import { initializeMemoryViewer } from './ui/memory-viewer.js';
import { initializeVideoManager } from './ui/video-manager.js';

/**
 * Initialize the application
 */
function initializeApp() {
    console.log('🚀 Initializing iMaCoMpUtERussy Emulator...');
    console.log('DOM ready state:', document.readyState);
    
    try {
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
            console.log('✓ Memory viewer initialized');
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
export { initializeApp };
