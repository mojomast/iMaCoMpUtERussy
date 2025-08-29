/**
 * iMaCoMpUtERussy Autonomous Software Generation Agent
 *
 * An intelligent AI agent that autonomously processes queued prompts to generate,
 * test, and save software using the MCP server infrastructure. This agent
 * builds on the existing robust MCP client and queue management systems.
 *
 * Features:
 * - Continuous queue processing and task routing
 * - Multi-pipeline workflow management (generation, testing, optimization, debugging)
 * - Advanced natural language understanding for task classification
 * - Learning and self-improvement capabilities
 * - Comprehensive error handling and recovery
 * - Performance monitoring and optimization
 * - Interactive debugging workflows
 *
 * @version 1.0.0
 * @author Kyle Durepos (via Roo Code)
 * @license MIT
 */

import { MCPClient, createAIClient } from '../lib/mcp-client.js';
import PromptQueue from './queue-manager.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @class AutonomousSoftwareAgent
 * @description Main autonomous agent class that orchestrates software generation
 *
 * This class integrates all components:
 * - MCP client for emulator interactions
 * - Queue manager for task processing
 * - Learning system for continuous improvement
 * - Workflow pipelines for different task types
 */
export class AutonomousSoftwareAgent {
  constructor(options = {}) {
    this.options = {
      mcpServerUrl: options.mcpServerUrl || 'http://localhost:8001',
      processingInterval: options.processingInterval || 2000, // 2 seconds
      maxRetries: options.maxRetries || 3,
      learningEnabled: options.learningEnabled !== false,
      autoRecovery: options.autoRecovery !== false,
      maxConcurrentTasks: options.maxConcurrentTasks || 1,
      learningModelPath: options.learningModelPath || path.join(__dirname, '..', 'data', 'agent-learning.json'),
      ...options
    };

    // Initialize core components
    this.mcpClient = createAIClient(this.options.mcpServerUrl);
    this.queue = new PromptQueue({
      queueFile: options.queueFile,
      autoSave: true
    });

    // Initialize agent state
    this.running = false;
    this.processingTasks = new Map(); // Track concurrent tasks
    this.stats = {
      tasksProcessed: 0,
      tasksSuccessful: 0,
      tasksFailed: 0,
      averageProcessingTime: 0,
      lastProcessedTask: null,
      uptimeStarted: new Date()
    };

    // Load learning data
    this.learningModel = this.loadLearningModel();

    // Task type classifiers
    this.taskClassifiers = this.initializeTaskClassifiers();

    // Bind methods
    this.processNextTask = this.processNextTask.bind(this);
    this.handleTask = this.handleTask.bind(this);
  }

  /**
   * Start the autonomous agent
   * @param {Object} config - Runtime configuration
   */
  async start(config = {}) {
    if (this.running) {
      console.warn('Agent is already running');
      return;
    }

    console.log('🚀 Starting Autonomous Software Generation Agent...');
    this.running = true;
    this.stats.uptimeStarted = new Date();

    try {
      // Ensure MCP server is accessible
      await this.verifyMCPConnection();

      console.log('✅ MCP connection verified');
      console.log('📋 Starting queue processing loop...');

      // Main processing loop
      this.processingIntervalId = setInterval(async () => {
        try {
          if (this.processingTasks.size < this.options.maxConcurrentTasks) {
            await this.processNextTask();
          }
        } catch (error) {
          console.error('❌ Error in processing loop:', error.message);
        }
      }, this.options.processingInterval);

      console.log('🎯 Agent started successfully. Monitoring queue for tasks...');

    } catch (error) {
      console.error('❌ Failed to start agent:', error.message);
      this.running = false;
      throw error;
    }
  }

  /**
   * Stop the autonomous agent
   */
  async stop() {
    if (!this.running) {
      return;
    }

    console.log('🛑 Stopping Autonomous Software Generation Agent...');
    this.running = false;

    if (this.processingIntervalId) {
      clearInterval(this.processingIntervalId);
    }

    // Wait for any running tasks to complete
    const runningTasks = Array.from(this.processingTasks.values());
    if (runningTasks.length > 0) {
      console.log(`⏳ Waiting for ${runningTasks.length} tasks to complete...`);
      await Promise.allSettled(runningTasks);
    }

    // Save learning model
    if (this.options.learningEnabled) {
      this.saveLearningModel();
    }

    console.log('✅ Agent stopped successfully');
  }

  /**
   * Process the next task from the queue
   */
  async processNextTask() {
    try {
      const task = await this.queue.getNextPrompt();
      if (!task) {
        return; // No tasks available
      }

      console.log(`📋 Processing task ${task.id}: ${task.prompt.substring(0, 50)}...`);

      // Submit task for processing (don't await to allow concurrency)
      const taskPromise = this.handleTask(task);
      this.processingTasks.set(task.id, taskPromise);

      // Clean up when task completes
      taskPromise.finally(() => {
        this.processingTasks.delete(task.id);
      });

    } catch (error) {
      console.error('❌ Error getting next task:', error.message);
    }
  }

  /**
   * Handle a single task with retry logic and learning
   * @param {Object} task - Task object from queue
   */
  async handleTask(task) {
    const startTime = Date.now();
    let attempts = 0;

    while (attempts < this.options.maxRetries) {
      try {
        attempts++;

        // Classify task type if not already set
        if (!task.type || task.type === 'custom') {
          task.type = this.classifyTaskType(task.prompt);
          console.log(`🔍 Classified task as: ${task.type}`);
        }

        // Route to appropriate handler
        let result;
        switch (task.type) {
          case 'generation':
            result = await this.handleGenerationTask(task);
            break;
          case 'optimization':
            result = await this.handleOptimizationTask(task);
            break;
          case 'testing':
            result = await this.handleTestingTask(task);
            break;
          case 'debugging':
            result = await this.handleDebuggingTask(task);
            break;
          case 'educational':
            result = await this.handleEducationalTask(task);
            break;
          default:
            throw new Error(`Unknown task type: ${task.type}`);
        }

        // Update success metrics
        const processingTime = Date.now() - startTime;
        this.updateSuccessMetrics(task.type, processingTime);

        // Save successful result
        await this.saveResult(task, result);

        // Update task status
        await this.queue.updatePromptStatus(task.id, 'completed', {
          result,
          processingTime,
          attempts,
          completedAt: new Date().toISOString()
        });

        console.log(`✅ Task ${task.id} completed successfully in ${processingTime}ms`);

        // Learn from successful task
        if (this.options.learningEnabled) {
          this.learnFromSuccess(task, result);
        }

        return result;

      } catch (error) {
        console.error(`❌ Task ${task.id} attempt ${attempts} failed:`, error.message);

        if (attempts >= this.options.maxRetries) {
          // Final failure - mark task as failed
          await this.queue.updatePromptStatus(task.id, 'failed', {
            error: error.message,
            attempts,
            processingTime: Date.now() - startTime,
            failedAt: new Date().toISOString()
          });

          this.stats.tasksFailed++;

          // Learn from failure
          if (this.options.learningEnabled) {
            this.learnFromFailure(task, error);
          }
        } else {
          // Prepare for retry with exponential backoff
          const backoffDelay = Math.min(1000 * Math.pow(2, attempts - 1), 30000);
          console.log(`⏳ Retrying task ${task.id} in ${backoffDelay}ms...`);
          await this.delay(backoffDelay);
        }
      }
    }
  }

