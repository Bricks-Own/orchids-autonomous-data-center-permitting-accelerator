#!/usr/bin/env node
// Load Anthropic proxy env vars from file
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(__dirname, '.env.llm');

if (fs.existsSync(envFile)) {
  const content = fs.readFileSync(envFile, 'utf-8');
  const lines = content.split('\n').filter(Boolean);
  for (const line of lines) {
    const eqIdx = line.indexOf('=');
    if (eqIdx > 0) {
      const key = line.substring(0, eqIdx).trim();
      const val = line.substring(eqIdx + 1).trim();
      if (key && val) {
        process.env[key] = val;
        console.log(`Loaded env: ${key}`);
      }
    }
  }
  // Clean up
  fs.unlinkSync(envFile);
}

// Now import and start the real server
import('./server.js');