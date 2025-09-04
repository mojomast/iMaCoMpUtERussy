import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { resolvePort } from './lib/port-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Server instances and child processes
let httpServer = null;
let mcpChildProcess = null;
let queueChildProcess = null;

const PREFERRED_PORTS = {
  UI: 8000,
  MCP: 8001,
  QUEUE: 8002
};

// Current resolved ports
let resolvedPorts = {
  UI: PREFERRED_PORTS.UI,
  MCP: PREFERRED_PORTS.MCP,
  QUEUE: PREFERRED_PORTS.QUEUE
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // Default to index.html
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const safeSuffix = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safeSuffix);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }

    const ext = path.extname(filePath);
    const contentType = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.wav': 'audio/wav',
      '.mp4': 'video/mp4',
      '.woff': 'application/font-woff',
      '.ttf': 'application/font-ttf',
      '.eot': 'application/vnd.ms-fontobject',
      '.otf': 'application/font-otf',
      '.wasm': 'application/wasm'
    }[ext] || 'text/plain';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Server error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

/**
 * Start MCP server child process
 */
function startMCPServer() {
  return new Promise((resolve, reject) => {
    console.log('Starting MCP Server...');

    mcpChildProcess = spawn('node', ['server/mcp_server.js'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: resolvedPorts.MCP },
      cwd: __dirname
    });

    let stdoutBuffer = '';
    let stderrBuffer = '';

    mcpChildProcess.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      console.log(`[MCP] ${data.toString().trim()}`);
    });

    mcpChildProcess.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
      console.error(`[MCP ERR] ${data.toString().trim()}`);
    });

    mcpChildProcess.on('close', (code) => {
      console.log(`MCP Server exited with code ${code}`);
      if (code !== 0 && stderrBuffer) {
        console.error('MCP Server stderr:', stderrBuffer);
      }
    });

    mcpChildProcess.on('error', (err) => {
      console.error('Failed to start MCP Server:', err);
      reject(err);
    });

    // Wait for startup message or timeout
    const startupTimeout = setTimeout(() => {
      reject(new Error('MCP Server startup timeout'));
    }, 30000); // 30 seconds

    mcpChildProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('MCP Server running')) {
        clearTimeout(startupTimeout);
        console.log('MCP Server started successfully');
        resolve();
      }
    });
  });
}

/**
 * Start Queue server child process
 */
function startQueueServer() {
  return new Promise((resolve, reject) => {
    console.log('Starting Queue Server...');

    queueChildProcess = spawn('node', ['server/queue-server.js'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, QUEUE_PORT: resolvedPorts.QUEUE },
      cwd: __dirname
    });

    let stdoutBuffer = '';

    queueChildProcess.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      console.log(`[QUEUE] ${data.toString().trim()}`);
    });

    queueChildProcess.stderr.on('data', (data) => {
      console.error(`[QUEUE ERR] ${data.toString().trim()}`);
    });

    queueChildProcess.on('close', (code) => {
      console.log(`Queue Server exited with code ${code}`);
    });

    queueChildProcess.on('error', (err) => {
      console.error('Failed to start Queue Server:', err);
      reject(err);
    });

    // Wait for startup message
    const startupTimeout = setTimeout(() => {
      reject(new Error('Queue Server startup timeout'));
    }, 30000);

    queueChildProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Queue Server running')) {
        clearTimeout(startupTimeout);
        console.log('Queue Server started successfully');
        resolve();
      }
    });
  });
}

/**
 * Start all services sequentially
 */
async function startAllServices() {
  try {
    console.log('Initializing iMaCoMpUtERussy system...');

    // Resolve ports for all services
    resolvedPorts.UI = await resolvePort(PREFERRED_PORTS.UI, 'UI Server', console);
    resolvedPorts.MCP = await resolvePort(PREFERRED_PORTS.MCP, 'MCP Server', console);
    resolvedPorts.QUEUE = await resolvePort(PREFERRED_PORTS.QUEUE, 'Queue Server', console);

    console.log(`Resolved ports - UI: ${resolvedPorts.UI}, MCP: ${resolvedPorts.MCP}, Queue: ${resolvedPorts.QUEUE}`);

    // Start MCP Server first
    await startMCPServer();

    // Start Queue Server
    await startQueueServer();

    // Start UI Server
    await startUIServer();

  } catch (error) {
    console.error('Failed to start services:', error);
    process.exit(1);
  }
}

/**
 * Start UI Server (this HTTP server)
 */
function startUIServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url, true);
      let pathname = parsedUrl.pathname;

      // Default to index.html
      if (pathname === '/') {
        pathname = '/index.html';
      }

      const safeSuffix = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
      const filePath = path.join(__dirname, safeSuffix);

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('File not found');
          return;
        }

        const ext = path.extname(filePath);
        const contentType = {
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'text/javascript',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.wav': 'audio/wav',
          '.mp4': 'video/mp4',
          '.woff': 'application/font-woff',
          '.ttf': 'application/font-ttf',
          '.eot': 'application/vnd.ms-fontobject',
          '.otf': 'application/font-otf',
          '.wasm': 'application/wasm'
        }[ext] || 'text/plain';

        fs.readFile(filePath, (err, content) => {
          if (err) {
            res.writeHead(500);
            res.end('Server error');
            return;
          }
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content);
        });
      });
    });

    httpServer = server;

    server.listen(resolvedPorts.UI, () => {
      console.log(`UI Server running at http://localhost:${resolvedPorts.UI}`);
      console.log(`iMaCoMpUtERussy system initialized successfully!`);
      console.log(`- MCP Server: http://localhost:${resolvedPorts.MCP}`);
      console.log(`- Queue Server: http://localhost:${resolvedPorts.QUEUE}`);
      console.log(`- UI: http://localhost:${resolvedPorts.UI}`);
      resolve();
    });

    server.on('error', (err) => {
      console.error('UI Server error:', err);
      reject(err);
    });
  });
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT. Performing graceful shutdown...');
  await shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM. Performing graceful shutdown...');
  await shutdown();
  process.exit(0);
});

/**
 * Perform graceful shutdown of all services
 */
async function shutdown() {
  console.log('Shutting down services...');

  // Close HTTP server
  if (httpServer) {
    console.log('Stopping UI Server...');
    httpServer.close(() => {
      console.log('UI Server stopped');
    });
  }

  // Kill child processes
  if (mcpChildProcess) {
    console.log('Stopping MCP Server...');
    mcpChildProcess.kill('SIGTERM');
    setTimeout(() => {
      if (!mcpChildProcess.killed) {
        mcpChildProcess.kill('SIGKILL');
      }
    }, 5000);
  }

  if (queueChildProcess) {
    console.log('Stopping Queue Server...');
    queueChildProcess.kill('SIGTERM');
    setTimeout(() => {
      if (!queueChildProcess.killed) {
        queueChildProcess.kill('SIGKILL');
      }
    }, 5000);
  }

  // Wait a moment for cleanup
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('Shutdown complete');
}

// Start the system
startAllServices().catch(error => {
  console.error('Critical error during startup:', error);
  process.exit(1);
});
