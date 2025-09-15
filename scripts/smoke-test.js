#!/usr/bin/env node

// Simple smoke test for MCP endpoints
// Usage: node scripts/smoke-test.js

import fetch from 'node-fetch';

const BASE = process.env.MCP_BASE || 'http://localhost:8001';
const API_KEY = process.env.MCP_API_KEY || 'default-api-key-change-in-production';

async function postLoadProgram() {
  const res = await fetch(`${BASE}/mcp/memory/loadProgram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({ bytecode: [169,1,0], startAddress: 1536 })
  });
  const json = await res.json();
  return { status: res.status, body: json };
}

async function getCpuState() {
  const res = await fetch(`${BASE}/mcp/cpu/state`, { headers: { 'x-api-key': API_KEY } });
  return { status: res.status, body: await res.json() };
}

async function postCpuStep() {
  const res = await fetch(`${BASE}/mcp/cpu/step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({ timeout: 1000 })
  });
  const body = res.status === 200 ? await res.json() : await res.text();
  return { status: res.status, body };
}

(async () => {
  try {
    console.log('Running MCP smoke tests against', BASE);
    const load = await postLoadProgram();
    console.log('loadProgram:', load.status, JSON.stringify(load.body));

    const state = await getCpuState();
    console.log('cpu/state:', state.status, JSON.stringify(state.body));

    const step = await postCpuStep();
    console.log('cpu/step:', step.status, JSON.stringify(step.body));

    const ok = load.status === 200 && state.status === 200 && step.status === 200;
    process.exit(ok ? 0 : 2);
  } catch (err) {
    console.error('Smoke test failed:', err.message);
    process.exit(3);
  }
})();
