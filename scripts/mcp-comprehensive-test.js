#!/usr/bin/env node

// Comprehensive MCP test script
// Tests the full end-to-end flow: load program -> assemble -> load bytecode -> run -> verify output
// Usage: node scripts/mcp-comprehensive-test.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = process.env.MCP_BASE || 'http://localhost:8001';
const API_KEY = process.env.MCP_API_KEY || 'default-api-key-change-in-production';

class MCPTestRunner {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.startTime = Date.now();
    this.logs = [];
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, data };
    this.logs.push(logEntry);

    const prefix = `[${timestamp}] ${level.toUpperCase()}:`;
    console.log(`${prefix} ${message}`);
    if (data) {
      console.log(`${prefix} ${JSON.stringify(data, null, 2)}`);
    }
  }

  async makeRequest(method, endpoint, body = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey
    };

    this.log('info', `Making ${method} request to ${url}`, body || {});

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
      });

      const responseBody = response.status === 200 ? await response.json() : await response.text();

      if (response.ok) {
        this.log('info', `Request successful (${response.status})`, responseBody);
        return { success: true, status: response.status, data: responseBody };
      } else {
        this.log('error', `Request failed (${response.status})`, responseBody);
        return { success: false, status: response.status, error: responseBody };
      }
    } catch (error) {
      this.log('error', `Request error: ${error.message}`, error);
      return { success: false, error: error.message };
    }
  }

  async loadProgramSource() {
    try {
      const programPath = path.join(__dirname, '..', 'samples', 'hello-world.asm');
      const source = fs.readFileSync(programPath, 'utf8');
      this.log('info', 'Loaded hello-world program source', {
        path: programPath,
        length: source.length,
        preview: source.substring(0, 100) + '...'
      });
      return source;
    } catch (error) {
      this.log('error', 'Failed to load program source', error);
      throw error;
    }
  }

  async step1_loadProgram() {
    this.log('info', '=== STEP 1: Loading hello-world program from samples/ ===');
    try {
      const source = await this.loadProgramSource();
      this.programSource = source;
      return { success: true, source };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async step2_assembleSource() {
    this.log('info', '=== STEP 2: Assembling source using /assemble/source ===');
    const assembleRequest = {
      source: this.programSource,
      origin: 0x0600  // As specified in the assembly file
    };

    const result = await this.makeRequest('POST', '/mcp/assemble/source', assembleRequest);

    if (result.success) {
      this.assembledBytes = result.data.data.bytes;
      this.origin = result.data.data.origin;
      return { success: true, bytes: this.assembledBytes, origin: this.origin };
    }

    return { success: false, error: result.error };
  }

  async step3_loadBytecode() {
    this.log('info', '=== STEP 3: Loading assembled bytecode using /memory/loadProgram ===');
    const loadRequest = {
      bytecode: this.assembledBytes,
      startAddress: this.origin
    };

    const result = await this.makeRequest('POST', '/mcp/memory/loadProgram', loadRequest);

    if (result.success) {
      // Defensive parsing: server adapters may wrap results in different shapes
      // e.g., { success:true, data: { success:true, data: { startAddress... } } }
      let loadedInfo = undefined;
      try {
        if (result.data && result.data.data) loadedInfo = result.data.data;
        else if (result.data) loadedInfo = result.data;
        else loadedInfo = result;
      } catch (e) {
        loadedInfo = result;
      }

      // Validate loadedInfo and avoid calling toString on undefined
      const bytesLoaded = loadedInfo && (loadedInfo.bytesLoaded || loadedInfo.byteCount || (loadedInfo.data && loadedInfo.data.bytesLoaded));
      const startAddr = loadedInfo && (loadedInfo.startAddress || loadedInfo.start || (loadedInfo.data && loadedInfo.data.startAddress));

      if (!startAddr || !bytesLoaded) {
        this.log('error', 'Unexpected loadProgram response shape', { result });
        return { success: false, error: 'Unexpected loadProgram response shape', result };
      }

      this.log('info', 'Program loaded successfully', {
        bytesLoaded,
        startAddress: `0x${parseInt(startAddr, 10).toString(16)}`,
        endAddress: `0x${(parseInt(startAddr, 10) + bytesLoaded - 1).toString(16)}`
      });

      return { success: true, loadedInfo };
    }

    return { success: false, error: result.error };
  }

  async step4_runProgram() {
    this.log('info', '=== STEP 4: Running program using /cpu/run ===');
    const runRequest = {
      maxSteps: 1000,
      stepDelay: 1,
      breakOnHalt: true
    };

    const result = await this.makeRequest('POST', '/mcp/cpu/run', runRequest);

    if (result.success) {
      // Defensive parsing of response shape (accept single or nested adapter wrappers)
      let runInfo = undefined;
      try {
        if (result.data && result.data.data) runInfo = result.data.data;
        else if (result.data) runInfo = result.data;
        else if (result && result.data) runInfo = result.data;
        else runInfo = result;
      } catch (e) {
        runInfo = result;
      }

      // Normalize fields: some implementations place final PC in finalPC or finalState.pc
      const normalized = {
        stepsExecuted: runInfo && (runInfo.stepsExecuted || runInfo.data && runInfo.data.stepsExecuted) || 0,
        totalCycles: runInfo && (runInfo.totalCycles || (runInfo.data && runInfo.data.totalCycles)) || null,
        halted: runInfo && (typeof runInfo.halted !== 'undefined' ? runInfo.halted : (runInfo.data && runInfo.data.halted)),
        finalState: runInfo && (runInfo.finalState || (runInfo.data && runInfo.data.finalState)) || null,
        finalPC: runInfo && (typeof runInfo.finalPC !== 'undefined' ? runInfo.finalPC : (runInfo.finalState && runInfo.finalState.pc))
      };

      if (typeof normalized.finalPC === 'undefined' || normalized.finalPC === null) {
        this.log('error', 'Unexpected cpu/run response shape (missing finalPC)', { result });
        return { success: false, error: 'Unexpected cpu/run response shape', result };
      }

      this.log('info', 'Program execution completed', {
        stepsExecuted: normalized.stepsExecuted,
        halted: normalized.halted,
        finalPC: `0x${parseInt(normalized.finalPC, 10).toString(16)}`
      });

      return { success: true, runInfo: normalized };
    }

    return { success: false, error: result.error };
  }

  async step5_readTerminalOutput() {
    this.log('info', '=== STEP 5: Reading terminal output using /terminal/read ===');

    // Wait a moment for output to be written
    await new Promise(resolve => setTimeout(resolve, 100));

    const result = await this.makeRequest('GET', '/mcp/terminal/read');

    if (result.success) {
      const terminalData = result.data.data;
      this.log('info', 'Terminal output read', {
        input: terminalData.input,
        bytesRead: terminalData.bytesRead,
        hasInput: terminalData.hasInput
      });

      // Check if we got "Hello World!"
      const expectedOutput = "Hello World!";
      const actualOutput = terminalData.input.trim();
      const outputCorrect = actualOutput === expectedOutput;

      this.log(outputCorrect ? 'info' : 'error', 'Output verification', {
        expected: expectedOutput,
        actual: actualOutput,
        correct: outputCorrect
      });

      // Treat incorrect output as a failed step so final report.success becomes false
      if (!outputCorrect) {
        return { success: false, terminalData, outputCorrect };
      }

      return { success: true, terminalData, outputCorrect };
    }

    return { success: false, error: result.error };
  }

  async step6_reportResults() {
    this.log('info', '=== STEP 6: Generating comprehensive test report ===');

    const endTime = Date.now();
    const duration = endTime - this.startTime;

    const report = {
      testName: 'MCP Comprehensive End-to-End Test',
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      baseUrl: this.baseUrl,
      apiKeyUsed: this.apiKey ? '***provided***' : 'default',
      steps: this.logs.filter(log => log.message.startsWith('=== STEP')),
      totalSteps: 6,
      success: this.results.every(r => r.success),
      results: this.results,
      logCount: this.logs.length
    };

    this.log('info', 'Test completed', report);

    return report;
  }

  async runTest() {
    this.log('info', 'Starting MCP comprehensive end-to-end test', {
      baseUrl: this.baseUrl,
      apiKeyConfigured: !!this.apiKey
    });

    this.results = [];

    // Execute all steps
    const step1 = await this.step1_loadProgram();
    this.results.push(step1);

    if (!step1.success) {
      this.log('error', 'Test failed at step 1, aborting');
      return await this.step6_reportResults();
    }

    const step2 = await this.step2_assembleSource();
    this.results.push(step2);

    if (!step2.success) {
      this.log('error', 'Test failed at step 2, aborting');
      return await this.step6_reportResults();
    }

    const step3 = await this.step3_loadBytecode();
    this.results.push(step3);

    if (!step3.success) {
      this.log('error', 'Test failed at step 3, aborting');
      return await this.step6_reportResults();
    }

    const step4 = await this.step4_runProgram();
    this.results.push(step4);

    if (!step4.success) {
      this.log('error', 'Test failed at step 4, aborting');
      return await this.step6_reportResults();
    }

    const step5 = await this.step5_readTerminalOutput();
    this.results.push(step5);

    // Always generate report
    return await this.step6_reportResults();
  }
}

// Main execution
async function main() {
  const testRunner = new MCPTestRunner(BASE, API_KEY);

  try {
    const report = await testRunner.runTest();

    // Exit with appropriate code
    const exitCode = report && report.success ? 0 : 1;
    console.log(`\nTest ${report && report.success ? 'PASSED' : 'FAILED'} (exit code: ${exitCode})`);
    // Avoid abrupt process.exit which can cause libuv handle assertion failures on Windows
    // Set exitCode and return normally so Node can drain handles gracefully.
    process.exitCode = exitCode;
    return report;

  } catch (error) {
    // Log full error stack or a serializable representation
    let errInfo = error;
    try {
      if (error && error.stack) errInfo = error.stack;
      else if (typeof error === 'object') errInfo = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
      else errInfo = String(error);
    } catch (e) {
      errInfo = String(error);
    }
    testRunner.log('error', 'Test execution failed', errInfo);
    process.exitCode = 2;
    return null;
  }
}

// Run if called directly (cross-platform)
// On Windows process.argv[1] contains a backslash path like "C:\path\to\file"
// which doesn't equal import.meta.url (file:///C:/path/to/file). Construct
// a normalized file:// URL from process.argv[1] and compare. Also allow
// forcing execution with env var FORCE_RUN=1 for CI/debugging.
const _scriptUrlFromArg = (() => {
  try {
    if (!process.argv[1]) return null;
    if (process.argv[1].startsWith('file://')) return process.argv[1];
    const resolved = path.resolve(process.argv[1]);
    // Replace backslashes with forward slashes and ensure leading slash for drive letters
    const normalized = resolved.replace(/\\/g, '/').replace(/^([A-Za-z]:)/, '/$1');
    return `file://${normalized}`;
  } catch (e) {
    return null;
  }
})();

if (import.meta.url === _scriptUrlFromArg || process.env.FORCE_RUN === '1') {
  main();
}