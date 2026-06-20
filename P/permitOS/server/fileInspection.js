import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export async function scanBytes(bytes, fileName) {
  const scanner = process.env.CLAMSCAN_EXECUTABLE;
  if (!scanner) return { status: 'not-configured', engine: null };
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'permitos-scan-'));
  const tempFile = path.join(tempDir, path.basename(fileName));
  fs.writeFileSync(tempFile, bytes);
  try {
    const result = await run(scanner, ['--no-summary', tempFile], tempDir, 120000);
    return {
      status: result.code === 0 ? 'clean' : result.code === 1 ? 'infected' : 'error',
      engine: 'clamav',
      output: `${result.stdout}\n${result.stderr}`.trim().slice(-5000),
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export async function extractText(bytes, mimeType, fileName) {
  if (mimeType === 'text/plain' || mimeType === 'text/csv' || mimeType === 'application/json') {
    return { status: 'completed', method: 'utf8', text: bytes.toString('utf8').slice(0, 500000) };
  }
  if (mimeType === 'application/pdf') {
    const executable = process.env.PDFTOTEXT_EXECUTABLE;
    if (!executable) return { status: 'not-configured', method: 'pdftotext', text: '' };
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'permitos-pdf-'));
    const source = path.join(tempDir, path.basename(fileName));
    const output = path.join(tempDir, 'output.txt');
    fs.writeFileSync(source, bytes);
    try {
      const result = await run(executable, ['-layout', source, output], tempDir, 120000);
      if (result.code !== 0) return { status: 'error', method: 'pdftotext', text: '', detail: result.stderr.slice(-2000) };
      return { status: 'completed', method: 'pdftotext', text: fs.readFileSync(output, 'utf8').slice(0, 500000) };
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(bytes);
      const xml = zip.readAsText('word/document.xml');
      const text = xml.replace(/<w:tab[^>]*\/>/g, '\t').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return { status: 'completed', method: 'docx-xml', text: text.slice(0, 500000) };
    } catch (error) {
      return { status: 'error', method: 'docx-xml', text: '', detail: error.message };
    }
  }
  return { status: 'unsupported', method: null, text: '' };
}

function run(executable, args, cwd, timeout) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, windowsHide: true, timeout });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', value => { stdout += value; });
    child.stderr.on('data', value => { stderr += value; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}
