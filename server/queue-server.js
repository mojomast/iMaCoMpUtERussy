#!/usr/bin/env node

/**
 * AI Prompt Queue Server
 *
 * Standalone Express.js server providing queue management endpoints
 * for autonomous software generation workflows.
 */

import express from 'express';
import cors from 'cors';
import PromptQueue from '../agent/queue-manager.js';
import { resolvePort } from '../lib/port-utils.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();
const PORT = process.env.QUEUE_PORT || 8002;

// Server instance for graceful shutdown
let server = null;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize queue system
let queueManager;

function initializeQueue() {
  try {
    queueManager = new PromptQueue({
      queueFile: path.join(__dirname, '..', 'data', 'queue.json'),
      backupDir: path.join(__dirname, '..', 'data', 'backups')
    });
    console.log('Prompt queue system initialized');
  } catch (error) {
    console.error('Error initializing queue system:', error);
    throw error;
  }
}

// Success response helper
function successResponse(data) {
  return {
    success: true,
    data
  };
}

// Error response helper
function errorResponse(code, message) {
  return {
    success: false,
    error: {
      code,
      message
    }
  };
}

// Async route wrapper for error handling
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Queue Management Endpoints

// POST /queue/add - Add new prompt to queue
app.post('/queue/add', asyncHandler(async (req, res) => {
  const { prompt, type = 'generation', priority = 'normal', metadata = {} } = req.body;

  if (!prompt) {
    return res.status(400).json(errorResponse('INVALID_REQUEST', 'Prompt is required'));
  }

  try {
    const taskId = await queueManager.addPrompt(prompt, { type, priority, metadata });
    console.log(`Queue add - taskId:${taskId}, type:${type}, priority:${priority}`);
    res.json(successResponse({ taskId, message: 'Task added to queue' }));
  } catch (error) {
    console.error('Queue add error:', error.message);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to add task to queue'));
  }
}));

// GET /queue/list - List queue items with optional filtering
app.get('/queue/list', asyncHandler(async (req, res) => {
  const { status, type, priority, search } = req.query;

  try {
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (priority) filter.priority = priority;
    if (search) filter.search = search;

    const tasks = await queueManager.listPrompts(filter);
    res.json(successResponse({
      tasks,
      count: tasks.length,
      filter: filter
    }));
  } catch (error) {
    console.error('Queue list error:', error.message);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to list tasks'));
  }
}));

// GET /queue/next - Get next task for processing
app.get('/queue/next', asyncHandler(async (req, res) => {
  try {
    const nextTask = await queueManager.getNextPrompt();
    if (!nextTask) {
      return res.json(successResponse({ task: null, message: 'No tasks available' }));
    }

    console.log(`Queue next - processed task:${nextTask.id}`);
    res.json(successResponse({
      task: nextTask,
      message: 'Task retrieved for processing'
    }));
  } catch (error) {
    console.error('Queue next error:', error.message);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get next task'));
  }
}));

// PUT /queue/:taskId - Update task status
app.put('/queue/:taskId', asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { status, result = {} } = req.body;

  if (!status) {
    return res.status(400).json(errorResponse('INVALID_REQUEST', 'Status is required'));
  }

  try {
    await queueManager.updatePromptStatus(taskId, status, result);
    console.log(`Queue update - taskId:${taskId}, status:${status}`);

    const updatedTask = await queueManager.listPrompts({ search: taskId });
    const task = updatedTask.find(t => t.id === taskId);

    res.json(successResponse({
      task,
      message: 'Task status updated successfully'
    }));
  } catch (error) {
    console.error('Queue update error:', error.message);
    if (error.message.includes('not found')) {
      return res.status(404).json(errorResponse('NOT_FOUND', 'Task not found'));
    }
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to update task'));
  }
}));

// DELETE /queue/:taskId - Remove completed task
app.delete('/queue/:taskId', asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  try {
    await queueManager.removePrompt(taskId);
    console.log(`Queue remove - taskId:${taskId}`);
    res.json(successResponse({ message: 'Task removed successfully' }));
  } catch (error) {
    console.error('Queue remove error:', error.message);
    if (error.message.includes('not found')) {
      return res.status(404).json(errorResponse('NOT_FOUND', 'Task not found'));
    }
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to remove task'));
  }
}));

// GET /queue/stats - Get queue statistics
app.get('/queue/stats', asyncHandler(async (req, res) => {
  try {
    const stats = await queueManager.getQueueStats();
    const metrics = queueManager.getMetrics();

    res.json(successResponse({
      ...stats,
      ...metrics
    }));
  } catch (error) {
    console.error('Queue stats error:', error.message);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get queue statistics'));
  }
}));

// POST /queue/clean - Clean completed tasks
app.post('/queue/clean', asyncHandler(async (req, res) => {
  try {
    const result = await queueManager.cleanCompleted();
    console.log(`Queue clean - removed:${result.removed}, remaining:${result.remaining}`);
    res.json(successResponse(result));
  } catch (error) {
    console.error('Queue clean error:', error.message);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to clean completed tasks'));
  }
}));

