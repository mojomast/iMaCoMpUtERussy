# AI Prompt Queue System

A robust, persistent queue system for managing autonomous software generation tasks with real-time status tracking and priority management.

## 🚀 **Features**

- **Persistent Storage**: File-based persistence with atomic writes and JSON format
- **Priority System**: Smart task ordering based on priority (high/normal/low)
- **Backup & Recovery**: Automated backup system with manual/automated restoration
- **Batch Operations**: Process multiple tasks efficiently
- **Web API**: Complete RESTful API for queue management
- **Status Tracking**: Comprehensive task lifecycle management
- **Error Recovery**: Built-in retry mechanisms and error handling

## 📝 **Architecture**

### Queue Structure
```javascript
{
  id: "unique-task-id",                // Auto-generated UUID-like ID
  type: "generation|optimization|testing|debugging|custom",
  prompt: "user's natural language specification",
  priority: "high|normal|low",         // Default: normal
  status: "queued|processing|completed|failed|cancelled",
  created: "ISO timestamp",           // When task was added
  started: "ISO timestamp",           // When processing began
  completed: "ISO timestamp",         // When processing finished
  result: {},                         // Output data from processing
  errors: [],                         // Execution errors
  metadata: {}                        // Additional context
}
```

### File Structure
```
data/
├── queue.json                    # Main queue file
└── backups/                      # Automatic backups
    ├── queue_backup_1640000000000.json
    └── queue_pre_import_1640000001000.json
```

## 🏗️ **Components**

### 1. Core Queue Manager (`agent/queue-manager.js`)
```javascript
import PromptQueue from './agent/queue-manager.js';

const queue = new PromptQueue({
  queueFile: 'data/queue.json',
  backupDir: 'data/backups',
  maxBackups: 10,
  autoSave: true
});
```

**Key Methods:**
- `addPrompt(prompt, options)` - Add task to queue
- `getNextPrompt()` - Get next task for processing
- `updatePromptStatus(id, status, result)` - Update task status
- `listPrompts(filter)` - List tasks with filtering
- `cleanCompleted()` - Remove completed tasks

### 2. Web Server (`server/queue-server.js`)
Standalone Express.js server providing REST endpoints:

- **Port**: 8002 (configurable via `QUEUE_PORT`)
- **Base URL**: `http://localhost:8002/queue`
- **Health Check**: `http://localhost:8002/health`

## 📋 **API Endpoints**

### Task Management
```bash
# Add a new task
POST /queue/add
Content-Type: application/json
{
  "prompt": "Create a simple calculator program",
  "type": "generation",
  "priority": "high",
  "metadata": { "user": "alice", "project": "math-utils" }
}

# Get next task for processing
GET /queue/next

# List tasks with optional filtering
GET /queue/list?status=queued&type=generation

# Update task status
PUT /queue/{taskId}
{
  "status": "completed",
  "result": { "program": "..." }
}

# Remove completed task
DELETE /queue/{taskId}
```

### Queue Operations
```bash
# Get queue statistics
GET /queue/stats

# Clean completed tasks
POST /queue/clean

# Add multiple tasks
POST /queue/batch
Content-Type: application/json
{
  "prompts": [
    { "prompt": "Task 1", "priority": "high" },
    { "prompt": "Task 2", "type": "testing" }
  ]
}

# Process tasks by prefix
POST /queue/process/{prefix}
```

### Backup Management
```bash
# Create manual backup
POST /queue/backup

# List available backups
GET /queue/backups

# Restore from backup
POST /queue/restore
{
  "backupFile": "queue_backup_1640000000000.json"
}
```

## 📊 **Usage Examples**

### Basic Task Addition
```bash
curl -X POST http://localhost:8002/queue/add \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a hello world assembly program",
    "type": "generation",
    "priority": "normal"
  }'
```

### Autonomous Processing Loop
```javascript
const queue = new PromptQueue();

// Processing loop
async function processLoop() {
  while (true) {
    const task = await queue.getNextPrompt();
    if (!task) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
      continue;
    }

    try {
      console.log(`Processing: ${task.prompt}`);
      // ... actual processing logic ...
      const result = await processTask(task);
      await queue.updatePromptStatus(task.id, 'completed', result);
    } catch (error) {
      await queue.updatePromptStatus(task.id, 'failed', {
        error: error.message
      });
    }
  }
}

processLoop();
```

### Queue Monitoring
```bash
# Get current queue statistics
curl http://localhost:8002/queue/stats

# List all queued tasks
curl http://localhost:8002/queue/list?status=queued

# List high priority tasks
curl "http://localhost:8002/queue/list?priority=high"
```

## 🎯 **Autonomous Operation**

### Workflow Integration
```javascript
// 1. AI Agent adds tasks to queue
await queue.addPrompt("Generate a sorting algorithm", {
  type: "generation",
  priority: "high",
  metadata: { agent: "code-generator" }
});

// 2. Autonomous processor picks up tasks
const task = await queue.getNextPrompt();

// 3. Agent processes task (could call MCP server for assembly)
const result = await generateCode(task.prompt);

// 4. Update queue with result
await queue.updatePromptStatus(task.id, 'completed', {
  generatedCode: result
});
```

