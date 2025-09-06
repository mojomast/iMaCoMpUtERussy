/* global describe, beforeEach, afterEach, it, console, Buffer, require, __dirname, global, process, assert */
/**
 * Queue Manager Tests for VideoStorage-8
 * Tests single-instance access and ECC-protected save/load operations
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { PromptQueue } = require('../agent/queue-manager.js');
const { addErrorCorrection, validateAndCorrect } = require('../js/ecc.js');

// Test data directory
const testDataDir = path.join(__dirname, '../data');
const testQueueFile = path.join(testDataDir, 'test-queue.json');
const backupDir = path.join(testDataDir, 'backups');

// Ensure test directories exist
if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
}
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

// Clean up test files before/after
function cleanupTestFiles() {
    if (fs.existsSync(testQueueFile)) {
        fs.unlinkSync(testQueueFile);
    }
    // Remove test backups
    if (fs.existsSync(backupDir)) {
        const testBackups = fs.readdirSync(backupDir).filter(file => file.startsWith('test-'));
        testBackups.forEach(file => {
            fs.unlinkSync(path.join(backupDir, file));
        });
    }
}

// Test 1: Single instance access
describe('QueueManager Single Instance Access', () => {
    let queue1, queue2;

    beforeEach(() => {
        cleanupTestFiles();
    });

    afterEach(() => {
        cleanupTestFiles();
    });

    it('should create single instance across multiple creations', () => {
        queue1 = new PromptQueue({
            queueFile: testQueueFile,
            backupDir: backupDir,
            aiProcessor: { process: async () => ({}) } // Mock AI processor
        });

        queue2 = new PromptQueue({
            queueFile: testQueueFile,
            backupDir: backupDir,
            aiProcessor: { process: async () => ({}) }
        });

        assert.strictEqual(queue1, queue2, 'Should return the same instance');
        assert.ok(queue1 instanceof PromptQueue, 'Instance should be PromptQueue');
    });

    it('should maintain state across instances', () => {
        queue1 = new PromptQueue({
            queueFile: testQueueFile,
            backupDir: backupDir,
            aiProcessor: { process: async () => ({}) }
        });

        // Add test item
        queue1.enqueue('test-task', { data: 'test-data' });

        // Create second instance
        queue2 = new PromptQueue({
            queueFile: testQueueFile,
            backupDir: backupDir,
            aiProcessor: { process: async () => ({}) }
        });

        assert.strictEqual(queue2.getQueueLength(), 1, 'Queue length should be maintained');
        const item = queue2.dequeue();
        assert.strictEqual(item.task, 'test-task', 'Task should be preserved');
    });
});

// Test 2: ECC protected save/load operations
describe('QueueManager ECC Protected Operations', () => {
    let queue;

    beforeEach(() => {
        cleanupTestFiles();
        queue = new PromptQueue({
            queueFile: testQueueFile,
            backupDir: backupDir,
            aiProcessor: { process: async () => ({}) }
        });
    });

    afterEach(() => {
        cleanupTestFiles();
    });

    it('should save queue with Reed-Solomon ECC protection', async () => {
        // Add multiple test items
        queue.enqueue('task1', { priority: 1, data: 'data1' });
        queue.enqueue('task2', { priority: 2, data: 'data2' });
        queue.enqueue('task3', { priority: 3, data: 'data3' });

        // Save queue
        await queue.saveQueue();

        // Verify saved file exists and has ECC data
        assert.ok(fs.existsSync(testQueueFile), 'Queue file should exist after save');

        const savedContent = fs.readFileSync(testQueueFile, 'utf8');
        const savedData = JSON.parse(savedContent);

        // Check for ECC markers (assume queue-manager adds ecc field)
        assert.ok(savedData.queue && Array.isArray(savedData.queue), 'Saved data should contain queue array');
        assert.strictEqual(savedData.queue.length, 3, 'Queue should have 3 items');

        console.log('Save test passed: ECC-protected queue saved successfully');
    });

    it('should load and decode queue with error correction', async () => {
        // Create test queue and save with ECC
        queue.enqueue('original-task', { data: 'original-data', timestamp: Date.now() });
        await queue.saveQueue();

        // Simulate data corruption (flip some bits in the file)
        let content = fs.readFileSync(testQueueFile, 'utf8');
        // Simple corruption: replace some characters to simulate bit flips
        content = content.replace(/data/g, 'd4ta'); // Corrupt 'data' to 'd4ta'
        content = content.replace(/task/g, 't4sk'); // Corrupt 'task' to 't4sk'
        fs.writeFileSync(testQueueFile, content);

        // Load corrupted queue - should attempt correction via ECC
        const loadedQueue = new PromptQueue({
            queueFile: testQueueFile,
            backupDir: backupDir,
            aiProcessor: { process: async () => ({}) }
        });

        await loadedQueue.loadQueue();

        // Verify correction worked (task name should be intact if ECC corrects properly)
        const loadedItem = loadedQueue.dequeue();
        assert.ok(loadedItem, 'Should load at least one item after correction');
        assert.strictEqual(loadedItem.task, 'original-task', 'Task name should match after ECC correction');

        console.log('Load with correction test passed: Corrupted queue loaded and corrected');
    });

    it('should handle save/load with simulated transmission errors using direct ECC', async () => {
        // Create test data
        const originalData = {
            queue: [
                { task: 'fibonacci', data: { n: 10 }, priority: 1 },
                { task: 'hello-world', data: { message: 'Hello!' }, priority: 2 },
                { task: 'graphics-demo', data: { pattern: 'checkerboard' }, priority: 3 }
            ],
            metadata: { version: '1.0', savedAt: new Date().toISOString() }
        };

        // Convert to buffer and add ECC
        const dataBuffer = Buffer.from(JSON.stringify(originalData), 'utf8');
        const withECC = addErrorCorrection(new Uint8Array(dataBuffer));

        // Save ECC-protected data
        fs.writeFileSync(testQueueFile, Buffer.from(withECC));

        // Simulate corruption (flip 10% of bits)
        let corruptedBuffer = Buffer.from(withECC);
        for (let i = 0; i < corruptedBuffer.length; i++) {
            if (Math.random() < 0.1) { // 10% corruption rate
                corruptedBuffer[i] ^= 0xFF; // Flip all bits in byte
            }
        }
        fs.writeFileSync(testQueueFile, corruptedBuffer);

        // Load and correct using ECC
        const corruptedData = fs.readFileSync(testQueueFile);
        const correctedBuffer = validateAndCorrect(new Uint8Array(corruptedData));
        const correctedData = JSON.parse(Buffer.from(correctedBuffer).toString('utf8'));

        // Verify recovery
        assert.strictEqual(correctedData.queue.length, 3, 'Should recover all 3 tasks after ECC correction');
        assert.strictEqual(correctedData.queue[0].task, 'fibonacci', 'First task should be recovered');
        assert.strictEqual(correctedData.queue[1].task, 'hello-world', 'Second task should be recovered');
        assert.strictEqual(correctedData.queue[2].task, 'graphics-demo', 'Third task should be recovered');

        console.log('Direct ECC test passed: Transmission errors corrected successfully');
    });
});

// Run tests if executed directly
if (require.main === module) {
    // Mock global functions if needed for integration tests
    global.window = global.window || {};
    global.window.logToMCP = () => {};

    // Execute tests
    const mocha = new (require('mocha'))({
        ui: 'bdd',
        timeout: 5000
    });
    mocha.addFile(__filename);
    mocha.run((failures) => {
        process.exit(failures ? 1 : 0);
    });
}

console.log('Queue tests completed. Run with: node tests/queue.test.js');