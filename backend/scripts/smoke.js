#!/usr/bin/env node

const { URL } = require('url');

function fail(message) {
  console.error(`SMOKE FAIL: ${message}`);
  process.exit(1);
}

async function callJson(baseUrl, path) {
  const target = new URL(path, baseUrl).toString();
  const response = await fetch(target);
  const text = await response.text();

  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch (_) {
      throw new Error(`${path} returned non-JSON response`);
    }
  }

  return { status: response.status, body };
}

function assertHealth(payload) {
  if (!payload || payload.ok !== true || payload.service !== 'football-backend' || typeof payload.storage !== 'string' || typeof payload.timestamp !== 'string') {
    throw new Error('/health returned unexpected payload shape');
  }
}

function assertReady(payload) {
  if (!payload || payload.ok !== true || typeof payload.storage !== 'string') throw new Error('/ready missing basic fields');
  if (!payload.checks || payload.checks.repositories !== true || payload.checks.database !== true) throw new Error('/ready checks are not successful');
  if (typeof payload.timestamp !== 'string') throw new Error('/ready missing timestamp');
}

function assertActiveRequests(payload) {
  if (!Array.isArray(payload)) throw new Error('/requests/active should return an array');
}

async function run() {
  if (typeof fetch !== 'function') {
    fail('Global fetch is unavailable in this Node runtime. Please run with Node 18+ or newer.');
  }

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  try {
    const health = await callJson(baseUrl, '/health');
    if (health.status !== 200) throw new Error(`/health expected 200, received ${health.status}`);
    assertHealth(health.body);

    const ready = await callJson(baseUrl, '/ready');
    if (ready.status !== 200) throw new Error(`/ready expected 200, received ${ready.status}`);
    assertReady(ready.body);

    const active = await callJson(baseUrl, '/requests/active');
    if (active.status !== 200) throw new Error(`/requests/active expected 200, received ${active.status}`);
    assertActiveRequests(active.body);

    console.log(`SMOKE PASS: ${baseUrl}`);
  } catch (error) {
    fail(error.message);
  }
}

run();
