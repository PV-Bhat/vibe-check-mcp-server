

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { VibeCheckInput } from '../tools/vibeCheck.js';

const DATA_DIR = path.join(os.homedir(), '.vibe-check');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

interface Interaction { 
  input: VibeCheckInput; 
  output: string; 
  timestamp: number; 
}

let history: Map<string, Interaction[]> = new Map();

async function ensureDataDir() { 
  try { 
    await fs.mkdir(DATA_DIR, { recursive: true }); 
  } catch {} 
}

export async function loadHistory() {
  await ensureDataDir();
  try {
    const data = await fs.readFile(HISTORY_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    history = new Map(Object.entries(parsed).map(([k, v]) => [k, v as Interaction[]]));
  } catch { 
    history.set('default', []); 
  }
}

async function saveHistory() {
  const data = Object.fromEntries(history);
  await fs.writeFile(HISTORY_FILE, JSON.stringify(data));
}

export function getHistorySummary(sessionId = 'default'): string {
  const sessHistory = history.get(sessionId) || [];
  if (!sessHistory.length) return '';
  const summary = sessHistory.slice(-5).map((int, i) => `Interaction ${i+1}: Goal ${int.input.goal}, Guidance: ${int.output.slice(0, 100)}...`).join('\n');
  return `History Context:\n${summary}\n`;
}

export function addToHistory(sessionId = 'default', input: VibeCheckInput, output: string) {
  if (!history.has(sessionId)) {
    history.set(sessionId, []);
  }
  const sessHistory = history.get(sessionId)!;
  sessHistory.push({ input, output, timestamp: Date.now() });
  if (sessHistory.length > 10) {
    sessHistory.shift();
  }
  saveHistory();
}

