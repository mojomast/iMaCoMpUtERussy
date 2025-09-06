import { initializeMCPIntegration } from './js/mcp-client.js';

// Make it globally available and call it
window.initializeMCPIntegration = initializeMCPIntegration;
if (window.coreInitialized) {
  initializeMCPIntegration();
} else {
  window.addEventListener('coreinitialized', () => initializeMCPIntegration());
}

console.log('✅ Browser-side MCP client loaded successfully');
console.log('MCP client available globally:', typeof window.mcpClient);