import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {PACKAGES, evaluate, main, validateExceptions} from './policy.mjs';

const report = (...entries) => ({vulnerabilities: Object.fromEntries(entries.map(([name, severity]) => [name, {name, severity}]))});
const exception = (overrides = {}) => ({
  directory: 'backend', exposure: 'build', severities: ['low', 'moderate'], owner: 'o', rationale: 'r', evidence: 'e',
  reviewBy: '2027-02-01', ...overrides,
});
const today = '2026-11-04';

test('a clean tree has no violations', () => {
  assert.deepEqual(evaluate({directory: 'backend', fullAudit: report(), productionAudit: report(), exceptions: [], today}), {violations: [], covered: []});
});

test('a missing audit report is treated as clean', () => {
  assert.deepEqual(evaluate({directory: 'backend', fullAudit: {}, productionAudit: undefined, exceptions: [], today}), {violations: [], covered: []});
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
