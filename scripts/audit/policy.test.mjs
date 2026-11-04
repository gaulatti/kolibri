import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {PACKAGES, evaluate, main, runAudit, validateExceptions} from './policy.mjs';

const report = (...entries) => ({vulnerabilities: Object.fromEntries(entries.map(([name, severity]) => [name, {name, severity}]))});
const exception = (overrides = {}) => ({
  directory: 'backend', exposure: 'build', severities: ['low', 'moderate'], owner: 'o', rationale: 'r', evidence: 'e',
  reviewBy: '2027-02-01', ...overrides,
});
const today = '2026-11-04';

test('a clean tree has no violations', () => {
  assert.deepEqual(evaluate({directory: 'backend', fullAudit: report(), productionAudit: report(), exceptions: [], today}), {violations: [], covered: []});
});

test('a report without a vulnerabilities object is an error, never clean', () => {
  assert.throws(() => evaluate({directory: 'backend', fullAudit: {}, productionAudit: report(), exceptions: [], today}), /no vulnerabilities report/);
  assert.throws(() => evaluate({directory: 'backend', fullAudit: report(), productionAudit: undefined, exceptions: [], today}), /no vulnerabilities report/);
  assert.throws(() => evaluate({directory: 'backend', fullAudit: {error: {summary: 'registry down'}}, productionAudit: report(), exceptions: [], today}), /registry down/);
});

test('build-only low and moderate advisories are covered by a directory exception', () => {
  const result = evaluate({directory: 'backend', fullAudit: report(['jest', 'low'], ['glob', 'moderate']), productionAudit: report(), exceptions: [exception()], today});
  assert.deepEqual(result.violations, []);
  assert.equal(result.covered.length, 2);
  assert.ok(result.covered.every(item => item.exposure === 'build'));
});

test('an unexcepted advisory fails', () => {
  const {violations} = evaluate({directory: 'backend', fullAudit: report(['glob', 'moderate']), productionAudit: report(), exceptions: [], today});
  assert.deepEqual(violations.map(v => v.reason), ['no exception']);
});

test('high and critical advisories fail even with a blanket directory exception', () => {
  const blanket = exception({severities: ['low', 'moderate', 'high', 'critical']});
  const {violations} = evaluate({directory: 'backend', fullAudit: report(['multer', 'high'], ['x', 'critical']), productionAudit: report(), exceptions: [blanket], today});
  assert.equal(violations.length, 2);
  assert.match(violations[0].reason, /package-specific/);
});

test('a package-specific exception covers a high advisory', () => {
  const specific = exception({severities: ['high'], package: 'multer'});
  const {violations, covered} = evaluate({directory: 'backend', fullAudit: report(['multer', 'high']), productionAudit: report(), exceptions: [specific], today});
  assert.deepEqual(violations, []);
  assert.equal(covered.length, 1);
});

test('production exposure is not covered by a build-only exception', () => {
  const {violations} = evaluate({directory: 'backend', fullAudit: report(['qs', 'moderate']), productionAudit: report(['qs', 'moderate']), exceptions: [exception()], today});
  assert.equal(violations[0].exposure, 'production');
});

test('an exception for another directory does not apply', () => {
  const {violations} = evaluate({directory: 'frontend', fullAudit: report(['glob', 'moderate']), productionAudit: report(), exceptions: [exception()], today});
  assert.equal(violations.length, 1);
});

test('an exception for another package does not apply', () => {
  const specific = exception({package: 'minimatch'});
  const {violations} = evaluate({directory: 'backend', fullAudit: report(['glob', 'moderate']), productionAudit: report(), exceptions: [specific], today});
  assert.equal(violations.length, 1);
});

test('an expired exception fails with its review date', () => {
  const {violations} = evaluate({directory: 'backend', fullAudit: report(['glob', 'moderate']), productionAudit: report(), exceptions: [exception({reviewBy: '2026-11-03'})], today});
  assert.match(violations[0].reason, /expired on 2026-11-03/);
});

test('exception validation rejects malformed records', () => {
  assert.throws(() => validateExceptions({}), /array/);
  assert.throws(() => validateExceptions([exception({owner: ''})]), /owner/);
  assert.throws(() => validateExceptions([{...exception(), evidence: undefined}]), /evidence/);
  assert.throws(() => validateExceptions([exception({directory: 'contract'})]), /Unknown directory/);
  assert.throws(() => validateExceptions([exception({exposure: 'runtime'})]), /Unknown exposure/);
  assert.throws(() => validateExceptions([exception({severities: ['severe']})]), /Invalid severities/);
  assert.throws(() => validateExceptions([exception({severities: 'low'})]), /Invalid severities/);
  assert.throws(() => validateExceptions([exception({reviewBy: 'soon'})]), /Invalid reviewBy/);
  assert.throws(() => validateExceptions([exception({reviewBy: '2027-13-45'})]), /Invalid reviewBy/);
  assert.deepEqual(validateExceptions([exception()]), [exception()]);
});

