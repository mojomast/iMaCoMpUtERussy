/**
 * Autonomous Software Generation Agent Demo
 *
 * This demo showcases the full capabilities of the autonomous agent
 * by processing various types of software generation tasks through
 * natural language prompts.
 */

import { createAutonomousAgent } from '../agent/autonomous-agent.js';
import fs from 'fs';
import path from 'path';

/**
 * Demo task scenarios
 */
const demoTasks = [
  {
    type: 'generation',
    prompt: 'Create a program that calculates the sum of numbers from 1 to 10 and stores the result in memory location $0100',
    description: 'Basic arithmetic program with loop',
    metadata: { difficulty: 'beginner', concepts: ['addition', 'looping'] }
  },
  {
    type: 'optimization',
    prompt: 'Optimize this program for speed and size: LDA #$00, STA $00, INC $00, LDA $00, CMP #$10, BNE start',
    description: 'Simple counter optimization',
    metadata: { optimize: true, priority: 'high' }
  },
  {
    type: 'educational',
    prompt: 'Teach me how to implement a simple calculator that can add two numbers in 6502 assembly',
    description: 'Educational content about arithmetic operations',
    metadata: { educationalConcept: 'arithmetic', difficulty: 'beginner' }
  },
  {
    type: 'debugging',
    prompt: 'Debug this program - it should load 42 but stores garbage: LDA #$42, STA $0123',
    description: 'Simple debugging scenario',
    metadata: { issue: 'memory_bounds', priority: 'high' }
  },
  {
    type: 'testing',
    prompt: 'Create comprehensive tests for a program that converts binary to decimal values',
    description: 'Test case generation for conversion routine',
    metadata: { testType: 'unit_tests', priority: 'medium' }
  }
];

/**
 * Demonstration class
 */
class AutonomousAgentDemo {
  constructor(options = {}) {
    this.options = {
      mcpServerUrl: options.mcpServerUrl || 'http://localhost:8001',
      demoMode: options.demoMode !== false,
      generateReports: options.generateReports !== false,
      ...options
    };

    this.results = [];
    this.agent = null;
  }

  /**
   * Run the complete demonstration
   */
  async runDemo() {
    console.log('\n🎬 Starting Autonomous Agent Demonstration\n');
    console.log('=' .repeat(60));

    try {
      // Initialize agent
      console.log('🚀 Initializing Autonomous Agent...');
      this.agent = await createAutonomousAgent({
        mcpServerUrl: this.options.mcpServerUrl,
        processingInterval: 3000, // Fast processing for demo
        learningEnabled: true,
        maxConcurrentTasks: 1
      });

      console.log('✅ Agent initialized successfully\n');

      // Run each demo task
      for (let i = 0; i < demoTasks.length; i++) {
        const task = demoTasks[i];
        console.log(`\n📋 Demo Task ${i + 1}: ${task.type.toUpperCase()}`);
        console.log(`   ${task.description}`);
        console.log('-'.repeat(50));

        try {
          await this.runTask(task);
        } catch (error) {
          console.error(`❌ Task ${i + 1} failed:`, error.message);
          this.results.push({
            task: i + 1,
            success: false,
            error: error.message
          });
        }

        // Brief pause between tasks
        await this.delay(1000);
      }

      // Generate report
      if (this.options.generateReports) {
        await this.generateReport();
      }

      // Show final statistics
      await this.showFinalStats();

    } catch (error) {
      console.error('\n❌ Demo failed:', error.message);
      throw error;
    } finally {
      if (this.agent) {
        await this.agent.stop();
      }
    }
  }

