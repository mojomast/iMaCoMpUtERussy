#!/usr/bin/env node
// Lightweight dev proxy to serve static UI and proxy MCP endpoints to backend servers
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UI_PORT = process.env.UI_PORT || 3001; // serve UI from this origin by default
const MCP_TARGET = process.env.MCP_TARGET || 'http://localhost:8001';
const QUEUE_TARGET = process.env.QUEUE_TARGET || 'http://localhost:8002';

const app = express();

// Serve static files from project root
app.use(express.static(path.join(__dirname)));
// Special proxy-aware health endpoint for MCP so the browser receives a friendly
// JSON response even if the backend is slow/unavailable. Register this before
// the general proxy middleware so it is handled locally.
app.get('/mcp/health', async (req, res) => {
  const controller = new AbortController();
  const timeoutMs = 900; // short probe timeout
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const backendUrl = `${MCP_TARGET.replace(/\/+$/,'')}/health`;
    const resp = await fetch(backendUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (resp && resp.ok) {
      const data = await resp.json().catch(() => ({ status: 'ok' }));
      res.json({ status: 'ok', proxy: true, backend: true, backendData: data });
      return;
    }
    res.status(502).json({ status: 'backend-unavailable', proxy: true });
  } catch (e) {
    clearTimeout(timeout);
    res.status(502).json({ status: 'backend-unavailable', proxy: true, error: String(e) });
  }
});

// General health endpoint for proxy server
app.get('/health', (req, res) => res.json({ status: 'ok', proxy: true, mcpTarget: MCP_TARGET }));

// Proxy MCP and queue endpoints to backend servers (registered after special handlers)
app.use('/mcp', createProxyMiddleware({ target: MCP_TARGET, changeOrigin: true, logLevel: 'debug' }));
app.use('/queue', createProxyMiddleware({ target: QUEUE_TARGET, changeOrigin: true, logLevel: 'debug' }));

app.listen(UI_PORT, () => {
  console.log(`Dev proxy serving UI at http://localhost:${UI_PORT}`);
  console.log(`Proxying /mcp -> ${MCP_TARGET}`);
  console.log(`Proxying /queue -> ${QUEUE_TARGET}`);
  console.log('Set MCP_TARGET and QUEUE_TARGET environment variables to change targets');
});