function project(exceptions) {
  const root = mkdtempSync(join(tmpdir(), 'kolibri-audit-'));
  mkdirSync(join(root, 'scripts/audit'), {recursive: true});
  writeFileSync(join(root, 'scripts/audit/exceptions.json'), JSON.stringify(exceptions));
  return root;
}

test('main passes when every advisory is covered and reports counts', () => {
  const lines = [];
  const audit = (_root, directory, omitDev) => (directory === 'backend' && !omitDev ? report(['glob', 'moderate']) : report());
  const code = main({root: project([exception()]), today, audit, log: line => lines.push(line)});
  assert.equal(code, 0);
  assert.deepEqual(lines, PACKAGES.map(p => `${p}: 0 production and ${p === 'backend' ? 1 : 0} build-only advisories covered by exceptions`));
});

test('main fails and names the offending advisory', () => {
  const lines = [];
  const audit = (_root, directory, omitDev) => (directory === 'frontend' && !omitDev ? report(['vite', 'high']) : report());
  assert.equal(main({root: project([]), today, audit, log: line => lines.push(line)}), 1);
  assert.ok(lines.includes('frontend: high build advisory in vite - no exception'));
});

test('main fails when npm audit returns error JSON, naming the directory and the npm error', () => {
  const lines = [];
  const audit = (_root, directory) => (directory === 'frontend' ? {error: {code: 'ENOAUDIT', summary: 'registry unreachable'}} : report());
  assert.equal(main({root: project([]), today, audit, log: line => lines.push(line)}), 1);
  assert.ok(lines.includes('frontend: audit could not be evaluated - npm audit returned no vulnerabilities report: registry unreachable'));
});

test('main fails when the audit cannot be parsed or cannot run', () => {
  for (const message of ['npm audit output is not valid JSON', 'npm audit produced no output (spawn npm ENOENT)']) {
    const lines = [];
    const audit = () => { throw new Error(message); };
    assert.equal(main({root: project([]), today, audit, log: line => lines.push(line)}), 1);
    assert.deepEqual(lines, PACKAGES.map(p => `${p}: audit could not be evaluated - ${message}`));
  }
});

test('main passes a clean audit with an empty vulnerabilities object', () => {
  const lines = [];
  assert.equal(main({root: project([]), today, audit: () => ({vulnerabilities: {}}), log: line => lines.push(line)}), 0);
  assert.equal(lines.length, PACKAGES.length);
});

test('main fails on an expired exception', () => {
  const lines = [];
  const audit = (_root, directory, omitDev) => (directory === 'backend' && !omitDev ? report(['glob', 'moderate']) : report());
  assert.equal(main({root: project([exception({reviewBy: '2026-11-03'})]), today, audit, log: line => lines.push(line)}), 1);
  assert.ok(lines.includes('backend: moderate build advisory in glob - exception expired on 2026-11-03'));
});

const failing = stdout => () => { throw Object.assign(new Error('Command failed: npm audit'), stdout === undefined ? {} : {stdout}); };

test('runAudit returns the parsed report of a clean audit', () => {
  assert.deepEqual(runAudit('/r', 'backend', false, () => '{"vulnerabilities":{}}'), {vulnerabilities: {}});
});

test('runAudit returns the parsed report of a non-zero exit that carries advisory JSON', () => {
  const advisory = {vulnerabilities: {glob: {name: 'glob', severity: 'moderate'}}};
  assert.deepEqual(runAudit('/r', 'backend', false, failing(JSON.stringify(advisory))), advisory);
});

test('runAudit throws when the executor fails without stdout', () => {
  assert.throws(() => runAudit('/r', 'backend', false, failing(undefined)), /npm audit produced no output \(Command failed: npm audit\)/);
  assert.throws(() => runAudit('/r', 'backend', false, failing('')), /npm audit produced no output/);
});

test('runAudit throws when stdout is not valid JSON, returned or carried by a failure', () => {
  assert.throws(() => runAudit('/r', 'backend', false, () => 'not json'), /npm audit output is not valid JSON/);
  assert.throws(() => runAudit('/r', 'backend', false, failing('<html>502</html>')), /npm audit output is not valid JSON/);
});

test('runAudit passes --omit=dev only when requested and runs in the package directory', () => {
  const calls = [];
  const exec = (command, args, options) => { calls.push({command, args, cwd: options.cwd}); return '{"vulnerabilities":{}}'; };
  runAudit('/r', 'frontend', false, exec);
  runAudit('/r', 'frontend', true, exec);
  assert.deepEqual(calls, [
    {command: 'npm', args: ['audit', '--json'], cwd: '/r/frontend'},
    {command: 'npm', args: ['audit', '--json', '--omit=dev'], cwd: '/r/frontend'},
  ]);
});
