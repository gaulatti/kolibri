// Dependency-audit policy for Kolibri's npm packages.
//
// High and critical advisories fail unless a checked-in, unexpired exception
// covers them. Lower severities must also be covered by an exception, so every
// remaining exposure has an owner, evidence and a review date. Production and
// build-only exposure are reported separately and are never merged.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const PACKAGES = ['backend', 'frontend', 'infrastructure'];
const SEVERITIES = ['low', 'moderate', 'high', 'critical'];
const FAILING = new Set(['high', 'critical']);
const REQUIRED = ['directory', 'exposure', 'severities', 'owner', 'rationale', 'evidence', 'reviewBy'];

export function validateExceptions(exceptions) {
  if (!Array.isArray(exceptions)) throw new Error('Exceptions must be an array');
  for (const exception of exceptions) {
    for (const field of REQUIRED) {
      if (exception[field] === undefined || exception[field] === '') {
        throw new Error(`Exception is missing "${field}": ${JSON.stringify(exception)}`);
      }
    }
    if (!PACKAGES.includes(exception.directory)) throw new Error(`Unknown directory "${exception.directory}"`);
    if (!['production', 'build'].includes(exception.exposure)) throw new Error(`Unknown exposure "${exception.exposure}"`);
    if (!Array.isArray(exception.severities) || exception.severities.some(s => !SEVERITIES.includes(s))) {
      throw new Error(`Invalid severities for ${exception.directory}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exception.reviewBy) || Number.isNaN(Date.parse(exception.reviewBy))) {
      throw new Error(`Invalid reviewBy "${exception.reviewBy}"`);
    }
  }
  return exceptions;
}

function advisories(report) {
  return Object.values(report?.vulnerabilities ?? {}).map(({name, severity}) => ({name, severity}));
}

// Classify every advisory of one package tree and return the violations.
export function evaluate({directory, fullAudit, productionAudit, exceptions, today}) {
  const production = new Set(advisories(productionAudit).map(a => a.name));
  const violations = [];
  const covered = [];
  for (const {name, severity} of advisories(fullAudit)) {
    const exposure = production.has(name) ? 'production' : 'build';
    const matching = exceptions.filter(e => (
      e.directory === directory && e.exposure === exposure && e.severities.includes(severity) &&
      (e.package === undefined || e.package === name)
    ));
    const active = matching.find(e => e.reviewBy >= today);
    if (active) {
      if (FAILING.has(severity) && active.package === undefined) {
        violations.push({directory, name, severity, exposure, reason: 'high/critical needs a package-specific exception'});
      } else {
        covered.push({directory, name, severity, exposure});
      }
    } else if (matching.length > 0) {
      violations.push({directory, name, severity, exposure, reason: `exception expired on ${matching[0].reviewBy}`});
    } else {
      violations.push({directory, name, severity, exposure, reason: 'no exception'});
    }
  }
  return {violations, covered};
}

function runAudit(root, directory, omitDev) {
  const args = ['audit', '--json', ...(omitDev ? ['--omit=dev'] : [])];
  try {
    return JSON.parse(execFileSync('npm', args, {cwd: join(root, directory), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024}));
  } catch (error) {
    // npm audit exits non-zero when advisories exist; its JSON is on stdout.
    if (error.stdout) return JSON.parse(error.stdout);
    throw error;
  }
}

export function main({root, today, audit = runAudit, log = console.log} = {}) {
  const exceptions = validateExceptions(JSON.parse(readFileSync(join(root, 'scripts/audit/exceptions.json'), 'utf8')));
  let failed = false;
  for (const directory of PACKAGES) {
    const {violations, covered} = evaluate({
      directory,
      fullAudit: audit(root, directory, false),
      productionAudit: audit(root, directory, true),
      exceptions,
      today,
    });
    const count = (list, exposure) => list.filter(v => v.exposure === exposure).length;
    log(`${directory}: ${count(covered, 'production')} production and ${count(covered, 'build')} build-only advisories covered by exceptions`);
    for (const v of violations) {
      failed = true;
      log(`${directory}: ${v.severity} ${v.exposure} advisory in ${v.name} - ${v.reason}`);
    }
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  process.exitCode = main({root, today: new Date().toISOString().slice(0, 10)});
}
