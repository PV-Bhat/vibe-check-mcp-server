export const constitutionMap: Record<string, string[]> = Object.create(null);

export function updateConstitution(sessionId: string, rule: string) {
  if (!sessionId || !rule) return;
  if (!constitutionMap[sessionId]) constitutionMap[sessionId] = [];
  constitutionMap[sessionId].push(rule);
}

export function resetConstitution(sessionId: string, rules: string[]) {
  if (!sessionId || !Array.isArray(rules)) return;
  constitutionMap[sessionId] = [...rules];
}

export function getConstitution(sessionId: string): string[] {
  return constitutionMap[sessionId] || [];
}
