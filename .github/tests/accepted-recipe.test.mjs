import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, unlinkSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import test from 'node:test';
import {parse} from 'yaml';

const workflow = parse(readFileSync(new URL('../workflows/verify.yml', import.meta.url), 'utf8'));
const selector = workflow.jobs.verify.steps.find(step => step.name === 'Select accepted coverage recipe as data');

test('the actual coverage selector preserves base inventory and rejects unqualified bootstrap', t => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'kolibri-recipe-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const repo = path.join(root, 'repo'); mkdirSync(repo);
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], {encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']}).trim();
  const commit = message => {
    git('add', '-A');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', message);
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q', '-b', 'main');
  writeFileSync(path.join(repo, 'README.md'), 'Fixture\n');
  const empty = commit('No initial trust');
  const accepted = JSON.stringify({coverage: [{source_directory: 'complete-app'}], verification: [['sh', '-c', 'touch must-not-execute']]});
  const narrowed = JSON.stringify({coverage: [{source_directory: 'narrowed-app'}], verification: [['sh', '-c', 'touch must-not-execute']]});
  writeFileSync(path.join(repo, '.clouseau-local.json'), accepted);
  const base = commit('Accepted complete source inventory');
  git('update-ref', 'refs/remotes/origin/main', base);
  writeFileSync(path.join(repo, '.clouseau-local.json'), narrowed); commit('Proposed narrowed inventory');
  writeFileSync(path.join(repo, '.clouseau-local.json'), 'Uncommitted poison');
  const run = (name, baseSha, qualification, expected) => {
    const output = path.join(root, name); mkdirSync(output);
    const result = spawnSync('bash', ['-e', '-c', selector.run], {cwd: repo, encoding: 'utf8', env: {...process.env,
      ACCEPTED_BASE_SHA: baseSha, INITIAL_INSTALL_QUALIFICATION: String(qualification),
      RUNNER_TEMP: output, GITHUB_STEP_SUMMARY: path.join(output, 'summary')}});
    assert.equal(result.status === 0, expected !== undefined, `${name}: ${result.stderr}`);
    const selected = path.join(output, 'clouseau-coverage.json');
    if (expected === undefined) assert.equal(existsSync(selected), false, name);
    else assert.equal(readFileSync(selected, 'utf8'), expected, name);
    assert.equal(existsSync(path.join(repo, 'must-not-execute')), false);
    return result;
  };
  run('base-wins', base, true, accepted);
  run('push-fetches-main', '', false, accepted);
  run('no-implicit-bootstrap', empty, false);
  assert.match(run('explicit-initial-only', empty, true, narrowed).stdout, /grants no review or trust authority/);
  run('invalid-base-fails', 'f'.repeat(40), true);
  unlinkSync(path.join(repo, '.clouseau-local.json')); mkdirSync(path.join(repo, '.github'));
  writeFileSync(path.join(repo, '.github/clouseau.json'), '{}');
  const installedPolicy = commit('Existing CI policy');
  writeFileSync(path.join(repo, '.clouseau-local.json'), narrowed); commit('Proposed recipe');
  run('policy-forbids-bootstrap', installedPolicy, true);
});