// POST /queue/batch - Add multiple prompts
app.post('/queue/batch', asyncHandler(async (req, res) => {
  const { prompts = [] } = req.body;

  if (!Array.isArray(prompts) || prompts.length === 0) {
    return res.status(400).json(errorResponse('INVALID_REQUEST', 'Prompts array is required'));
  }

  try {
    const result = await queueManager.addBatchPrompts(prompts);
    console.log(`Queue batch - added:${result.results.filter(r => r.success).length}, errors:${result.errors.length}`);

    res.json(successResponse({
      ...result,
      message: `Processed ${result.results.length} prompts, ${result.errors.length} errors`
    }));
  } catch (error) {
    console.error('Queue batch error:', error.message);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to process batch tasks'));
  }
}));

// POST /queue/process/:prefix - Process batch by prefix
app.post('/queue/process/:prefix', asyncHandler(async (req, res) => {
  const { prefix } = req.params;

  try {
    const result = await queueManager.processBatch(prefix);
    console.log(`Queue batch process - prefix:${prefix}, processed:${result.processed}/${result.total}`);
    res.json(successResponse(result));
  } catch (error) {
    console.error('Queue batch process error:', error.message);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to process batch tasks'));
  }
}));

// POST /queue/backup - Create manual backup
app.post('/queue/backup', asyncHandler(async (req, res) => {
  try {
    // Force save to create backup
    await queueManager.saveQueue();
    const backups = queueManager.listBackups();

    res.json(successResponse({
      backups,
      message: 'Backup created successfully'
    }));
  } catch (error) {
    console.error('Queue backup error:', error.message);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to create backup'));
  }
}));

// GET /queue/backups - List available backups
app.get('/queue/backups', asyncHandler(async (req, res) => {
  try {
    const backups = queueManager.listBackups();
    res.json(successResponse({ backups }));
  } catch (error) {
    console.error('Queue backups list error:', error.message);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to list backups'));
  }
}));

// POST /queue/restore - Restore from backup
app.post('/queue/restore', asyncHandler(async (req, res) => {
  const { backupFile } = req.body;

  if (!backupFile) {
    return res.status(400).json(errorResponse('INVALID_REQUEST', 'Backup file name is required'));
  }

  try {
    const result = await queueManager.restoreFromBackup(backupFile);
    console.log(`Queue restore - backup:${backupFile}, restored:${result.restored}`);
    res.json(successResponse(result));
  } catch (error) {
    console.error('Queue restore error:', error.message);
    if (error.message.includes('not found')) {
      return res.status(404).json(errorResponse('NOT_FOUND', 'Backup file not found'));
    }
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to restore from backup'));
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Queue Server',
    timestamp: new Date().toISOString()
  });
});

// API info endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'AI Prompt Queue Server',
    version: '1.0.0',
    description: 'Queue management server for autonomous software generation workflows',
    endpoints: [
      'GET  /health - Health check',
      'GET  / - API information',
      'POST /queue/add - Add task to queue',
      'GET  /queue/list - List tasks with filtering',
      'GET  /queue/next - Get next task for processing',
      'PUT  /queue/:taskId - Update task status',
      'DELETE /queue/:taskId - Remove completed task',
      'GET  /queue/stats - Get queue statistics',
      'POST /queue/clean - Clean completed tasks',
      'POST /queue/batch - Add multiple tasks',
      'POST /queue/process/:prefix - Process tasks by prefix',
      'POST /queue/backup - Create backup',
      'GET  /queue/backups - List backups',
      'POST /queue/restore - Restore from backup'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    }
  });
});

// 404 handler
app.use('/queue/*', (req, res) => {
  res.status(404).json(errorResponse('NOT_FOUND', `Endpoint ${req.path} not found`));
});

/**
 * Perform graceful shutdown of Queue server
 */
async function shutdown() {
  console.log('Performing graceful shutdown of Queue Server...');

  try {
    // Stop accepting new connections
    if (server) {
      server.close(() => {
        console.log('HTTP server closed successfully');
      });
    }

    // Save any pending queue state
    if (queueManager) {
      await queueManager.saveQueue();
      console.log('Queue state saved');
      console.log('Cleaning up completed tasks during shutdown...');
      await queueManager.cleanCompleted();
    }

    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));

  } catch (error) {
    console.error('Error during queue server shutdown:', error);
  }

  console.log('Queue Server shutdown complete');
}

// Handle shutdown signals
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT signal');
  try {
    await shutdown();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM signal');
  try {
    await shutdown();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Initialize and start server
async function startServer() {
  try {
    // Resolve port before starting
    const actualPort = await resolvePort(PORT, 'Queue Server', console);

    initializeQueue();

    server = app.listen(actualPort, () => {
      console.log(`AI Prompt Queue Server running on port ${actualPort}`);
      console.log(`Health check: http://localhost:${actualPort}/health`);
      console.log(`API base URL: http://localhost:${actualPort}/queue`);
      console.log('');
      console.log('Queue management endpoints:');
      console.log(`  Add task:    curl -X POST http://localhost:${actualPort}/queue/add -H "Content-Type: application/json" -d '{"prompt":"Generate a hello world program"}'`);
      console.log(`  List tasks:  curl http://localhost:${actualPort}/queue/list`);
      console.log(`  Get next:    curl http://localhost:${actualPort}/queue/next`);
      console.log(`  Get stats:   curl http://localhost:${actualPort}/queue/stats`);
      console.log('');
    });

    // Handle server-level errors
    server.on('error', (error) => {
      console.error('Server error:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('Failed to start Queue server:', error);
    process.exit(1);
  }
}

// Export app for testing
export { app };

// Start server when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}