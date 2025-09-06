/**
 * MCP Resilience Test Suite
 * Tests error recovery, retries, circuit breaker, and offline mode
 */

import { initializeMCPIntegration } from '../js/mcp-client.js';

// Wait for DOM and MCP initialization
async function waitForInitialization() {
  return new Promise((resolve) => {
    if (document.readyState === 'complete' && window.mcpClient) {
      resolve();
    } else {
      window.addEventListener('load', () => {
        setTimeout(resolve, 2000); // Give MCP time to initialize
      });
    }
  });
}

// Simulate network failure by overriding fetch
function simulateNetworkFailure(failureRate = 0.8, duration = 10000) {
  const originalFetch = window.fetch;
  let failures = 0;
  
  window.fetch = async (...args) => {
    if (Math.random() < failureRate && failures < 5) {
      failures++;
      console.warn(`🌐 Simulating network failure ${failures}/5 for:`, args[0]);
      throw new TypeError(`Network error: Simulated failure for ${args[0]}`);
    }
    return originalFetch.apply(this, args);
  };
  
  console.log(`🧪 Network simulation started: ${failureRate * 100}% failure rate for ${duration}ms`);
  setTimeout(() => {
    window.fetch = originalFetch;
    console.log('✅ Network simulation ended');
  }, duration);
}

// Test 1: Client-side retries
async function testClientRetries() {
  console.log('🧪 Test 1: Client-side retries');
  
  try {
    simulateNetworkFailure(0.8, 8000); // 80% failure for 8 seconds
    
    const result = await window.mcpClient.resilientFetch('/mcp/health', { method: 'GET' }, 3, 1000, 'health_test');
    const response = await result.json();
    
    console.log('✅ Retry test passed:', response);
    window.feedbackSystem.showToast('Retry test successful', 'success');
  } catch (error) {
    console.error('❌ Retry test failed:', error);
    window.feedbackSystem.showToast(error, 'error');
  }
}

// Test 2: Offline mode and local CPU simulation
async function testOfflineMode() {
  console.log('🧪 Test 2: Offline mode with local CPU simulation');
  
  const originalAvailable = window.mcpClient.serverAvailable;
  window.mcpClient.serverAvailable = false; // Force offline mode
  
  try {
    // Test CPU operations in offline mode
    const resetResult = await window.mcpClient.resetCPU(true);
    console.log('Local CPU reset:', resetResult);
    
    const stepResult = await window.mcpClient.stepCPU(5);
    console.log('Local CPU step:', stepResult);
    
    const stateResult = await window.mcpClient.getCPUState();
    console.log('Local CPU state:', stateResult);
    
    window.feedbackSystem.showToast('Offline mode test successful', 'success');
  } catch (error) {
    console.error('❌ Offline mode test failed:', error);
    window.feedbackSystem.showToast(error, 'error');
  } finally {
    window.mcpClient.serverAvailable = originalAvailable; // Restore original state
  }
}

// Test 3: Validation error handling
async function testValidationErrors() {
  console.log('🧪 Test 3: Validation error handling');
  
  try {
    // Test invalid memory address
    const invalidMemoryResult = await window.mcpClient.resilientFetch('/mcp/memory/read', {
      method: 'POST',
      body: JSON.stringify({ address: 0x10000, size: 1 }) // Invalid address
    }, 1, 0, 'validation_test');
    
    console.error('Expected validation error but got success');
  } catch (error) {
    if (error.isMCPError && error.code === 'MEMORY_OUT_OF_BOUNDS') {
      console.log('✅ Validation error caught correctly:', error.code);
      window.feedbackSystem.showToast(error, 'info'); // Should show as error toast
    } else {
      console.error('❌ Expected MEMORY_OUT_OF_BOUNDS but got:', error);
    }
  }
  
  try {
    // Test invalid CPU steps
    const invalidCPUStep = await window.mcpClient.resilientFetch('/mcp/cpu/step', {
      method: 'POST',
      body: JSON.stringify({ steps: -1 }) // Invalid negative steps
    }, 1, 0, 'validation_test');
    
    console.error('Expected validation error but got success');
  } catch (error) {
    if (error.isMCPError && error.code === 'INVALID_REQUEST') {
      console.log('✅ CPU validation error caught correctly:', error.code);
      window.feedbackSystem.showToast(error, 'info');
    } else {
      console.error('❌ Expected INVALID_REQUEST but got:', error);
    }
  }
}

