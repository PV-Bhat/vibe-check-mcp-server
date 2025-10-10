#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HELP_TEXT = `vibe-check-mcp CLI (preview)

Usage:
  npx @pv-bhat/vibe-check-mcp --help
  npx @pv-bhat/vibe-check-mcp --version

Flags:
  -h, --help     Show this help message
  -v, --version  Print the CLI version

Commands for starting the server are coming in a future release.`;

function getVersion(): string {
  const cliDir = dirname(fileURLToPath(import.meta.url));
  const packageJsonPath = resolve(cliDir, '..', '..', 'package.json');
  const raw = readFileSync(packageJsonPath, 'utf8');
  const pkg = JSON.parse(raw) as { version?: string };
  return pkg.version ?? '0.0.0';
}

function printHelp() {
  console.log(HELP_TEXT);
}

const args = process.argv.slice(2);

if (args.some((arg) => arg === '--version' || arg === '-v')) {
  console.log(getVersion());
  process.exit(0);
}

if (args.length === 0 || args.some((arg) => arg === '--help' || arg === '-h')) {
  printHelp();
  process.exit(0);
}

printHelp();
process.exit(0);