  /**
   * Handle generation tasks (create new software)
   */
  async handleGenerationTask(task) {
    console.log(`🎨 Generating assembly for: ${task.prompt.substring(0, 50)}...`);

    try {
      // Parse natural language specification
      const spec = await this.parseSpecification(task.prompt);

      // Generate initial assembly code using MCP client's AI capabilities
      const result = await this.mcpClient.generateAssembly(spec.description, {
        requirements: spec.requirements,
        constraints: spec.constraints
      });

      // Test the generated code
      const validation = await this.validateAssembly(result.source, spec.testCases);

      // If tests fail, attempt debugging and fixes
      if (!validation.allPassed) {
        console.log(`🛠️  ${validation.passed}/${validation.total} tests failed. Attempting to fix...`);
        const fixed = await this.attemptFix(result.source, validation.errors, spec);
        result.source = fixed;
        result.fixesAttempted = true;
      }

      // Optimize if requested
      if (spec.optimize) {
        const optimized = await this.mcpClient.optimizeAssembly(result.source, {
          minimizeSize: spec.constraints.sizeCritical,
          minimizeCycles: spec.constraints.speedCritical
        });
        result.optimized = optimized;
      }

      return {
        type: 'generation',
        specification: spec,
        generated: result,
        validation: validation,
        ready: validation.allPassed
      };

    } catch (error) {
      throw new Error(`Generation failed: ${error.message}`);
    }
  }

  /**
   * Handle optimization tasks (improve existing programs)
   */
  async handleOptimizationTask(task) {
    console.log(`⚡ Optimizing program for: ${task.prompt.substring(0, 50)}...`);

    try {
      const spec = await this.parseSpecification(task.prompt);

      // Expect program name or source in task
      let sourceCode;
      if (spec.programName) {
        // Load existing program
        const program = await this.mcpClient.loadProgram(spec.programName);
        sourceCode = program.source;
      } else if (spec.sourceHint) {
        sourceCode = spec.sourceHint;
      } else {
        throw new Error('Optimization task must specify program name or include source');
      }

      // Perform optimization
      const optimized = await this.mcpClient.optimizeAssembly(sourceCode, {
        criteria: spec.optimizationCriteria || {}
      });

      // Test optimization
      const originalResult = await this.testAssembly(sourceCode);
      const optimizedResult = await this.testAssembly(optimized.optimized.source);

      return {
        type: 'optimization',
        original: {
          source: sourceCode,
          metrics: originalResult.metrics
        },
        optimized: {
          source: optimized.optimized.source,
          metrics: optimizedResult.metrics,
          improvements: optimized.improvements
        },
        improvements: optimized.improvements
      };

    } catch (error) {
      throw new Error(`Optimization failed: ${error.message}`);
    }
  }

  /**
   * Handle testing tasks (validate software)
   */
  async handleTestingTask(task) {
    console.log(`🧪 Testing program for: ${task.prompt.substring(0, 50)}...`);

    try {
      const spec = await this.parseSpecification(task.prompt);

      let sourceCode;
      if (spec.programName) {
        const program = await this.mcpClient.loadProgram(spec.programName);
        sourceCode = program.source;
      } else if (spec.sourceHint) {
        sourceCode = spec.sourceHint;
      }

      if (!sourceCode) {
        throw new Error('Testing task must specify program or include source');
      }

      // Extract or generate test cases
      const testCases = spec.testCases || await this.extractTestCases(task.prompt);

      // Perform comprehensive testing
      const testResult = await this.mcpClient.testAssembly(sourceCode, testCases);

      // Perform additional validation
      const additionalValidation = await this.performAdditionalTesting(sourceCode, spec);

      return {
        type: 'testing',
        program: {
          name: spec.programName,
          source: sourceCode
        },
        tests: testResult,
        additional: additionalValidation,
        performance: additionalValidation.performance || {}
      };

    } catch (error) {
      throw new Error(`Testing failed: ${error.message}`);
    }
  }

  /**
   * Handle debugging tasks (fix issues)
   */
  async handleDebuggingTask(task) {
    console.log(`🐛 Debugging program for: ${task.prompt.substring(0, 50)}...`);

    try {
      const spec = await this.parseSpecification(task.prompt);

      let sourceCode, currentState;
      if (spec.programName) {
        const program = await this.mcpClient.loadProgram(spec.programName);
        sourceCode = program.source;
        // Load and setup for debugging
        const assembled = await this.mcpClient.assemble(sourceCode);
        await this.mcpClient.loadProgramToMemory(assembled.bytecode);
        currentState = assembled;
      }

      // Get debugging context from prompt
      const debugContext = await this.extractDebuggingContext(task.prompt);

      // Perform debugging workflow
      const debugResult = await this.performInteractiveDebugging(sourceCode, debugContext);

      return {
        type: 'debugging',
        original: {
          source: sourceCode,
          state: currentState
        },
        issues: debugContext.issues,
        fixes: debugResult.fixes,
        finalSource: debugResult.fixedSource,
        debugTrace: debugResult.trace
      };

    } catch (error) {
      throw new Error(`Debugging failed: ${error.message}`);
    }
  }

  /**
   * Handle educational tasks (create learning examples)
   */
  async handleEducationalTask(task) {
    console.log(`📚 Creating educational content for: ${task.prompt.substring(0, 50)}...`);

    try {
      const spec = await this.parseSpecification(task.prompt);

      // Generate comprehensive learning example
      const example = await this.generateEducationalExample(spec);

      // Create supporting materials
      const materials = await this.generateSupportingMaterials(example, spec);

      return {
        type: 'educational',
        concept: spec.educationalConcept,
        example: example,
        materials: materials,
        learningObjectives: spec.learningObjectives,
        difficulty: spec.difficulty || 'intermediate'
      };

    } catch (error) {
      throw new Error(`Educational content generation failed: ${error.message}`);
    }
  }

  /**
   * Parse natural language specification into structured format
   */
  async parseSpecification(prompt) {
    // Enhanced NLP parsing with machine learning insights
    const learningPatterns = this.learningModel.parsing.patterns || {};

    const spec = {
      description: prompt,
      type: this.classifyTaskType(prompt),
      requirements: [],
      constraints: {},
      testCases: [],
      optimize: false,
      difficulty: 'intermediate'
    };

    // Extract common patterns using learning model
    const patterns = {
      'create|generate|make|build': () => spec.type = 'generation',
      'optimize|improve|speed|size|enhance': () => {
        spec.type = 'optimization';
        spec.optimize = true;
      },
      'test|validate|verify|check': () => spec.type = 'testing',
      'debug|fix|repair|troubleshoot': () => spec.type = 'debugging',
      'learn|teach|example|tutorial': () => spec.type = 'educational'
    };

    // Apply learned patterns
    Object.entries(learningPatterns).forEach(([pattern, action]) => {
      if (prompt.toLowerCase().includes(pattern.toLowerCase())) {
        if (action === 'generation') spec.type = 'generation';
        if (action === 'optimization') spec.optimize = true;
        if (action === 'testing') spec.type = 'testing';
        if (action === 'debugging') spec.type = 'debugging';
        if (action === 'educational') spec.type = 'educational';
      }
    });

    // Extract constraints from prompt
    if (prompt.match(/\bsmall|tiny|compact\b/i)) {
      spec.constraints.sizeCritical = true;
    }
    if (prompt.match(/\bfast|quick|speed\b/i)) {
      spec.constraints.speedCritical = true;
    }

    // Extract memory requirements
    const memoryMatch = prompt.match(/memory[:\s]*(\d+)/i);
    if (memoryMatch) {
      spec.constraints.maxMemory = parseInt(memoryMatch[1]);
    }

    return spec;
  }