// Test 4: Queue operation and replay
async function testQueueReplay() {
  console.log('🧪 Test 4: Queue operations and localStorage replay');
  
  try {
    // Add operation to queue (will fail due to simulated network issues)
    simulateNetworkFailure(1.0, 3000); // 100% failure for 3 seconds
    
    await window.mcpClient.resilientFetch('/mcp/queue/add', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test queue operation', type: 'testing' })
    }, 3, 1000, 'queue_test', true); // This should queue for replay
    
  } catch (error) {
    console.log('Expected queue failure (queued for replay):', error.message);
  }
  
  // Wait a moment then check queue
  setTimeout(async () => {
    const queue = JSON.parse(localStorage.getItem('mcp_operation_queue') || '[]');
    console.log(`📋 Queue has ${queue.length} items after failure`);
    
    if (queue.length > 0) {
      window.feedbackSystem.showToast(`${queue.length} operations queued for replay`, 'warn');
    }
    
    // Manually trigger replay
    await window.mcpClient.replayQueuedOperations();
  }, 4000);
}

// Test 5: WebSocket reconnection simulation
async function testWebSocketReconnect() {
  console.log('🧪 Test 5: WebSocket reconnection simulation');
  
  if (!window.mcpWebSocket) {
    console.log('⏭️ Skipping WebSocket test - not connected');
    return;
  }
  
  // Close WebSocket to trigger reconnection
  console.log('🔌 Closing WebSocket to test reconnection...');
  window.mcpWebSocket.close(1000, 'Test reconnection');
  
  // Wait for reconnection attempt
  setTimeout(() => {
    if (window.mcpWebSocket.readyState === WebSocket.OPEN) {
      console.log('✅ WebSocket reconnection successful');
      window.feedbackSystem.showToast('WebSocket reconnected successfully', 'success');
    } else {
      console.log('❌ WebSocket reconnection failed or still in progress');
      window.feedbackSystem.showToast('WebSocket reconnection test incomplete', 'warn');
    }
  }, 5000);
}

// Test 6: Circuit breaker status monitoring
async function testCircuitBreaker() {
  console.log('🧪 Test 6: Circuit breaker status monitoring');
  
  try {
    // Make multiple failing requests to potentially trip circuit breaker
    for (let i = 0; i < 6; i++) {
      try {
        simulateNetworkFailure(1.0, 100); // Brief 100% failure
        await window.mcpClient.resilientFetch('/mcp/health', { method: 'GET' }, 0, 0, 'circuit_test');
      } catch (error) {
        console.log(`Circuit test attempt ${i + 1} failed (expected):`, error.message);
      }
    }
    
    // Check if server reports circuit breaker status
    const healthResponse = await window.mcpClient.resilientFetch('/mcp/health', { method: 'GET' }, 1, 1000, 'health_check');
    const health = await healthResponse.json();
    
    if (health.circuitBreaker) {
      console.log('🔌 Circuit breaker status:', health.circuitBreaker);
      Object.entries(health.circuitBreaker).forEach(([service, status]) => {
        if (status.state === 'OPEN') {
          console.log(`🛑 Circuit breaker OPEN for ${service}`);
          window.feedbackSystem.showToast(`Circuit breaker OPEN for ${service}`, 'error');
        }
      });
    }
  } catch (error) {
    console.error('❌ Circuit breaker test failed:', error);
  }
}

// Main test runner
async function runResilienceTests() {
  console.log('🚀 Starting MCP Resilience Test Suite');
  console.log('📱 Ensure the browser console and UI toasts are visible for test results');
  
  await waitForInitialization();
  
  // Run tests sequentially
  await testClientRetries();
  await new Promise(resolve => setTimeout(resolve, 10000)); // Wait for retries to complete
  
  await testOfflineMode();
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await testValidationErrors();
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await testQueueReplay();
  await new Promise(resolve => setTimeout(resolve, 10000)); // Wait for replay
  
  await testWebSocketReconnect();
  await new Promise(resolve => setTimeout(resolve, 8000)); // Wait for reconnection
  
  await testCircuitBreaker();
  
  console.log('✅ MCP Resilience Test Suite completed');
  window.feedbackSystem.showToast('All resilience tests completed - check console for details', 'success');
}

// Auto-run tests when script loads (for verification)
if (typeof window !== 'undefined') {
  // Run tests 5 seconds after page load to ensure everything is initialized
  window.addEventListener('load', () => {
    setTimeout(runResilienceTests, 5000);
  });
  
  // Export for manual execution
  window.runResilienceTests = runResilienceTests;
}

// Node.js execution (if run from terminal)
if (typeof require !== 'undefined' && require.main === module) {
  // For Node.js execution, we'll need to mock browser globals
  console.log('Running in Node.js mode - browser-specific tests will be skipped');
  console.log('Please run this test in a browser environment for full verification');
  console.log('The implemented features can be verified by:');
  console.log('1. Opening the application in browser');
  console.log('2. Opening browser console');
  console.log('3. Executing: runResilienceTests()');
  console.log('4. Observing console logs and UI toasts');
}

// Export for module usage
export { runResilienceTests, testClientRetries, testOfflineMode, testValidationErrors, testQueueReplay, testWebSocketReconnect, testCircuitBreaker };