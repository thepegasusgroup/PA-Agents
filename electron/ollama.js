/**
 * Ollama API module for PA-Agents
 * Handles local LLM calls via Ollama REST API.
 * Default: http://localhost:11434
 */

const http = require('http');

const OLLAMA_HOST = 'localhost';
const OLLAMA_PORT = 11434;
const DEFAULT_MODEL = 'qwen3:8b';

// ── Public API ──

async function generate(prompt, options = {}) {
  const model = options.model || DEFAULT_MODEL;
  const system = options.system || '';
  const temperature = options.temperature !== undefined ? options.temperature : 0.3;

  const body = JSON.stringify({
    model,
    prompt,
    system,
    stream: false,
    options: {
      temperature,
      num_predict: options.maxTokens || 1024,
    },
  });

  const data = await httpPost('/api/generate', body);

  if (data.error) {
    throw new Error(data.error);
  }

  return {
    response: (data.response || '').trim(),
    totalDuration: data.total_duration,
    model: data.model,
  };
}

async function chat(messages, options = {}) {
  const model = options.model || DEFAULT_MODEL;
  const temperature = options.temperature !== undefined ? options.temperature : 0.3;

  const body = JSON.stringify({
    model,
    messages,
    stream: false,
    options: {
      temperature,
      num_predict: options.maxTokens || 1024,
    },
  });

  const data = await httpPost('/api/chat', body);

  if (data.error) {
    throw new Error(data.error);
  }

  return {
    response: (data.message?.content || '').trim(),
    totalDuration: data.total_duration,
    model: data.model,
  };
}

async function isAvailable() {
  try {
    const data = await httpGet('/api/tags');
    return { available: true, models: (data.models || []).map(m => m.name) };
  } catch (e) {
    return { available: false, models: [], error: e.message };
  }
}

async function listModels() {
  const data = await httpGet('/api/tags');
  return (data.models || []).map(m => ({
    name: m.name,
    size: m.size,
    modified: m.modified_at,
  }));
}

// ── HTTP Helpers ──

function httpPost(path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON from Ollama: ' + data.substring(0, 200))); }
      });
    });
    req.on('error', (e) => reject(new Error('Ollama connection failed: ' + e.message)));
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('Ollama request timed out')); });
    req.write(body);
    req.end();
  });
}

function httpGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path,
      method: 'GET',
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON from Ollama')); }
      });
    });
    req.on('error', (e) => reject(new Error('Ollama connection failed: ' + e.message)));
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Ollama request timed out')); });
    req.end();
  });
}

module.exports = { generate, chat, isAvailable, listModels };
