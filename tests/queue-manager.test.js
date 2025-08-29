/**
 * PromptQueue System Tests
 * Tests all queue functionality including persistence, prioritization, and batch operations
 */

import PromptQueue from '../agent/queue-manager.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple test runner
function runTest(testName, testFunction) {
  try {
    testFunction();
    console.log(`PASS: ${testName}`);
  } catch (error) {
    console.log(`FAIL: ${testName} - ${error.message}`);
  }
}

console.log('Running PromptQueue System Tests...\n');

let queue;
let testDataDir;
let backupsDir;

// Setup test environment
const setupTestEnvironment = () => {
  testDataDir = path.join(__dirname, '..', 'data', 'test');
  backupsDir = path.join(testDataDir, 'backups');

  // Ensure directories exist
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  // Clear any existing test data
  const queueFile = path.join(testDataDir, 'queue.json');
  if (fs.existsSync(queueFile)) {
    fs.unlinkSync(queueFile);
  }

  // Initialize queue with test-specific paths
  queue = new PromptQueue({
    queueFile: path.join(testDataDir, 'queue.json'),
    backupDir: backupsDir,
    maxBackups: 3,
    autoSave: true
  });
};

const cleanupTestEnvironment = () => {
  if (fs.existsSync(testDataDir)) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
};

// Core Queue Operations Tests
console.log('=== Core Queue Operations Tests ===');

// Test 1: Add a prompt to queue
runTest('should add a prompt to queue', async () => {
  setupTestEnvironment();
  await new Promise(resolve => setTimeout(resolve, 10)); // Allow async setup
  const prompt = 'Create a simple addition program';
  const taskId = await queue.addPrompt(prompt, { type: 'generation' });

  if (typeof taskId !== 'string' || !taskId.startsWith('task_')) {
    throw new Error('Invalid task ID returned');
  }
  cleanupTestEnvironment();
});

// Test 2: Get next prompt by priority
runTest('should get next prompt by priority', async () => {
  setupTestEnvironment();
  await new Promise(resolve => setTimeout(resolve, 10));

  // Add tasks with different priorities
  await queue.addPrompt('Low priority task', { priority: 'low' });
  await queue.addPrompt('High priority task', { priority: 'high' });
  await queue.addPrompt('Normal priority task', { priority: 'normal' });

  const nextTask = await queue.getNextPrompt();
  if (!nextTask) throw new Error('No task returned');
  if (nextTask.priority !== 'high') throw new Error('High priority task should be first');

  cleanupTestEnvironment();
});

// Test 3: Update prompt status
runTest('should update prompt status', async () => {
  setupTestEnvironment();
  await new Promise(resolve => setTimeout(resolve, 10));

  const taskId = await queue.addPrompt('Test prompt');

  let tasks = await queue.listPrompts({ status: 'queued' });
  if (tasks.length !== 1) throw new Error('Task not found after adding');
  if (tasks[0].status !== 'queued') throw new Error('Initial status incorrect');

  await queue.updatePromptStatus(taskId, 'processing');
  tasks = await queue.listPrompts({ status: 'processing' });
  if (tasks.length !== 1) throw new Error('Task not in processing state');

  cleanupTestEnvironment();
});

// Persistence Tests
console.log('\n=== Persistence Tests ===');

// Test 4: Persist queue to file
runTest('should persist queue to file', async () => {
  setupTestEnvironment();
  await new Promise(resolve => setTimeout(resolve, 10));

  await queue.addPrompt('Persistent task');

  // Create new instance with same file
  const queue2 = new PromptQueue({
    queueFile: path.join(testDataDir, 'queue.json'),
    backupDir: backupsDir
  });

  const tasks = await queue2.listPrompts();
  if (tasks.length !== 1) throw new Error('Task not persisted');
  if (tasks[0].prompt !== 'Persistent task') throw new Error('Task data not persisted correctly');

  cleanupTestEnvironment();
});

// Queue Management Tests
console.log('\n=== Queue Management Tests ===');

// Test 5: List prompts with filtering
runTest('should list prompts with filtering', async () => {
  setupTestEnvironment();
  await new Promise(resolve => setTimeout(resolve, 10));

  await queue.addPrompt('Generation task', { type: 'generation', priority: 'high' });
  await queue.addPrompt('Debug task', { type: 'debugging', priority: 'normal' });
  await queue.addPrompt('Test task', { type: 'testing', priority: 'low' });

  const genTasks = await queue.listPrompts({ type: 'debugging' });
  if (genTasks.length !== 1) throw new Error('Debug task filtering failed');

  const highPriorityTasks = await queue.listPrompts({ priority: 'high' });
  if (highPriorityTasks.length !== 1) throw new Error('Priority filtering failed');

  cleanupTestEnvironment();
});

// Test 6: Clean completed tasks
runTest('should clean completed tasks', async () => {
  setupTestEnvironment();
  await new Promise(resolve => setTimeout(resolve, 10));

  await queue.addPrompt('Keep this');
  const taskId1 = await queue.addPrompt('Remove this');
  const taskId2 = await queue.addPrompt('Remove this too');

  await queue.updatePromptStatus(taskId1, 'completed');
  await queue.updatePromptStatus(taskId2, 'failed');

  let tasks = await queue.listPrompts();
  if (tasks.length !== 3) throw new Error('All tasks should be present initially');

  const result = await queue.cleanCompleted();
  if (result.removed !== 2) throw new Error('Wrong number of tasks removed');

  tasks = await queue.listPrompts();
  if (tasks.length !== 1) throw new Error('One task should remain');

  cleanupTestEnvironment();
});

// Batch Operations Tests
console.log('\n=== Batch Operations Tests ===');

// Test 7: Add batch prompts
runTest('should add batch prompts', async () => {
  setupTestEnvironment();
  await new Promise(resolve => setTimeout(resolve, 10));

  const prompts = [
    { prompt: 'First task', options: { priority: 'high' } },
    { prompt: 'Second task', options: { type: 'debugging' } },
    { prompt: 'Third task', options: { priority: 'low' } }
  ];

  const result = await queue.addBatchPrompts(prompts);
  if (result.results.length !== 3) throw new Error('Wrong number of results');
  if (result.errors.length !== 0) throw new Error('Should have no errors');

  result.results.forEach(r => {
    if (!r.success) throw new Error('All batch operations should succeed');
    if (!r.id) throw new Error('Each result should have an ID');
  });

  cleanupTestEnvironment();
});

// Error Handling Tests
console.log('\n=== Error Handling Tests ===');

// Test 8: Reject invalid prompts
runTest('should reject invalid prompts', async () => {
  setupTestEnvironment();
  await new Promise(resolve => setTimeout(resolve, 10));

  try {
    await queue.addPrompt('');
    throw new Error('Should have rejected empty string');
  } catch (error) {
    // Expected error
  }

  try {
    await queue.addPrompt(null);
    throw new Error('Should have rejected null');
  } catch (error) {
    // Expected error
  }

  cleanupTestEnvironment();
});

// Test 9: Prevent removal of active tasks
runTest('should prevent removal of active tasks', async () => {
  setupTestEnvironment();
  await new Promise(resolve => setTimeout(resolve, 10));

  const taskId = await queue.addPrompt('Active task');
  await queue.updatePromptStatus(taskId, 'processing');

  try {
    await queue.removePrompt(taskId);
    throw new Error('Should not allow removal of processing task');
  } catch (error) {
    // Expected error
  }

  cleanupTestEnvironment();
});

console.log('\nPromptQueue System Tests Complete!');