  /**
   * Classify task type using multiple strategies
   */
  classifyTaskType(prompt) {
    const classifiers = this.taskClassifiers;

    // Try multiple classification strategies
    for (const classifier of classifiers) {
      const result = classifier.classify(prompt);
      if (result.confidence > 0.7) {
        return result.type;
      }
    }

    // Default classification
    if (prompt.match(/\b(create|generate|make|build)\b/i)) return 'generation';
    if (prompt.match(/\b(optimize|improve|enhance)\b/i)) return 'optimization';
    if (prompt.match(/\b(test|validate|check)\b/i)) return 'testing';
    if (prompt.match(/\b(debug|fix|repair)\b/i)) return 'debugging';
    if (prompt.match(/\b(learn|teach|example)\b/i)) return 'educational';

    return 'generation'; // Default
  }

  /**
   * Validate assembly code thoroughly
   */
  async validateAssembly(sourceCode, expectedTestCases = []) {
    const result = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: [],
      allPassed: false
    };

    try {
      // First, ensure code assembles
      const assembled = await this.mcpClient.assemble(sourceCode);
      if (!assembled.success) {
        result.errors.push(`Assembly failed: ${assembled.error}`);
        return result;
      }

      // Run test cases
      const testResults = await this.mcpClient.testAssembly(sourceCode, expectedTestCases);

      result.total = testResults.total;
      result.passed = testResults.passed;
      result.failed = testResults.failed;
      result.errors = testResults.results
        .filter(test => !test.passed)
        .map(test => test.error || 'Test failed');

      result.allPassed = result.failed === 0;

    } catch (error) {
      result.errors.push(`Validation error: ${error.message}`);
    }

