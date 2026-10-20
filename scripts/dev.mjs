#!/usr/bin/env node
/**
 * Runs the frontend and the API together with one command.
 *
 * They are separate packages with separate installs on purpose, which means
 * two terminals and two commands. The usual failure is starting only one: the
 * frontend still loads, but every /api request fails, and Vite's proxy answers
 * 500 because nothing is listening on the target port. A console full of 500s
 * with no obvious cause is a bad way to spend an afternoon.
 *
 * So: `npm run dev` starts both, labels their output, and stops both on Ctrl+C.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const RESET = '\x1b[0m';
const services = [
  { name: 'api', colour: '\x1b[36m', cwd: path.join(root, 'api'), args: ['run', 'dev'] },
  // dev:web, not dev. `npm run dev` here would re-invoke this script.
  { name: 'web', colour: '\x1b[35m', cwd: root, args: ['run', 'dev:web'] },
];

const children = [];
let shuttingDown = false;

function prefixStream(stream, name, colour) {
  let buffer = '';

  stream.on('data', (chunk) => {
    buffer += chunk.toString();

    // Hold back partial lines so a line is never split across two writes.
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      process.stdout.write(`${colour}${name.padEnd(3)}${RESET} ${line}\n`);
    }
  });
}

for (const service of services) {
  const child = spawn('npm', service.args, {
    cwd: service.cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  prefixStream(child.stdout, service.name, service.colour);
  prefixStream(child.stderr, service.name, service.colour);

  child.on('exit', (code) => {
    if (shuttingDown) return;

    // If one side dies, tear the other down rather than leaving a half-working
    // pair that produces confusing 500s.
    process.stdout.write(
      `${service.colour}${service.name.padEnd(3)}${RESET} exited with code ${code}. Stopping the other process.\n`,
    );
    shutdown(code ?? 1);
  });

  children.push(child);
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }

  process.exitCode = code;
  // Give the children a moment to close before the parent leaves.
  setTimeout(() => process.exit(code), 300).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

process.stdout.write('\nStarting the API on :3001 and the app on :3000. Ctrl+C stops both.\n\n');
