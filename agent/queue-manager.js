import winston from 'winston';

// Configure winston logger for queue manager
const queueLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'queue-manager' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: 'logs/queue-manager.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
      tailable: true
    })
  ]
});
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PromptQueue {
  constructor(options = {}) {
    // Add unique instance ID for logging
    this.instanceId = `queue_instance_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    queueLogger.info('PromptQueue instance created', { instanceId: this.instanceId, queueFile: options.queueFile });
  
    this.queueFile = options.queueFile || path.join(__dirname, '..', 'data', 'queue.json');
    this.backupDir = options.backupDir || path.join(__dirname, '..', 'data', 'backups');
    this.maxBackups = options.maxBackups || 10;
    this.autoSave = options.autoSave !== false;
    this.aiProcessor = options.aiProcessor || null;
  
    this.queue = [];
    this.loadQueue();
    this.ensureDirectories();
  }

  /**
   * Ensures required directories exist
   */
  ensureDirectories() {
    const dataDir = path.dirname(this.queueFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Generate unique task ID
   */
  generateId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add prompt to queue with atomic file operations
   * @param {string} prompt - User's natural language specification
   * @param {Object} options - Configuration options
   */
  async addPrompt(prompt, options = {}) {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt is required and must be a string');
    }

    const taskOptions = {
      type: options.type || 'generation',
      priority: options.priority || 'normal',
      metadata: options.metadata || {},
      ...options
    };

    const task = {
      id: this.generateId(),
      prompt: prompt.trim(),
      type: taskOptions.type,
      priority: taskOptions.priority,
      status: 'queued',
      created: new Date().toISOString(),
      started: null,
      completed: null,
      result: {},
      errors: [],
      metadata: taskOptions.metadata
    };

    try {
      this.queue.push(task);
      if (this.autoSave) {
        await this.saveQueue();
      }
      return task.id;
    } catch (error) {
      this.queue.pop(); // Remove failed task
      throw new Error(`Failed to add prompt to queue: ${error.message}`);
    }
  }

  /**
   * Get next prompt for processing based on priority
   */
  async getNextPrompt() {
    if (this.queue.length === 0) return null;

    // Sort by priority (high -> normal -> low) then by creation time
    const priorityOrder = { high: 3, normal: 2, low: 1 };

    const processableTasks = this.queue.filter(task => task.status === 'queued');

    if (processableTasks.length === 0) return null;

    processableTasks.sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.created) - new Date(b.created);
    });

    const nextTask = processableTasks[0];
    nextTask.status = 'processing';
    nextTask.started = new Date().toISOString();

    if (this.autoSave) {
      await this.saveQueue();
    }

    return nextTask;
  }

  /**
   * Update prompt status and result
   * @param {string} id - Task ID
   * @param {string} status - New status
   * @param {Object} result - Task result data
   */
  async updatePromptStatus(id, status, result = {}) {
    const taskIndex = this.queue.findIndex(task => task.id === id);
    if (taskIndex === -1) {
      throw new Error(`Task ${id} not found`);
    }

    const task = this.queue[taskIndex];

    // Validate status transitions
    const validStatuses = ['queued', 'processing', 'completed', 'failed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    task.status = status;
    task.result = { ...task.result, ...result };

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      task.completed = new Date().toISOString();
    }

    if (this.autoSave) {
      await this.saveQueue();
    }

    return task;
  }

  /**
   * Remove completed/cancelled tasks from queue
   * @param {string} id - Task ID
   */
  async removePrompt(id) {
    const taskIndex = this.queue.findIndex(task => task.id === id);
    if (taskIndex === -1) {
      throw new Error(`Task ${id} not found`);
    }

    const task = this.queue[taskIndex];

    // Only allow removal of completed, failed, or cancelled tasks
    if (!['completed', 'failed', 'cancelled'].includes(task.status)) {
      throw new Error(`Cannot remove task ${id} with active status: ${task.status}`);
    }

    this.queue.splice(taskIndex, 1);

    if (this.autoSave) {
      await this.saveQueue();
    }

    return true;
  }

  /**
   * List prompts with filtering
   * @param {Object} filter - Filter criteria
   */
  async listPrompts(filter = {}) {
    let filtered = [...this.queue];

    if (filter.status) {
      if (Array.isArray(filter.status)) {
        filtered = filtered.filter(task => filter.status.includes(task.status));
      } else {
        filtered = filtered.filter(task => task.status === filter.status);
      }
    }

    if (filter.type) {
      filtered = filtered.filter(task => task.type === filter.type);
    }

    if (filter.priority) {
      filtered = filtered.filter(task => task.priority === filter.priority);
    }

    if (filter.search) {
      const searchTerm = filter.search.toLowerCase();
      filtered = filtered.filter(task =>
        task.prompt.toLowerCase().includes(searchTerm) ||
        task.id.toLowerCase().includes(searchTerm)
      );
    }

    // Sort by priority then creation time
    const priorityOrder = { high: 3, normal: 2, low: 1 };
    filtered.sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.created) - new Date(b.created);
    });

    return filtered;
  }

  /**
   * Re-prioritize tasks based on dependencies and urgency
   */
  async reorderPrompts() {
    const priorityOrder = { high: 3, normal: 2, low: 1 };

    this.queue.sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.created) - new Date(b.created);
    });

    if (this.autoSave) {
      await this.saveQueue();
    }

    return this.queue;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const stats = {
      total: this.queue.length,
      byStatus: {},
      byType: {},
      byPriority: {},
      averageProcessingTime: 0
    };

    const validStatuses = ['queued', 'processing', 'completed', 'failed', 'cancelled'];
    const validTypes = ['generation', 'optimization', 'testing', 'debugging', 'custom'];
    const validPriorities = ['high', 'normal', 'low'];

    // Initialize counters
    validStatuses.forEach(status => stats.byStatus[status] = 0);
    validTypes.forEach(type => stats.byType[type] = 0);
    validPriorities.forEach(priority => stats.byPriority[priority] = 0);

    let totalProcessingTime = 0;
    let completedTasks = 0;

    this.queue.forEach(task => {
      stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1;
      stats.byType[task.type] = (stats.byType[task.type] || 0) + 1;
      stats.byPriority[task.priority] = (stats.byPriority[task.priority] || 0) + 1;

      // Calculate processing time for completed tasks
      if (task.completed && task.started) {
        const processingTime = new Date(task.completed) - new Date(task.started);
        totalProcessingTime += processingTime;
        completedTasks++;
      }
    });

    if (completedTasks > 0) {
      stats.averageProcessingTime = totalProcessingTime / completedTasks;
    }

    return stats;
  }

  /**
   * Remove completed/cancelled tasks
   */
  async cleanCompleted() {
    const before = this.queue.length;

    // Remove completed, failed, or cancelled tasks
    this.queue = this.queue.filter(task =>
      !['completed', 'failed', 'cancelled'].includes(task.status)
    );

    const removed = before - this.queue.length;

    if (this.autoSave && removed > 0) {
      await this.saveQueue();
    }

    return { removed, remaining: this.queue.length };
  }

  /**
   * Add multiple prompts at once
   * @param {Array} prompts - Array of prompt objects
   */
  async addBatchPrompts(prompts) {
    if (!Array.isArray(prompts)) {
      throw new Error('Prompts must be an array');
    }

    const results = [];
    const errors = [];

    for (const promptData of prompts) {
      try {
        const id = await this.addPrompt(promptData.prompt, promptData.options || {});
        results.push({ id, success: true });
      } catch (error) {
        errors.push({
          prompt: promptData.prompt,
          error: error.message
        });
        results.push({ id: null, success: false, error: error.message });
      }
    }

    return { results, errors };
  }

  /**
   * Process tasks by prefix filter
   * @param {string} prefix - Task ID prefix to process
   */
  async processBatch(prefix) {
    const matchingTasks = this.queue.filter(task =>
      task.status === 'queued' && task.id.startsWith(prefix || 'task_')
    );

    if (matchingTasks.length === 0) {
      return { processed: 0, total: 0 };
    }

    let processed = 0;

    for (const task of matchingTasks) {
      try {
        await this.updatePromptStatus(task.id, 'processing');

        let result = {};

        // If AI processor is available, process the task
        if (this.aiProcessor && task.type !== 'custom') {
          const aiResult = await this.aiProcessor.generateWithBestModel(task.prompt, task.type);
          result = {
            aiModel: aiResult.model,
            aiResponse: aiResult.response,
            aiSuccess: aiResult.success,
            timestamp: aiResult.timestamp
          };
        } else {
          // Fallback - just mark as processed without AI
          result = {
            processed: true,
            note: 'AI processor not available',
            timestamp: new Date().toISOString()
          };
        }

        await this.updatePromptStatus(task.id, 'completed', result);
        processed++;
      } catch (error) {
        await this.updatePromptStatus(task.id, 'failed', {
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    return { processed, total: matchingTasks.length };
  }

  /**
   * Load queue from persistent storage
   */
  async loadQueue() {
    try {
      queueLogger.info('Loading queue from file', { instanceId: this.instanceId, queueFile: this.queueFile, fileSize: fs.existsSync(this.queueFile) ? fs.statSync(this.queueFile).size : 0 });
      if (fs.existsSync(this.queueFile)) {
        const data = fs.readFileSync(this.queueFile, 'utf8');
        this.queue = JSON.parse(data);
        queueLogger.info('Queue loaded successfully', { instanceId: this.instanceId, queueLength: this.queue.length });
      } else {
        this.queue = [];
        queueLogger.info('No queue file found, starting empty queue', { instanceId: this.instanceId });
      }
    } catch (error) {
      queueLogger.warn('Failed to load queue from file, using empty queue', {
        instanceId: this.instanceId,
        error: error.message,
        stack: error.stack,
        backupCreated: fs.existsSync(this.queueFile)
      });
      // Create backup of corrupt file if it exists
      if (fs.existsSync(this.queueFile)) {
        const backupPath = path.join(this.backupDir, `queue_corrupt_${Date.now()}.json`);
        fs.renameSync(this.queueFile, backupPath);
      }
      this.queue = [];
    }
  }

  /**
   * Save queue to persistent storage with atomic writes
   */
  async saveQueue() {
    try {
      queueLogger.info('Saving queue to file', { instanceId: this.instanceId, queueLength: this.queue.length, queueFile: this.queueFile });
      // Create backup of current queue if it exists
      if (fs.existsSync(this.queueFile)) {
        const backupPath = path.join(this.backupDir, `queue_backup_${Date.now()}.json`);
        fs.copyFileSync(this.queueFile, backupPath);
        this.cleanOldBackups();
      }
  
      // Write to temporary file first
      const tempFile = `${this.queueFile}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(this.queue, null, 2));
  
      // Atomic move
      fs.renameSync(tempFile, this.queueFile);
      queueLogger.info('Queue saved successfully', { instanceId: this.instanceId, queueFile: this.queueFile });
    } catch (error) {
      queueLogger.error('Failed to save queue', { instanceId: this.instanceId, error: error.message, stack: error.stack });
      throw new Error(`Failed to save queue: ${error.message}`);
    }
  }

  /**
   * Clean up old backup files
   */
  cleanOldBackups() {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('queue_backup_'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          timestamp: parseInt(file.match(/queue_backup_(\d+)/)[1])
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

      if (files.length > this.maxBackups) {
        const toDelete = files.slice(this.maxBackups);
        toDelete.forEach(file => {
          try {
            fs.unlinkSync(file.path);
          } catch (error) {
            queueLogger.warn('Failed to delete old backup file', {
              filename: file.name,
              error: error.message,
              errorType: error.constructor.name,
              stack: error.stack
            });
          }
        });
      }
    } catch (error) {
      queueLogger.warn('Failed to clean old backups', {
        error: error.message,
        errorType: error.constructor.name,
        stack: error.stack
      });
    }
  }

  /**
   * List available backups
   */
  listBackups() {
    try {
      return fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('queue_backup_'))
        .map(file => {
          const timestamp = parseInt(file.match(/queue_backup_(\d+)/)[1]);
          return {
            name: file,
            path: path.join(this.backupDir, file),
            timestamp: new Date(timestamp).toISOString()
          };
        })
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      queueLogger.warn('Failed to list backups', {
        error: error.message,
        errorType: error.constructor.name,
        stack: error.stack
      });
      return [];
    }
  }

  /**
   * Restore queue from backup
   * @param {string} backupFile - Backup filename
   */
  async restoreFromBackup(backupFile) {
    const backupPath = path.join(this.backupDir, backupFile);
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file ${backupFile} not found`);
    }

    try {
      const data = fs.readFileSync(backupPath, 'utf8');
      const backupQueue = JSON.parse(data);

      // Validate backup data
      if (!Array.isArray(backupQueue)) {
        throw new Error('Invalid backup data format');
      }

      // Create final backup of current state
      if (this.queue.length > 0) {
        const finalBackup = path.join(this.backupDir, `queue_pre_restore_${Date.now()}.json`);
        fs.writeFileSync(finalBackup, JSON.stringify(this.queue, null, 2));
      }

      this.queue = backupQueue;
      await this.saveQueue();

      return { success: true, restored: backupQueue.length };
    } catch (error) {
      throw new Error(`Failed to restore from backup: ${error.message}`);
    }
  }

  /**
   * Export queue data for external processing
   * @param {Object} options - Export options
   */
  exportQueue(options = {}) {
    let data = [...this.queue];

    if (options.filter) {
      data = data.filter(task => {
        if (options.filter.status && task.status !== options.filter.status) return false;
        if (options.filter.type && task.type !== options.filter.type) return false;
        if (options.filter.priority && task.priority !== options.filter.priority) return false;
        return true;
      });
    }

    return {
      exportTimestamp: new Date().toISOString(),
      totalTasks: data.length,
      queue: data
    };
  }

  /**
   * Import queue data with validation
   * @param {Object} importData - Queue data to import
   */
  async importQueue(importData) {
    if (!importData.queue || !Array.isArray(importData.queue)) {
      throw new Error('Invalid import data format');
    }

    // Validate each task
    const validatedTasks = [];
    const validationErrors = [];

    for (const task of importData.queue) {
      try {
        const validatedTask = this.validateAndNormalizeTask(task);
        validatedTasks.push(validatedTask);
      } catch (error) {
        validationErrors.push({
          task: task.id || 'unknown',
          error: error.message
        });
      }
    }

    if (validationErrors.length > 0) {
      queueLogger.warn('Import validation errors detected', {
        errorCount: validationErrors.length,
        errors: validationErrors.map(err => ({
          taskId: err.task,
          error: err.error
        }))
      });
    }

    // Create backup of current queue
    if (this.queue.length > 0) {
      const backupPath = path.join(this.backupDir, `queue_pre_import_${Date.now()}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(this.queue, null, 2));
    }

    this.queue = [...this.queue, ...validatedTasks];
    await this.saveQueue();

    return {
      imported: validatedTasks.length,
      total: this.queue.length,
      errors: validationErrors.length
    };
  }

  /**
   * Validate and normalize a task object
   */
  validateAndNormalizeTask(task) {
    const validated = {
      id: task.id || this.generateId(),
      prompt: task.prompt || '',
      type: ['generation', 'optimization', 'testing', 'debugging', 'custom'].includes(task.type)
        ? task.type : 'custom',
      priority: ['high', 'normal', 'low'].includes(task.priority)
        ? task.priority : 'normal',
      status: ['queued', 'processing', 'completed', 'failed', 'cancelled'].includes(task.status)
        ? task.status : 'queued',
      created: task.created || new Date().toISOString(),
      started: task.started || null,
      completed: task.completed || null,
      result: task.result || {},
      errors: Array.isArray(task.errors) ? task.errors : [],
      metadata: typeof task.metadata === 'object' ? task.metadata : {}
    };

    if (!validated.prompt) {
      throw new Error('Task must have a prompt');
    }

    return validated;
  }

  /**
   * Get queue size and performance metrics
   */
  getMetrics() {
    const metrics = {
      queueSize: this.queue.length,
      activeTasks: this.queue.filter(t => t.status === 'processing').length,
      queuedTasks: this.queue.filter(t => t.status === 'queued').length,
      completedTasks: this.queue.filter(t => t.status === 'completed').length,
      failedTasks: this.queue.filter(t => t.status === 'failed').length,
      averageWaitTime: 0,
      averageProcessingTime: 0
    };

    let totalWaitTime = 0;
    let totalProcessingTime = 0;
    let waitCount = 0;
    let processingCount = 0;

    this.queue.forEach(task => {
      if (task.started && task.created) {
        totalWaitTime += new Date(task.started) - new Date(task.created);
        waitCount++;
      }

      if (task.completed && task.started) {
        totalProcessingTime += new Date(task.completed) - new Date(task.started);
        processingCount++;
      }
    });

    if (waitCount > 0) {
      metrics.averageWaitTime = totalWaitTime / waitCount;
    }

    if (processingCount > 0) {
      metrics.averageProcessingTime = totalProcessingTime / processingCount;
    }

    return metrics;
  }
}

export default PromptQueue;