    return result;
  }

  /**
   * Save result to MCP server's program storage
   */
  async saveResult(task, result) {
    try {
      const programName = `agent_generated_${task.id}`;
      let sourceCode = '';

      // Extract source code based on result type
      switch (result.type) {
        case 'generation':
          sourceCode = result.generated.source;
          break;
        case 'optimization':
          sourceCode = result.optimized.source;
          break;
        case 'debugging':
          sourceCode = result.finalSource;
          break;
        default:
          return; // No source to save
      }

      if (sourceCode) {
        await this.mcpClient.saveProgram(programName, sourceCode);
        console.log(`💾 Saved program: ${programName}`);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to save program: ${error.message}`);
    }
  }

  /**
   * Update success metrics and learning model
   */
  updateSuccessMetrics(taskType, processingTime) {
    this.stats.tasksProcessed++;
    this.stats.tasksSuccessful++;
    this.stats.lastProcessedTask = new Date();

    // Update average processing time
    const totalTime = (this.stats.averageProcessingTime * (this.stats.tasksSuccessful - 1)) + processingTime;
    this.stats.averageProcessingTime = totalTime / this.stats.tasksSuccessful;

    // Update type-specific metrics
    if (!this.learningModel.metrics.byType[taskType]) {
      this.learningModel.metrics.byType[taskType] = { count: 0, successRate: 0 };
    }
    this.learningModel.metrics.byType[taskType].count++;
  }

  /**
   * Learn from successful task completion
   */
  learnFromSuccess(task, result) {
    try {
      // Store successful patterns
      const patterns = this.extractPatterns(task.prompt);
      for (const pattern of patterns) {
        if (!this.learningModel.parsing.patterns[pattern]) {
          this.learningModel.parsing.patterns[pattern] = task.type;
          this.learningModel.parsing.successCount++;
        }
      }

      // Store successful strategies
      const successKey = `${task.type}_${result.ready ? 'working' : 'partial'}`;
      this.learningModel.strategies[successKey] = (this.learningModel.strategies[successKey] || 0) + 1;

    } catch (error) {
      console.warn(`⚠️  Learning update failed: ${error.message}`);
    }
  }

  /**
   * Learn from task failures
   */
  learnFromFailure(task, error) {
    try {
      // Store failure patterns for future avoidance
      const errorType = this.categorizeError(error);
      if (!this.learningModel.failures[errorType]) {
        this.learningModel.failures[errorType] = { count: 0, patterns: [] };
      }

      this.learningModel.failures[errorType].count++;

      // Extract prompt patterns that led to failure
      const patterns = this.extractFailurePatterns(task.prompt, error);
      for (const pattern of patterns) {
        if (!this.learningModel.failures[errorType].patterns.includes(pattern)) {
          this.learningModel.failures[errorType].patterns.push(pattern);
        }
      }

    } catch (learnError) {
      console.warn(`⚠️  Failure learning update failed: ${learnError.message}`);
    }
  }

  /**
   * Initialize task classifiers
   */
  initializeTaskClassifiers() {
    return [
      {
        name: 'keyword',
        classify: (prompt) => {
          const keywords = {
            generation: ['create', 'generate', 'make', 'build', 'new'],
            optimization: ['optimize', 'improve', 'enhance', 'faster', 'smaller'],
            testing: ['test', 'validate', 'verify', 'check', 'run'],
            debugging: ['debug', 'fix', 'repair', 'bug', 'error'],
            educational: ['learn', 'teach', 'example', 'tutorial', 'explain']
          };

          for (const [type, words] of Object.entries(keywords)) {
            const matches = words.filter(word => prompt.toLowerCase().includes(word));
            if (matches.length > 0) {
              return {
                type,
                confidence: matches.length / words.length
              };
            }
          }

          return { type: 'generation', confidence: 0.5 };
        }
      },
      {
        name: 'pattern',
        classify: (prompt) => {
          const patterns = {
            generation: /\b(create|generate|make|build|write)\b.*\b(program|code|assembly)\b/,
            optimization: /\b(optimize|improve|enhance|speed|size)\b.*\b(program|code)\b/,
            testing: /\b(test|validate|verify|check|run)\b.*\b(program|code)\b/,
            debugging: /\b(debug|fix|repair|troubleshoot)\b.*\b(program|code|bug)\b/,
            educational: /\b(learn|teach|example|tutorial|explain)\b/
          };

          for (const [type, pattern] of Object.entries(patterns)) {
            if (pattern.test(prompt.toLowerCase())) {
              return { type, confidence: 0.9 };
            }
          }

          return { type: 'generation', confidence: 0.3 };
        }
      }
    ];
  }

  /**
   * Load learning model from storage
   */
  loadLearningModel() {
    try {
      if (fs.existsSync(this.options.learningModelPath)) {
        const data = fs.readFileSync(this.options.learningModelPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to load learning model: ${error.message}`);
    }

    // Return default learning model
    return {
      parsing: {
        patterns: {},
        successCount: 0,
        failureCount: 0
      },
      strategies: {},
      failures: {},
      metrics: {
        byType: {},
        totalTasks: 0,
        successRate: 0
      },
      version: '1.0.0'
    };
  }

  /**
   * Save learning model to storage
   */
  saveLearningModel() {
    try {
      const dir = path.dirname(this.options.learningModelPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(
        this.options.learningModelPath,
        JSON.stringify(this.learningModel, null, 2)
      );
    } catch (error) {
      console.warn(`⚠️  Failed to save learning model: ${error.message}`);
    }
  }

  /**
   * Verify MCP server connection
   */
  async verifyMCPConnection() {
    try {
      const health = await this.mcpClient.healthCheck();
      if (!health.healthy) {
        throw new Error('MCP server is not healthy');
      }
      return true;
    } catch (error) {
      throw new Error(`MCP connection failed: ${error.message}`);
    }
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // ADVANCED IMPLEMENTATION METHODS
  // ============================================================================

  async attemptFix(sourceCode, errors, spec) {
    console.log('🔧 Attempting intelligent code fixes...');

    let fixedCode = sourceCode;
    const fixes = [];

    try {
      // Analyze errors and apply fixes
      for (const error of errors) {
        const fix = await this.analyzeAndFixError(error, fixedCode, spec);
        if (fix.applied) {
          fixedCode = fix.newCode;
          fixes.push({
            error: error,
            fix: fix.description,
            applied: true
          });
        } else {
          fixes.push({
            error: error,
            fix: 'No automatic fix available',
            applied: false
          });
        }
      }

      // Validate the fixed code
      const validation = await this.validateAssembly(fixedCode, spec.testCases || []);
      if (!validation.allPassed) {
        console.log(`⚠️  Fixed code validation failed: ${validation.passed}/${validation.total} tests passed`);
      }

      return {
        originalCode: sourceCode,
        fixedCode: fixedCode,
        fixesApplied: fixes.filter(f => f.applied).length,
        fixesAttempted: fixes.length,
        validation: validation,
        success: validation.allPassed
      };

    } catch (fixError) {
      console.warn(`⚠️  Fix attempt failed: ${fixError.message}`);
      return sourceCode; // Return original on error
    }
  }

  async analyzeAndFixError(error, sourceCode, spec) {
    const errorLower = error.toLowerCase();

    // Common error patterns and their fixes
    if (errorLower.includes('undefined label') || errorLower.includes('unknown label')) {
      return await this.fixUndefinedLabel(error, sourceCode);
    }

    if (errorLower.includes('instruction not found') || errorLower.includes('invalid mnemonic')) {
      return await this.fixInvalidInstruction(error, sourceCode);
    }

    if (errorLower.includes('memory out of bounds') || errorLower.includes('address out of range')) {
      return await this.fixMemoryBounds(error, sourceCode, spec);
    }

    if (errorLower.includes('syntax error') || errorLower.includes('invalid operand')) {
      return await this.fixSyntaxError(error, sourceCode);
    }

    // Default: no automatic fix available
    return {
      applied: false,
      reason: 'Unknown error type',
      newCode: sourceCode
    };
  }

  async fixUndefinedLabel(error, sourceCode) {
    // Extract label name from error message
    const labelMatch = error.match(/label ['"]([^'"]+)['"]/i);
    if (!labelMatch) return { applied: false, reason: 'Could not extract label name', newCode: sourceCode };

    const labelName = labelMatch[1];

    // Add label definition at the beginning of the code
    const lines = sourceCode.split('\n');
    lines.unshift(`${labelName}:`);

    return {
      applied: true,
      description: `Added missing label definition: ${labelName}`,
      newCode: lines.join('\n')
    };
  }

  async fixInvalidInstruction(error, sourceCode, spec) {
    // Try to replace with valid 6502 instructions
    const invalidMatch = error.match(/instruction ['"]([^'"]+)['"]/i);
    if (!invalidMatch) return { applied: false, reason: 'Could not identify invalid instruction', newCode: sourceCode };

    const invalidInst = invalidMatch[1].toUpperCase();

    // Common typos and their corrections
    const corrections = {
      'ADD': 'ADC',  // Add with carry
      'SUB': 'SBC',  // Subtract with carry
      'AND': 'AND',  // Already valid
      'OR': 'ORA',   // Logical OR
      'XOR': 'EOR',  // Exclusive OR
      'MOV': 'LDA',  // Move -> Load
      'JMP': 'JMP',  // Already valid
      'CMP': 'CMP',  // Already valid
      'INC': 'INC',  // Already valid
      'DEC': 'DEC'   // Already valid
    };

    const correction = corrections[invalidInst];
    if (!correction) {
      return { applied: false, reason: `No known correction for ${invalidInst}`, newCode: sourceCode };
    }

    const newCode = sourceCode.replace(new RegExp(`\\b${invalidInst}\\b`, 'g'), correction);

    return {
      applied: true,
      description: `Replaced invalid instruction ${invalidInst} with ${correction}`,
      newCode: newCode
    };
  }

  async testAssembly(sourceCode) {
    const testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      results: [],
      performance: {}
    };

    try {
      // Attempt to assemble the code
      const assembled = await this.mcpClient.assemble(sourceCode);

      if (!assembled.success) {
        testResults.results.push({
          test: 'assembly',
          passed: false,
          error: `Assembly failed: ${assembled.error}`
        });
        testResults.failed++;
        return testResults;
      }

      testResults.total++;
      testResults.passed++;

      // Test if the code can be loaded into memory
      await this.mcpClient.resetCPU();

      const loadResult = await this.mcpClient.loadProgramToMemory(assembled.bytecode);
      testResults.results.push({
        test: 'memory_load',
        passed: true,
        details: `Loaded ${loadResult.bytesLoaded} bytes to memory`
      });
      testResults.total++;
      testResults.passed++;

      // Basic execution test
      const execResult = await this.mcpClient.runCPU(10);
      testResults.results.push({
        test: 'basic_execution',
        passed: !execResult.halted || execResult.instructionCount > 0,
        details: `Executed ${execResult.instructionCount} instructions`
      });

      if (!execResult.halted && execResult.instructionCount > 0) {
        testResults.passed++;
      } else {
        testResults.failed++;
      }

      testResults.total++;
      testResults.performance = {
        bytecodeSize: assembled.sizeBytes,
        instructionCount: assembled.instructionCount,
        estimatedCycles: assembled.instructionCount * 3
      };

    } catch (testError) {
      testResults.results.push({
        test: 'general_test',
        passed: false,
        error: testError.message
      });
      testResults.failed++;
    }

    return testResults;
  }

  async extractTestCases(prompt) {
    const testCases = [];

    // Extract explicit test expectations from the prompt
    const testPatterns = [
      {
        pattern: /(?:should|must|will)\s+(load|store|display|print|calculate|compute|return)\s+(.+?)(?:\.|$)/gi,
        extractor: (match) => ({
          description: match.trim(),
          type: 'behavioral',
          expectation: match.replace(/^(?:should|must|will)\s+/, '').trim()
        })
      },
      {
        pattern: /(?:expect|assume|given)\s+(.+?)(?:then|will|should)\s+(.+?)(?:\.|$)/gi,
        extractor: (match1, match2) => ({
          description: `${match1.trim()} → ${match2.trim()}`,
          type: 'scenario',
          precondition: match1.trim(),
          expectation: match2.trim()
        })
      },
      {
        pattern: /(?:input|output|result)\s+(?:should be|must be|will be)\s+(.+?)(?:\.|$)/gi,
        extractor: (value) => ({
          description: `Value should be ${value.trim()}`,
          type: 'value',
          expectedValue: value.trim()
        })
      },
      {
        pattern: /(?:memory|address|location)\s+\$([0-9A-Fa-f]{2,4})\s+(?:should|must|will)\s+(?:contain|have|be)\s+(.+?)(?:\.|$)/gi,
        extractor: (addr, value) => ({
          description: `Memory $${addr} should contain ${value.trim()}`,
          type: 'memory',
          address: parseInt(addr, 16),
          expectedValue: value.trim()
        })
      }
    ];

    // Apply patterns
    for (const testPattern of testPatterns) {
      let match;
      while ((match = testPattern.pattern.exec(prompt)) !== null) {
        try {
          const testCase = testPattern.extractor(...match.slice(1));
          testCases.push({
            id: `test_${testCases.length + 1}`,
            ...testCase,
            maxSteps: 1000,
            timeout: 10000
          });
        } catch (error) {
          console.warn(`Failed to extract test case from match: ${match}`);
        }
      }
      testPattern.pattern.lastIndex = 0; // Reset regex state
    }

    // Add default tests if none found
    if (testCases.length === 0) {
      testCases.push({
        id: 'default_test',
        description: 'Basic program execution',
        type: 'execution',
        expectation: 'Program should run without errors',
        maxSteps: 100
      });
    }

    return testCases;
  }

  async performAdditionalTesting(sourceCode, spec) {
    const additionalResults = {
      performance: {},
      memory: {},
      codeQuality: {},
      recommendations: []
    };

    try {
      // Performance analysis
      const assembled = await this.mcpClient.assemble(sourceCode);
      additionalResults.performance = {
        bytecodeSize: assembled.sizeBytes,
        instructionCount: assembled.instructionCount,
        estimatedCycles: assembled.instructionCount * 3,
        memoryUsage: this.estimateMemoryUsage(sourceCode)
      };

      // Memory usage analysis
      additionalResults.memory = {
        zeroPageUsage: this.analyzeZeroPageUsage(sourceCode),
        stackUsage: this.estimateStackUsage(sourceCode),
        memoryLeaks: this.checkForMemoryLeaks(sourceCode)
      };

      // Code quality metrics
      additionalResults.codeQuality = {
        cyclomaticComplexity: this.calculateComplexity(sourceCode),
        instructionDiversity: this.analyzeInstructionDiversity(sourceCode),
        commentsRatio: this.analyzeCommentRatio(sourceCode)
      };

      // Generate recommendations
      additionalResults.recommendations = this.generateRecommendations(
        sourceCode,
        additionalResults.performance,
        additionalResults.codeQuality
      );

    } catch (error) {
      console.warn(`Additional testing failed: ${error.message}`);
    }

    return additionalResults;
  }

  estimateMemoryUsage(sourceCode) {
    const lines = sourceCode.split('\n');
    let memoryUsage = 0;

    for (const line of lines) {
      // Count data directives
      if (line.includes('.byte') || line.includes('db')) {
        const byteMatch = line.match(/\.byte\s+(.+)/) || line.match(/db\s+(.+)/);
        if (byteMatch) {
          const values = byteMatch[1].split(',').length;
          memoryUsage += values;
        }
      }
    }

    return memoryUsage;
  }

  async extractDebuggingContext(prompt) {
    const context = {
      issues: [],
      expectedBehavior: '',
      knownBugs: [],
      debuggingSteps: []
    };

    // Extract issue descriptions
    const issuePatterns = [
      /(?:bug|error|problem|issue)\s+with\s+(.+?)(?:\.|$)/gi,
      /(?:not working|broken|failing|crashing)\s+(.+?)(?:\.|$)/gi,
      /(?:debug|fix|repair)\s+(.+?)(?:\.|$)/gi
    ];

    for (const pattern of issuePatterns) {
      let match;
      while ((match = pattern.exec(prompt)) !== null) {
        context.issues.push(match[1].trim());
      }
      pattern.lastIndex = 0;
    }

    // Extract expected behavior
    const behaviorMatch = prompt.match(/(?:should|must|expected to|supposed to)\s+(.+?)(?:but|,|when|\.)/i);
    if (behaviorMatch) {
      context.expectedBehavior = behaviorMatch[1].trim();
    }

    // Look for specific error mentions
    if (prompt.match(/\b(infinite loop|hang|crash|freeze)\b/i)) {
      context.debuggingSteps.push('Check for infinite loops');
    }
    if (prompt.match(/\b(memory|address|pointer)\b.*\b(wrong|invalid|incorrect)\b/i)) {
      context.debuggingSteps.push('Verify memory addresses and operations');
    }
    if (prompt.match(/\b(calculation|math|arithmetic)\b.*\b(wrong|incorrect)\b/i)) {
      context.debuggingSteps.push('Validate arithmetic operations');
    }

    return context;
  }

  async performInteractiveDebugging(sourceCode, context) {
    const debuggingResults = {
      fixes: [],
      fixedSource: sourceCode,
      trace: [],
      interactiveSteps: []
    };

    try {
      // Setup debugging environment
      await this.mcpClient.resetCPU();
      const assembled = await this.mcpClient.assemble(sourceCode);
      await this.mcpClient.loadProgramToMemory(assembled.bytecode);

      // Set breakpoints on common problem areas
      const breakpoints = [];
      if (context.issues.some(issue => issue.includes('loop'))) {
        breakpoints.push(0x0600); // Default start address
      }

      for (const addr of breakpoints) {
        await this.mcpClient.setBreakpoint(addr);
      }

      // Perform debugging trace
      const traceResult = await this.mcpClient.traceExecution(50, {
        until: context.issues.includes('hang') ? 'timeout' : 'breakpoint'
      });

      debuggingResults.trace = traceResult.trace;

      // Analyze trace for issues
      for (const step of traceResult.trace) {
        if (this.detectInfiniteLoopStep(step, traceResult.trace)) {
          debuggingResults.fixes.push({
            type: 'infinite_loop',
            description: 'Detected potential infinite loop',
            location: step.pc,
            suggestion: 'Add loop termination condition or break instruction'
          });
        }
      }

      // Apply automated fixes
      for (const fix of debuggingResults.fixes) {
        if (fix.type === 'infinite_loop') {
          debuggingResults.fixedSource = this.applyInfiniteLoopFix(debuggingResults.fixedSource, fix.location);
        }
      }

    } catch (debugError) {
      console.warn(`Interactive debugging failed: ${debugError.message}`);

      debuggingResults.fixes.push({
        type: 'debug_error',
        description: `Debugging error: ${debugError.message}`,
        applied: false
      });
    }

    return debuggingResults;
  }

  detectInfiniteLoopStep(currentStep, trace) {
    // Simple pattern: if we've seen this PC address recently
    const recentPCs = trace.slice(-10).map(s => s.pc);

    // Count how many times we've been at this PC recently
    const occurrences = recentPCs.filter(pc => pc === currentStep.pc).length;

    // If we've been at the same address 3+ times recently, likely a loop
    return occurrences >= 3;
  }

  applyInfiniteLoopFix(sourceCode, location) {
    const lines = sourceCode.split('\n');
    const pcAddress = location.toString(16).padStart(4, '0');

    // Add a HLT instruction at the problematic location
    lines.push(`  ; Fix: Added halt at $${pcAddress}`);
    lines.push(`  HLT`);

    return lines.join('\n');
  }

  async generateEducationalExample(spec) {
    const example = {
      source: '',
      explanation: '',
      concepts: [],
      difficulty: spec.difficulty || 'intermediate'
    };

    const concept = spec.educationalConcept?.toLowerCase() || 'basic_operations';

    switch (concept) {
      case 'load_store':
        example.source = `.org $0600
; Example: Load and Store Operations
LDA #$42        ; Load immediate value 42 into accumulator
STA $00         ; Store accumulator to memory location 0
LDA #$FF        ; Load 255 into accumulator
STA $01         ; Store to memory location 1
RTS             ; Return from subroutine`;
        example.explanation = 'This example demonstrates basic load (LDA) and store (STA) operations in 6502 assembly. The program loads two different values and stores them in memory.';
        example.concepts = ['LDA', 'STA', 'immediate addressing', 'memory operations'];
        break;

      case 'arithmetic':
        example.source = `.org $0600
; Example: Basic Arithmetic
LDA #$05        ; Load 5 into accumulator
CLC             ; Clear carry flag
ADC #$03        ; Add 3 to accumulator (result = 8)
STA $00         ; Store result
LDA #$0A        ; Load 10
SBC #$04        ; Subtract 4 (result = 6)
STA $01         ; Store result
RTS`;
        example.explanation = 'This example shows basic addition (ADC) and subtraction (SBC) with proper carry flag management.';
        example.concepts = ['ADC', 'SBC', 'CLC', 'carry flag', 'arithmetic operations'];
        break;

      case 'loops':
        example.source = `.org $0600
; Example: Simple Loop
LDX #$00        ; Initialize X register to 0
LOOP:
  TXA           ; Transfer X to accumulator
  STA $00,X     ; Store accumulator at address 0+X
  INX           ; Increment X
  CPX #$05      ; Compare X with 5
  BNE LOOP      ; Branch if not equal (loop)
RTS             ; Return when done`;
        example.explanation = 'This example demonstrates a basic counting loop using indexed addressing and conditional branching.';
        example.concepts = ['LDX', 'INX', 'CPX', 'BNE', 'indexed addressing', 'loops'];
        break;

      case 'input_output':
        example.source = `.org $0600
; Example: Input/Output via Memory-Mapped I/O
LDA #$48        ; ASCII 'H'
STA $F1        ; Output to terminal
LDA #$65        ; ASCII 'e'
STA $F1
LDA #$6C        ; ASCII 'l'
STA $F1
STA $F1        ; Second 'l'
LDA #$6F        ; ASCII 'o'
STA $F1
RTS`;
        example.explanation = 'This example shows how to output characters to the terminal using memory-mapped I/O at address $F1.';
        example.concepts = ['terminal I/O', 'ASCII characters', 'memory-mapped I/O'];
        break;

      default:
        example.source = `.org $0600
; Basic Example Program
LDA #$42        ; Load 42 into accumulator
STA $00         ; Store to memory
RTS             ; Return`;
        example.explanation = 'A basic program that demonstrates fundamental 6502 assembly concepts.';
        example.concepts = ['LDA', 'STA', 'RTS', 'basic syntax'];
    }

    return example;
  }

  async generateSupportingMaterials(example, spec) {
    const materials = {
      prerequisites: [],
      relatedConcepts: [],
      practiceExercises: [],
      furtherReading: []
    };

    // Add prerequisites based on concepts
    for (const concept of example.concepts) {
      switch (concept) {
        case 'LDA':
          materials.prerequisites.push('Understanding of 6502 registers');
          break;
        case 'STA':
          materials.prerequisites.push('Basic memory concepts');
          break;
        case 'ADC':
        case 'SBC':
          materials.prerequisites.push('Binary arithmetic');
          materials.prerequisites.push('6502 status register');
          break;
        case 'BNE':
        case 'loops':
          materials.prerequisites.push('Program flow control');
          materials.prerequisites.push('Branch instructions');
          break;
      }
    }

    // Add related concepts
    if (example.concepts.includes('arithmetic')) {
      materials.relatedConcepts.push('BCD (Binary Coded Decimal) arithmetic');
      materials.relatedConcepts.push('Multi-precision arithmetic');
    }

    if (example.concepts.includes('loops')) {
      materials.relatedConcepts.push('Nested loops');
      materials.relatedConcepts.push('Loop optimization techniques');
    }

    // Generate practice exercises
    for (const concept of example.concepts) {
      switch (concept) {
        case 'LDA':
          materials.practiceExercises.push({
            title: 'Load Operations Practice',
            description: 'Write a program that loads different values and stores them to multiple memory locations',
            difficulty: 'beginner'
          });
          break;
        case 'ADC':
          materials.practiceExercises.push({
            title: 'Addition Practice',
            description: 'Create a program that adds three numbers together',
            difficulty: 'beginner'
          });
          break;
        case 'BNE':
          materials.practiceExercises.push({
            title: 'Loop Construction',
            description: 'Implement a countdown loop that stores values from 10 down to 1',
            difficulty: 'intermediate'
          });
          break;
      }
    }

    // Add further reading
    materials.furtherReading = [
      '6502 Programming Manual',
      'Assembly Language Fundamentals',
      'Computer Organization and Architecture'
    ];

    return materials;
  }

  extractPatterns(prompt) {
    const patterns = [];
    const words = prompt.toLowerCase().split(/\s+/);

    // Extract 2-5 word phrases that seem meaningful
    for (let i = 0; i < words.length - 1; i++) {
      for (let j = i + 2; j <= Math.min(i + 5, words.length); j++) {
        const phrase = words.slice(i, j).join(' ');
        if (phrase.length > 6 && !patterns.includes(phrase)) {
          patterns.push(phrase);
        }
      }
    }

    // Filter out common stop words
    const stopWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'but', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'got', 'let', 'put', 'say', 'she', 'too', 'use'];

    return patterns.filter(pattern =>
      pattern.split(/\s+/).every(word => !stopWords.includes(word) && word.length > 2)
    );
  }

  categorizeError(error) {
    const errorMessage = error.message?.toLowerCase() || '';

    if (errorMessage.includes('assembly') || errorMessage.includes('syntax')) {
      return 'assembly_error';
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('hung')) {
      return 'timeout_error';
    }

    if (errorMessage.includes('memory') || errorMessage.includes('address')) {
      return 'memory_error';
    }

    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return 'network_error';
    }

    if (errorMessage.includes('label') || errorMessage.includes('symbol')) {
      return 'symbol_error';
    }

    if (errorMessage.includes('instruction') || errorMessage.includes('mnemonic')) {
      return 'instruction_error';
    }

    return 'generic_error';
  }

  extractFailurePatterns(prompt, error) {
    const patterns = [];
    const promptWords = prompt.toLowerCase().split(/\s+/);

    // Extract words/phrases around problematic terms
    const problemWords = ['create', 'generate', 'load', 'store', 'calculate', 'compute'];

    for (const word of problemWords) {
      const index = promptWords.indexOf(word);
      if (index !== -1) {
        const start = Math.max(0, index - 2);
        const end = Math.min(promptWords.length, index + 3);
        const pattern = promptWords.slice(start, end).join(' ');
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  /**
   * Fix memory bounds errors
   */
  async fixMemoryBounds(error, sourceCode, spec) {
    const addressMatch = error.match(/address\s*\$?([0-9A-Fa-f]{1,4})/i) ||
                        error.match(/\$([0-9A-Fa-f]{1,4})/i);

    if (!addressMatch) return { applied: false, reason: 'Could not extract address', newCode: sourceCode };

    const originalAddress = parseInt(addressMatch[1], 16);

    // If address is outside valid range, suggest correction
    if (originalAddress > 0xFFFF) {
      const correctedAddress = originalAddress & 0xFFFF; // Wrap around
      const correctedHex = correctedAddress.toString(16).toUpperCase().padStart(originalAddress.toString(16).length, '0');
      const newCode = sourceCode.replace(
        new RegExp(`\\$${originalAddress.toString(16).toUpperCase()}`),
        `$${correctedHex}`
      );

      return {
        applied: true,
        description: `Corrected out-of-bounds address $${originalAddress.toString(16)} to $${correctedHex}`,
        newCode: newCode
      };
    }

    // For negative addresses or other bounds issues
    if (originalAddress < 0) {
      const correctedAddress = Math.abs(originalAddress) & 0xFFFF;
      const correctedHex = correctedAddress.toString(16).toUpperCase().padStart(addressMatch[1].length, '0');
      const newCode = sourceCode.replace(
        new RegExp(`\\$${addressMatch[1]}`),
        `$${correctedHex}`
      );

      return {
        applied: true,
        description: `Corrected negative address to positive equivalent`,
        newCode: newCode
      };
    }

    return { applied: false, reason: 'Address appears valid', newCode: sourceCode };
  }

  /**
   * Fix syntax errors
   */
  async fixSyntaxError(error, sourceCode) {
    const errorLower = error.toLowerCase();

    // Common syntax issues and their fixes
    if (errorLower.includes('missing operand') || errorLower.includes('operand expected')) {
      return await this.fixMissingOperand(error, sourceCode);
    }

    if (errorLower.includes('invalid operand') || errorLower.includes('wrong operand')) {
      return await this.fixInvalidOperand(error, sourceCode);
    }

    if (errorLower.includes('unsupported addressing') || errorLower.includes('addressing mode')) {
      return await this.fixAddressingMode(error, sourceCode);
    }

    return { applied: false, reason: 'Unknown syntax error type', newCode: sourceCode };
  }

  /**
   * Fix missing operand errors
   */
  async fixMissingOperand(error, sourceCode) {
    const lines = sourceCode.split('\n');
    const instructionMatch = error.match(/instruction ['"]([^'"]+)['"]/i);

    if (!instructionMatch) {
      return { applied: false, reason: 'Could not identify instruction', newCode: sourceCode };
    }

    const instruction = instructionMatch[1].toUpperCase();
    let fixedCode = sourceCode;

    // Find the problematic line and add default operand
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.toUpperCase().startsWith(instruction) && line.split(/\s+/).length === 1) {
        // Instruction with no operand - add default
        const defaultOperands = {
          'LDA': '$00',
          'STA': '$00',
          'ADC': '#$00',
          'SBC': '#$00',
          'CMP': '#$00',
          'AND': '#$00',
          'ORA': '#$00',
          'EOR': '#$00',
          'JMP': '$0600',
          'JSR': '$0600',
          'BEQ': '$0600',
          'BNE': '$0600',
          'BCS': '$0600',
          'BCC': '$0600'
        };

        if (defaultOperands[instruction]) {
          const originalLine = lines[i];
          lines[i] = `${instruction} ${defaultOperands[instruction]}`;
          fixedCode = lines.join('\n');

          return {
            applied: true,
            description: `Added missing operand to ${instruction}: ${defaultOperands[instruction]}`,
            newCode: fixedCode
          };
        }
      }
    }

    return { applied: false, reason: `Could not fix missing operand for ${instruction}`, newCode: sourceCode };
  }

  /**
   * Fix invalid operand errors
   */
  async fixInvalidOperand(error, sourceCode) {
    // Try to identify and correct common operand issues
    let fixedCode = sourceCode;

    // Fix common typos in operands
    fixedCode = fixedCode.replace(/\b\$g([0-9A-Fa-f]+)/g, '$$$1'); // $g1234 -> $1234
    fixedCode = fixedCode.replace(/\b\$o([0-9A-Fa-f]+)/g, '$$$1'); // $o1234 -> $1234
    fixedCode = fixedCode.replace(/\b(Aa|Bb|Xx|Yy)\b/g, (match) => match.toUpperCase()); // Aa -> A, etc.

    if (fixedCode !== sourceCode) {
      return {
        applied: true,
        description: 'Corrected operand formatting issues',
        newCode: fixedCode
      };
    }

    return { applied: false, reason: 'Could not identify operand issue', newCode: sourceCode };
  }

  /**
   * Fix addressing mode errors
   */
  async fixAddressingMode(error, sourceCode) {
    const lines = sourceCode.split('\n');
    let fixedCode = sourceCode;

    // Look for instructions that might have incorrect addressing modes
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const parts = line.split(/\s+/);

      if (parts.length >= 2) {
        const instruction = parts[0].toUpperCase();
        const operand = parts[1];

        // Fix common addressing mode issues
        if (instruction === 'STA' && operand.startsWith('#')) {
          // STA can't use immediate addressing
          lines[i] = `${instruction} $00 ; Fixed: removed immediate addressing`;
          return {
            applied: true,
            description: `Fixed ${instruction} addressing mode (removed immediate)`,
            newCode: lines.join('\n')
          };
        }

        if (['INC', 'DEC'].includes(instruction) && operand.startsWith('#')) {
          // INC/DEC can't use immediate addressing
          lines[i] = `${instruction} $00 ; Fixed: removed immediate addressing`;
          return {
            applied: true,
            description: `Fixed ${instruction} addressing mode (removed immediate)`,
            newCode: lines.join('\n')
          };
        }
      }
    }

    return { applied: false, reason: 'Could not identify addressing mode issue', newCode: sourceCode };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  analyzeZeroPageUsage(sourceCode) {
    const lines = sourceCode.split('\n');
    const zeroPageAddresses = new Set();

    for (const line of lines) {
      // Look for zero page addressing ($00-$FF)
      const zpMatches = line.match(/\$[0-9A-Fa-f]{2}\b/g) || [];
      for (const match of zpMatches) {
        const address = parseInt(match.substring(1), 16);
        if (address >= 0 && address <= 255) {
          zeroPageAddresses.add(address);
        }
      }
    }

    return zeroPageAddresses.size;
  }

  estimateStackUsage(sourceCode) {
    let stackDepth = 0;
    let maxStackDepth = 0;

    const lines = sourceCode.split('\n');
    for (const line of lines) {
      const instruction = line.trim().split(/\s+/)[0]?.toUpperCase();

      if (['PHA', 'PHP'].includes(instruction)) {
        stackDepth++;
        maxStackDepth = Math.max(maxStackDepth, stackDepth);
      } else if (['PLA', 'PLP'].includes(instruction)) {
        stackDepth = Math.max(0, stackDepth - 1);
      }

      // Function calls also use stack (simplified estimate)
      if (['JSR', 'BSR'].includes(instruction)) {
        stackDepth += 2; // Return address
        maxStackDepth = Math.max(maxStackDepth, stackDepth);
      }
    }

    return { current: stackDepth, maximum: maxStackDepth };
  }

  checkForMemoryLeaks(sourceCode) {
    const issues = [];

    // Simple pattern: check for allocated memory that might not be freed
    // In assembly, we look for data directives without comments about cleanup
    const lines = sourceCode.split('\n');
    const dataDirectives = lines.filter(line =>
      line.includes('.byte') || line.includes('db') || line.includes('.word') ||
      line.includes('dw') || line.includes('.res') || line.includes('ds')
    );

    for (const line of dataDirectives) {
      if (!line.includes('free') && !line.includes('cleanup') && !line.includes('temp')) {
        issues.push(`Potential memory allocation without cleanup: ${line.trim()}`);
      }
    }

    return issues;
  }

  calculateComplexity(sourceCode) {
    const lines = sourceCode.split('\n');
    let complexity = 1; // Base complexity

    for (const line of lines) {
      const instruction = line.trim().split(/\s+/)[0]?.toUpperCase();

      // Branch instructions add complexity
      if (['BNE', 'BEQ', 'BPL', 'BMI', 'BVC', 'BVS', 'BCC', 'BCS',
           'BGE', 'BLT', 'JMP', 'JSR'].includes(instruction)) {
        complexity++;
      }

      // Compare instructions add conditional path complexity
      if (instruction === 'CMP' || instruction === 'CPX' || instruction === 'CPY') {
        complexity += 0.5;
      }
    }

    return Math.round(complexity);
  }

  analyzeInstructionDiversity(sourceCode) {
    const lines = sourceCode.split('\n');
    const instructions = new Set();
    let totalInstructions = 0;

    for (const line of lines) {
      const instruction = line.trim().split(/\s+/)[0]?.toUpperCase();
      if (instruction && /^[A-Z]{3}/.test(instruction)) {
        instructions.add(instruction);
        totalInstructions++;
      }
    }

    return {
      uniqueInstructions: instructions.size,
      totalInstructions: totalInstructions,
      diversityRatio: totalInstructions > 0 ? (instructions.size / totalInstructions) : 0,
      instructionTypes: Array.from(instructions)
    };
  }

  analyzeCommentRatio(sourceCode) {
    const lines = sourceCode.split('\n');
    const totalLines = lines.length;
    const commentLines = lines.filter(line => line.trim().startsWith(';')).length;
    const blankLines = lines.filter(line => line.trim() === '').length;
    const codeLines = totalLines - commentLines - blankLines;

    return {
      totalLines: totalLines,
      commentLines: commentLines,
      codeLines: codeLines,
      commentRatio: codeLines > 0 ? (commentLines / codeLines) : 0,
      documentationQuality: commentRatio > 0.3 ? 'good' :
                           commentRatio > 0.1 ? 'fair' : 'poor'
    };
  }

  generateRecommendations(sourceCode, performance, codeQuality) {
    const recommendations = [];

    // Performance recommendations
    if (performance.bytecodeSize > 256) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: 'Consider splitting large program into smaller modules for better memory management'
      });
    }

    if (performance.estimatedCycles > 10000) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Program execution is estimated to take many cycles. Consider optimization for frequently executed sections.'
      });
    }

    // Code quality recommendations
    if (codeQuality.documentationQuality === 'poor') {
      recommendations.push({
        type: 'quality',
        priority: 'medium',
        message: 'Add more comments to document program logic and intent for better maintainability'
      });
    }

    if (codeQuality.cyclomaticComplexity > 10) {
      recommendations.push({
        type: 'quality',
        priority: 'high',
        message: 'High complexity detected. Consider breaking down complex sections into smaller subroutines.'
      });
    }

    // Memory usage recommendations
    if (this.analyzeZeroPageUsage(sourceCode) > 16) {
      recommendations.push({
        type: 'memory',
        priority: 'low',
        message: 'Heavy zero page usage. Consider using other memory areas for better performance.'
      });
    }

    const stackUsage = this.estimateStackUsage(sourceCode);
    if (stackUsage.maximum > 8) {
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        message: 'Deep stack usage detected. Ensure adequate stack space and proper cleanup.'
      });
    }

    // Specific instruction recommendations
    const diversity = this.analyzeInstructionDiversity(sourceCode);
    if (diversity.diversityRatio < 0.3) {
      recommendations.push({
        type: 'instruction',
        priority: 'low',
        message: 'Limited instruction diversity. Consider using a wider variety of 6502 features.'
      });
    }

    return recommendations;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get agent statistics
   */
  getStats() {
    const uptime = Date.now() - this.stats.uptimeStarted.getTime();
    return {
      ...this.stats,
      uptime,
      uptimeFormatted: this.formatUptime(uptime),
      tasksInProgress: this.processingTasks.size,
      isRunning: this.running
    };
  }

  /**
   * Format uptime duration
   */
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Export agent state for analysis
   */
  exportState() {
    return {
      stats: this.getStats(),
      learningModel: this.learningModel,
      queueStats: this.queue.getQueueStats(),
      config: this.options
    };
  }
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default AutonomousSoftwareAgent;

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create and start an autonomous agent with sensible defaults
 */
export async function createAutonomousAgent(options = {}) {
  const agent = new AutonomousSoftwareAgent(options);
  await agent.start();
  return agent;
}

/**
 * Quick test of autonomous agent functionality
 */
export async function testAutonomousAgent(options = {}) {
  const agent = new AutonomousSoftwareAgent({
    mcpServerUrl: options.mcpServerUrl || 'http://localhost:8001',
    processingInterval: 1000, // Faster for testing
    ...options
  });

  try {
    await agent.verifyMCPConnection();
    console.log('✅ Autonomous agent MCP connection test passed');
    return true;
  } catch (error) {
    console.error('❌ Autonomous agent MCP connection test failed:', error.message);
    return false;
  } finally {
    await agent.stop();
  }
}