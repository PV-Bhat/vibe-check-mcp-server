import { createTwoFilesPatch } from 'diff';

export function formatUnifiedDiff(oldText: string, newText: string, filePath: string): string {
  const fromFile = `${filePath} (current)`;
  const toFile = `${filePath} (proposed)`;
  return createTwoFilesPatch(fromFile, toFile, oldText, newText, '', '', { context: 3 });
}
