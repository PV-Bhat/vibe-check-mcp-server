import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const resolvePath = (relativePath) => join(rootDir, relativePath);

const loadJson = async (relativePath) => {
  const filePath = resolvePath(relativePath);
  const contents = await readFile(filePath, 'utf8');
  return { filePath, data: JSON.parse(contents) };
};

const writeJson = async (filePath, data) => {
  const serialized = JSON.stringify(data, null, 2) + '\n';
  await writeFile(filePath, serialized, 'utf8');
};

const replaceInFile = async (relativePath, replacements) => {
  const filePath = resolvePath(relativePath);
  let contents = await readFile(filePath, 'utf8');
  for (const { pattern, value } of replacements) {
    contents = contents.replace(pattern, value);
  }
  await writeFile(filePath, contents, 'utf8');
};

const main = async () => {
  const { data: versionData } = await loadJson('version.json');
  const newVersion = versionData.version;

  if (typeof newVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(newVersion)) {
    throw new Error(`Invalid semver version in version.json: "${newVersion}"`);
  }

  const { filePath: packageJsonPath, data: packageJson } = await loadJson('package.json');
  if (packageJson.version !== newVersion) {
    packageJson.version = newVersion;
    await writeJson(packageJsonPath, packageJson);
  }

  try {
    const { filePath: lockPath, data: packageLock } = await loadJson('package-lock.json');
    let updatedLock = false;
    if (packageLock.version !== newVersion) {
      packageLock.version = newVersion;
      updatedLock = true;
    }
    if (packageLock.packages?.['']?.version && packageLock.packages[''].version !== newVersion) {
      packageLock.packages[''].version = newVersion;
      updatedLock = true;
    }
    if (updatedLock) {
      await writeJson(lockPath, packageLock);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  await replaceInFile('README.md', [
    { pattern: /Vibe Check MCP v\d+\.\d+\.\d+/, value: `Vibe Check MCP v${newVersion}` },
    { pattern: /version-\d+\.\d+\.\d+-purple/, value: `version-${newVersion}-purple` },
    { pattern: /## What's New in v\d+\.\d+\.\d+/, value: `## What's New in v${newVersion}` }
  ]);

  await replaceInFile('CHANGELOG.md', [
    { pattern: /## v\d+\.\d+\.\d+ -/, value: `## v${newVersion} -` }
  ]);

  console.log(`Synchronized project files to version ${newVersion}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
