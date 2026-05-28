const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function parseAuditJsonFromError(err) {
  if (typeof err?.stdout === 'string' && err.stdout.trim()) {
    try {
      return JSON.parse(err.stdout);
    } catch {
      return null;
    }
  }
  if (typeof err?.output?.[1] === 'string' && err.output[1].trim()) {
    try {
      return JSON.parse(err.output[1]);
    } catch {
      return null;
    }
  }
  return null;
}

function runAudit() {
  let json;
  try {
    const output = execSync('npm audit --omit=dev --json', { encoding: 'utf8' });
    json = JSON.parse(output);
  } catch (err) {
    // npm audit returns non-zero when vulnerabilities are present.
    json = parseAuditJsonFromError(err);
    if (!json) {
      console.error('npm audit failed to produce JSON output');
      console.error(err.message);
      process.exitCode = 1;
      return;
    }
  }

  const vulnerabilities = json.vulnerabilities || {};
  let highOrCritical = 0;
  for (const name of Object.keys(vulnerabilities)) {
    const v = vulnerabilities[name];
    if (['high', 'critical'].includes(v.severity)) {
      console.error(`High severity issue in dependency: ${name}`);
      highOrCritical++;
    }
  }

  if (highOrCritical > 0) {
    console.error(`Found ${highOrCritical} high or critical vulnerabilities`);
    process.exitCode = 1;
  } else {
    console.log('Dependency audit clean (no high/critical vulnerabilities)');
  }
}

function scanSource() {
  const suspiciousPatterns = [/eval\s*\(/, /child_process/, /exec\s*\(/, /spawn\s*\(/];
  let flagged = false;

  function scanDir(dir) {
    for (const file of fs.readdirSync(dir)) {
      const full = path.join(dir, file);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        scanDir(full);
      } else if ((full.endsWith('.ts') || full.endsWith('.js')) && !full.includes('scripts/security-check.cjs')) {
        const content = fs.readFileSync(full, 'utf8');
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(content)) {
            console.error(`Suspicious pattern ${pattern} found in ${full}`);
            flagged = true;
          }
        }
      }
    }
  }

  scanDir('src');
  if (flagged) {
    process.exitCode = 1;
  } else {
    console.log('Source scan clean');
  }
}

runAudit();
scanSource();
