interface ConstitutionEntry {
  rules: string[];
  updated: number;
}

const constitutionMap: Record<string, ConstitutionEntry> = Object.create(null);

const MAX_RULES_PER_SESSION = 50;
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

export function updateConstitution(sessionId: string, rule: string) {
  if (!sessionId || !rule) return;
  const entry = constitutionMap[sessionId] || { rules: [], updated: 0 };
  if (entry.rules.length >= MAX_RULES_PER_SESSION) entry.rules.shift();
  entry.rules.push(rule);
  entry.updated = Date.now();
  constitutionMap[sessionId] = entry;
}

export function resetConstitution(sessionId: string, rules: string[]) {
  if (!sessionId || !Array.isArray(rules)) return;
  constitutionMap[sessionId] = {
    rules: rules.slice(0, MAX_RULES_PER_SESSION),
    updated: Date.now()
  };
}

export function getConstitution(sessionId: string): string[] {
  const entry = constitutionMap[sessionId];
  if (!entry) return [];
  entry.updated = Date.now();
  return entry.rules;
}

// Cleanup stale sessions to prevent unbounded memory growth
function cleanup() {
  const now = Date.now();
  for (const [sessionId, entry] of Object.entries(constitutionMap)) {
    if (now - entry.updated > SESSION_TTL_MS) {
      delete constitutionMap[sessionId];
    }
  }
}

setInterval(cleanup, SESSION_TTL_MS).unref();

export const __testing = {
  _getMap: () => constitutionMap,
  cleanup
};
