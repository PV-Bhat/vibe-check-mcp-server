const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runAudit() {
  try {
    const output = execSync('npm audit --production --json', { encoding: 'utf8' });
    const json = JSON.parse(output);
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
      console.log('Dependency audit clean');
    }
  } catch (err) {
    console.error('npm audit failed', err.message);
    process.exitCode = 1;
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
      } else if ((full.endsWith('.ts') || full.endsWith('.js')) && !full.includes('scripts/security-check.js')) {
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