  /**
   * Run a single demo task
   */
  async runTask(task) {
    try {
      // Add task to queue
      console.log(`📝 Adding task: "${task.prompt}"`);
      const taskId = await this.agent.queue.addPrompt(task.prompt, {
        type: task.type,
        metadata: task.metadata
      });

      console.log(`🎯 Task queued with ID: ${taskId}`);

      // Wait for task completion
      console.log('⏳ Processing...');

      // In a real scenario, the agent would process this automatically
      // For demo purposes, we'll simulate processing
      const startTime = Date.now();

      // Wait for task to complete (polling for demo)
      let completedTask = null;
      let retries = 0;
      const maxRetries = 30; // 30 seconds max

      while (retries < maxRetries && !completedTask) {
        // Check if task is done
        const taskStatus = await this.checkTaskCompletion(taskId);

        if (taskStatus === 'completed') {
          completedTask = await this.getTaskResult(taskId);
          break;
        } else if (taskStatus === 'failed') {
          throw new Error(`Task ${taskId} failed during processing`);
        }

        await this.delay(1000);
        retries++;
        console.log(`   ...waiting (${retries}/${maxRetries})`);
      }

      if (!completedTask) {
        throw new Error(`Task ${taskId} timed out`);
      }

      const processingTime = Date.now() - startTime;
      console.log(`✅ Task completed in ${(processingTime / 1000).toFixed(1)}s`);

      // Display results
      await this.displayTaskResults(task, completedTask);

      this.results.push({
        task: task.prompt,
        type: task.type,
        success: true,
        processingTime,
        result: completedTask
      });

    } catch (error) {
      console.error(`❌ Task processing failed: ${error.message}`);
      this.results.push({
        task: task.prompt,
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Check if a task is completed
   */
  async checkTaskCompletion(taskId) {
    try {
      // This is a simplified check - in reality you'd query the queue
      const tasks = await this.agent.queue.listPrompts({ id: taskId });
      const task = tasks.find(t => t.id === taskId);

      return task ? task.status : 'not_found';
    } catch (error) {
      return 'error';
    }
  }

  /**
   * Get task result (simplified)
   */
  async getTaskResult(taskId) {
    // In a real implementation, this would retrieve the actual processed result
    // For demo purposes, we'll return a mock result
    const taskData = demoTasks.find(t => t.prompt.includes(taskId.split('_')[2]));

    if (!taskData) {
      return { status: 'completed', mock: true };
    }

    return {
      type: taskData.type,
      specification: taskData,
      status: 'completed',
      mock: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Display task results in a formatted way
   */
  async displayTaskResults(originalTask, result) {
    switch (originalTask.type) {
      case 'generation':
        console.log('🎨 Generated Program:');
        console.log('   • Type: Assembly code generation');
        console.log('   • Status: Code generated and validated');
        break;

      case 'optimization':
        console.log('⚡ Optimization Results:');
        console.log('   • Original size: [calculated]');
        console.log('   • Optimized size: [calculated]');
        console.log('   • Performance improvement: [calculated]');
        break;

      case 'educational':
        console.log('📚 Educational Content:');
        console.log(`   • Topic: ${originalTask.metadata?.educationalConcept || 'Assembly programming'}`);
        console.log('   • Includes: Examples, explanations, exercises');
        break;

      case 'debugging':
        console.log('🐛 Debugging Results:');
        console.log(`   • Issues found: [detected]`);
        console.log('   • Fixes applied: [applied]');
        console.log('   • Verification: [passed/failed]');
        break;

      case 'testing':
        console.log('🧪 Test Results:');
        console.log('   • Test cases generated: [count]');
        console.log('   • Coverage: [percentage]');
        console.log('   • Pass rate: [percentage]');
        break;

      default:
        console.log('📋 Task completed successfully');
    }
  }

  /**
   * Generate a summary report
   */
  async generateReport() {
    const reportDir = path.join(__dirname, '..', 'data', 'demo-reports');
    const reportFile = path.join(reportDir, `demo-report-${Date.new().toISOString().split('T')[0]}.json`);

    // Ensure directory exists
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const report = {
      timestamp: new Date().toISOString(),
      demoVersion: '1.0.0',
      mcpServerUrl: this.options.mcpServerUrl,
      tasksProcessed: demoTasks.length,
      results: this.results,
      summary: {
        successful: this.results.filter(r => r.success).length,
        failed: this.results.filter(r => !r.success).length,
        averageProcessingTime: this.results
          .filter(r => r.success && r.processingTime)
          .reduce((sum, r) => sum + r.processingTime, 0) /
          this.results.filter(r => r.success && r.processingTime).length
      }
    };

    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`\n📊 Demo report saved to: ${reportFile}`);
  }

  /**
   * Show final statistics
   */
  async showFinalStats() {
    const successful = this.results.filter(r => r.success).length;
    const total = this.results.length;
    const successRate = total > 0 ? ((successful / total) * 100).toFixed(1) : '0.0';

    console.log('\n' + '='.repeat(60));
    console.log('🎬 DEMONSTRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`📋 Tasks Processed: ${total}`);
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${total - successful}`);
    console.log(`📊 Success Rate: ${successRate}%`);

    if (successful > 0) {
      const avgTime = (this.results
        .filter(r => r.success && r.processingTime)
        .reduce((sum, r) => sum + r.processingTime, 0) /
        this.results.filter(r => r.success && r.processingTime).length);
      console.log(`⏱️  Average Processing Time: ${(avgTime / 1000).toFixed(1)}s`);
    }

    // Show learning improvements
    if (this.agent) {
      const stats = this.agent.getStats();
      console.log(`🧠 Learning Model: ${Object.keys(this.agent.learningModel.parsing.patterns).length} patterns learned`);
      console.log(`🔄 Agent Uptime: ${stats.uptimeFormatted}`);
    }

    console.log('='.repeat(60));
    console.log('\n🎉 Demonstration completed!');
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Main demonstration runner
 */
async function runDemo(options = {}) {
  const demo = new AutonomousAgentDemo(options);

  try {
    await demo.runDemo();
  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
    process.exit(1);
  }
}

// Run demo if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = {};

  // Check for command line arguments
  if (process.argv.includes('--no-reports')) {
    options.generateReports = false;
  }

  if (process.argv.includes('--mcp-url')) {
    const urlIndex = process.argv.indexOf('--mcp-url');
    if (urlIndex + 1 < process.argv.length) {
      options.mcpServerUrl = process.argv[urlIndex + 1];
    }
  }

  console.log('🚀 Autonomous Software Generation Agent Demo');
  console.log('Features demonstrated:');
  console.log('  ✅ Natural language task processing');
  console.log('  ✅ Automatic task classification');
  console.log('  ✅ Code generation and validation');
  console.log('  ✅ Learning and self-improvement');
  console.log('  ✅ Integration with MCP server');
  console.log('');

  runDemo(options);
}

export { AutonomousAgentDemo, runDemo };