### Multi-Step Workflows
```javascript
// Example: Generate test case for generated code
await queue.addPrompt("Test the sorting algorithm", {
  type: "testing",
  priority: "high",
  metadata: {
    dependsOn: previousTaskId,  // Dependency tracking
    testType: "unit"
  }
});
```

## 🧪 **Testing**

Run the comprehensive test suite:
```bash
npm test -- tests/queue-manager.test.js
```

Tests cover:
- ✅ Core queue operations
- ✅ Persistence and recovery
- ✅ Priority management
- ✅ Batch processing
- ✅ Error handling
- ✅ Backup/restore functionality

## 🔧 **Configuration**

### Environment Variables
```bash
QUEUE_PORT=8002              # Server port (default: 8002)
QUEUE_FILE=data/queue.json   # Queue storage file
BACKUP_DIR=data/backups      # Backup directory
MAX_BACKUPS=10              # Maximum backup files
AUTO_SAVE=true              # Auto-save after operations
```

### Programmatic Configuration
```javascript
const queue = new PromptQueue({
  queueFile: 'path/to/queue.json',
  backupDir: 'path/to/backups',
  maxBackups: 20,
  autoSave: false      // Manual save control
});
```

## 📈 **Monitoring & Metrics**

### Queue Statistics
```javascript
const stats = await queue.getQueueStats();
// {
//   total: 15,
//   byStatus: { queued: 8, processing: 2, completed: 5 },
//   byType: { generation: 10, testing: 5 },
//   byPriority: { high: 3, normal: 10, low: 2 }
// }

const metrics = queue.getMetrics();
// {
//   queueSize: 15,
//   activeTasks: 2,
//   averageWaitTime: 45000,     // ms
//   averageProcessingTime: 12000 // ms
// }
```

### Performance Metrics
- **Average Wait Time**: Time tasks spend waiting in queue
- **Average Processing Time**: Time to complete tasks
- **Throughput**: Tasks processed per unit time
- **Error Rate**: Failed task percentage

## 🛡️ **Reliability Features**

### Atomic Operations
- File operations use temporary files with atomic moves
- No data corruption from interruption during saves
- Automatic recovery from malformed JSON files

### Backup System
```javascript
// Automatic backups on save
// Manual backups via API
// Restore from any backup point
const backups = queue.listBackups();
// Handle corrupted queue files gracefully
```

### Concurrent Safety
- Sequential processing prevents race conditions
- File locking through atomic operations
- Safe multiple reader/single writer pattern

## 🚦 **Error Handling**

### Built-in Retry Logic
```javascript
// Automatic retry for transient failures
if (task.status === 'failed' && canRetry(task)) {
  await queue.updatePromptStatus(task.id, 'queued');
  // Reset for reprocessing
}
```

### Error Classification
- **Transient**: Network timeout, temporary service unavailable
- **Permanent**: Invalid input, authentication failure
- **Retryable**: Service busy, rate limit exceeded

## 🎛️ **Integration Examples**

### With MCP Server
```javascript
// Queue tasks that need emulator interaction
await queue.addPrompt(
  "Assemble and test the factorial function",
  {
    type: "testing",
    priority: "high",
    metadata: {
      needsMCP: true,
      assemblyCode: "..."
    }
  }
);

// Processor can call MCP endpoints
if (task.metadata.needsMCP) {
  await callMCPService(task.metadata.assemblyCode);
}
```

### With External Systems
```javascript
// Integrate with version control
await queue.addPrompt("Update documentation", {
  type: "maintenance",
  metadata: {
    git: true,
    branch: "main"
  }
});
```

## 📚 **Advanced Usage**

### Custom Task Types
```javascript
// Define your own task categories
await queue.addPrompt("Security audit", {
  type: "security",
  priority: "high"
});

// Filter by custom types
const securityTasks = await queue.listPrompts({
  type: "security"
});
```

### Dependency Management
```javascript
// Track task dependencies
await queue.addPrompt("Deploy to staging", {
  type: "deployment",
  metadata: {
    dependsOn: deploymentTaskId,
    environment: "staging"
  }
});
```

### Custom Priority Logic
```javascript
// Implement custom prioritization
const customPriorityOrder = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1
};

queue.customSort = (tasks) =>
  tasks.sort((a, b) => customPriorityOrder[b.priority] - customPriorityOrder[a.priority]);
```

## 🚀 **Getting Started**

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Queue Server**
   ```bash
   npm run queue-server
   ```

3. **Add Your First Task**
   ```bash
   curl -X POST http://localhost:8002/queue/add \
     -H "Content-Type: application/json" \
     -d '{"prompt": "Hello, Queue!"}'
   ```

4. **Monitor Queue**
   ```bash
   curl http://localhost:8002/queue/stats
   ```

## 🔮 **Future Enhancements**

- **Database Integration**: PostgreSQL/MySQL support
- **Clustering**: Distributed queue processing
- **Webhooks**: Real-time notifications
- **Metrics Dashboard**: Graphical monitoring
- **Rate Limiting**: Task processing limits
- **Scheduling**: Timed task execution

---

**Queue System is production-ready and fully autonomous!** 🎉

*Built for autonomous software generation workflows with reliability and performance in mind.*