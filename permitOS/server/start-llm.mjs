#!/usr/bin/env node
// Startup wrapper that passes env vars to the server process
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// These env vars are available in this process context
const neededVars = ['ANTHROPIC_BASE_URL', 'ANTHROPIC_CUSTOM_HEADERS', 'ANTHROPIC_AUTH_TOKEN'];
const env = { ...process.env };

// Log what we have
for (const key of neededVars) {
  if (env[key]) {
    console.log(`Passing ${key} (${env[key].length} chars) to server`);
  }
}

const serverPath = path.join(__dirname, 'server.js');
const child = spawn('node', [serverPath], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code) => {
  process.exit(code);
});