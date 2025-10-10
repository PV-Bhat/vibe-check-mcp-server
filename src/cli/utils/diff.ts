import { createTwoFilesPatch } from 'diff';

export function renderUnifiedDiff(oldPath: string, newPath: string, oldContent: string, newContent: string): string {
  const patch = createTwoFilesPatch(oldPath, newPath, oldContent, newContent, '', '', { context: 3 });
  return patch.trim() ? patch : 'No changes.';
}
