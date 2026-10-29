import assert from 'node:assert/strict';
import {readFileSync, existsSync, symlinkSync, unlinkSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {parse} from 'yaml';
import {evaluate, allowed} from './workflow-expressions.mjs';

const workflow = parse(readFileSync(new URL('../workflows/ci.yml', import.meta.url), 'utf8'));
const require = createRequire(import.meta.url);
const engine = fileURLToPath(new URL('../../.clouseau-ci/', import.meta.url));
const config = require(`${engine}/src/config.cjs`).loadConfig(fileURLToPath(new URL('../clouseau.json', import.meta.url)));
const head = 'a'.repeat(40);

function context(event, {draft = false, pullRequest = '', author = false, fork = false, assessment = 'success', record = true, repair = false, gate = 'success', ref = 'refs/heads/main', deleted = false} = {}) {
  return {
    github: {event_name: event, ref, repository: 'gaulatti/kolibri', run_id: 1000, event: {deleted, pull_request: {number: 20, draft, head: {sha: head, repo: {full_name: fork ? 'external/contribution' : 'gaulatti/kolibri'}}}}},
    inputs: {pull_request: pullRequest, check_author: author},
    needs: {'assess-intent': {result: assessment, outputs: {assessment: JSON.stringify({record_digest: record ? 'a'.repeat(64) : '', repair_digest: repair ? 'b'.repeat(64) : ''})}}, 'approve-and-merge': {result: gate}},
  };
}

for (const [label, c, verify, assess] of [
  ['PR', context('pull_request'), true, false],
  ['fork PR', context('pull_request', {fork: true}), true, false],
  ['draft PR', context('pull_request', {draft: true}), true, false],
  ['main', context('push'), true, false],
  ['owner installation push', context('push', {ref: 'refs/heads/policy-install/pr-24'}), false, true],
  ['deleted installer branch', context('push', {ref: 'refs/heads/policy-install/pr-24', deleted: true}), false, false],
  ['unrelated branch push', context('push', {ref: 'refs/heads/feature'}), false, false],
  ['PR metadata', context('pull_request_target'), false, true],
  ['fork metadata', context('pull_request_target', {fork: true}), false, true],
  ['draft metadata', context('pull_request_target', {draft: true}), false, false],
  ['comment', context('issue_comment'), false, false],
  ['manual verification', context('workflow_dispatch'), true, false],
  ['manual reassessment', context('workflow_dispatch', {pullRequest: '20'}), false, false],
  ['author diagnostic', context('workflow_dispatch', {author: true}), false, false],
]) {
  test(`${label}: verification and privileged review are isolated with readable native checks`, () => {
    assert.equal(evaluate(workflow.jobs.verify.name, c).coerceString(), verify ? 'verify' : 'metadata-only');
    for (const step of workflow.jobs.verify.steps) assert.equal(allowed(step.if, c), verify);
    assert.equal(allowed(workflow.jobs['assess-intent'].if, c), assess);
    const approve = workflow.jobs['approve-and-merge'];
    assert.equal(evaluate(approve.name, c).coerceString(), assess ? 'approve-and-merge' : 'metadata-only-approval');
    assert.ok(allowed(approve.if, c, {success: false}));
    for (const step of approve.steps.slice(1)) assert.equal(allowed(step.if, c), assess);
  });
}

test('native coverage is measured inside the unprivileged verification job without secrets', () => {
  const verify = workflow.jobs.verify;
  assert.ok(!JSON.stringify(verify).includes('secrets.'));
  const check = verify.steps.find(step => step.with?.operation === 'coverage');
  assert.equal(check.with['coverage-format'], 'istanbul');
  assert.match(check.with['coverage-report'], /coverage-final\.json$/);
  assert.ok(check.with['source-directory']);
  for (const name of config.verification.steps) assert.ok(verify.steps.some(step => step.name === name), name);
});

for (const result of ['failure', 'cancelled', 'skipped']) {
  test(`${result} assessment fails the required approval check`, () => {
    const job = workflow.jobs['approve-and-merge'];
    assert.ok(allowed(job.steps[0].if, context('pull_request_target', {assessment: result})));
    assert.equal(job.steps[0].run.trim(), 'exit 1');
  });
}

test('trusted jobs load main and provider keys exist only after the explicit verification wait', () => {
  for (const name of ['assess-intent', 'approve-and-merge', 'apply-repair', 'finalize-merge', 'request-reassessment']) {
    const checkout = workflow.jobs[name].steps.find(step => step.uses?.startsWith('actions/checkout@'));
    assert.equal(checkout.with.ref, 'main', name);
    assert.equal(checkout.with['persist-credentials'], false, name);
  }
  const assess = workflow.jobs['assess-intent'];
  const wait = assess.steps.findIndex(step => step.name === 'Wait for tests and exact coverage');
  const model = assess.steps.findIndex(step => step.with?.operation === 'assess');
  assert.ok(wait > 0 && model > wait);
  assert.ok(!JSON.stringify(assess.steps.slice(0, model)).includes('secrets.'));
  assert.equal(assess.steps[model].with['wait-for-verification'], 'false');
  assert.deepEqual(assess.permissions, {actions: 'read', contents: 'read', 'pull-requests': 'read', issues: 'read'});
});

test('approval and repair consume the review record through job outputs, without artifacts or provider credentials', () => {
  const text = readFileSync(new URL('../workflows/ci.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(text, /(upload|download)-artifact/);
  for (const [name, operation] of [['approve-and-merge', 'gate'], ['apply-repair', 'repair']]) {
    const job = workflow.jobs[name];
    assert.ok(!JSON.stringify(job).includes('provider-key'));
    const step = job.steps.find(step => step.with?.operation === operation);
    assert.equal(step.with['record-transport'], 'job-output');
    assert.equal(step.with['review-record'], '${{ needs.assess-intent.outputs.review-record }}');
  }
  const gate = workflow.jobs['approve-and-merge'].steps.find(step => step.with?.operation === 'gate');
  assert.equal(gate.with['native-gate'], 'true');
  const assess = workflow.jobs['assess-intent'];
  assert.equal(assess.outputs['review-record'], '${{ steps.local-review.outputs.review-record || steps.assess.outputs.review-record }}');
  for (const operation of ['verify-local', 'assess']) {
    assert.equal(assess.steps.find(step => step.with?.operation === operation).with['record-transport'], 'job-output');
  }
});

test('the frozen engine is resolved from the reviewed bootstrap without provenance artifacts and verified before use', () => {
  const resolve = workflow.jobs['resolve-clouseau'].steps[0];
  assert.equal(resolve.uses, 'gaulatti/clouseau/scripts/resolve@f5b6f04a5b95090fc0b5dc0e6fec85cc426273f0');
  assert.deepEqual(resolve.with, {provenance: 'summary'});
  const steps = workflow.jobs.verify.steps;
  const engine = steps.findIndex(step => step.with?.operation === 'verify-engine');
  assert.ok(engine > steps.findIndex(step => step.with?.path === '.clouseau-ci'));
  assert.ok(engine < steps.findIndex(step => step.uses?.startsWith('actions/setup-node@')));
  for (const [name, job] of Object.entries(workflow.jobs)) assert.deepEqual(job['runs-on'], ['self-hosted', 'linux', 'x64', 'helix'], name);
});

test('forks, deleted head repositories and failed assessments cannot load the repair author credential', () => {
  const repair = workflow.jobs['apply-repair'];
  const eligible = context('pull_request_target', {repair: true, gate: 'failure'});
  assert.ok(allowed(repair.if, eligible, {success: false}));
  const deleted = structuredClone(eligible); deleted.github.event.pull_request.head.repo = null;
  for (const c of [deleted, context('pull_request_target', {fork: true, repair: true, gate: 'failure'}), context('pull_request_target', {repair: true, gate: 'failure', assessment: 'failure'}), context('pull_request_target', {repair: true, gate: 'success'}), context('pull_request_target', {repair: false, gate: 'failure'})]) assert.equal(allowed(repair.if, c, {success: false}), false);
  const mutant = repair.if.replace('github.event.pull_request.head.repo.full_name == github.repository &&', '');
  assert.equal(allowed(mutant, context('pull_request_target', {fork: true, repair: true, gate: 'failure'}), {success: false}), true);
  assert.equal(repair.permissions.contents, 'read');
  for (const [name, job] of Object.entries(workflow.jobs)) {
    if (['apply-repair', 'check-author'].includes(name)) continue;
    assert.ok(!JSON.stringify(job).includes('secrets.DEPLOYMENT_TOKEN'), name);
  }
});

test('the scored route, repair bound, protected purpose and deployment handoff remain explicit', () => {
  assert.equal(config.version, 2);
  assert.deepEqual(config.acceptance, {examiner: 'deepseek-flash', challenger: 'deepseek-v4-pro', grader: 'routed', grading_model: 'deepseek-flash', repair_attempts: 2});
  const contract = readFileSync(new URL('../clouseau.md', import.meta.url), 'utf8');
  assert.match(contract, /exactly 100%/i); assert.match(contract, /explicit owner confirmation/);
  assert.equal(config.deployment, null);
  assert.equal(workflow.jobs['finalize-merge'].permissions.actions, 'write');
});

test('real pinned policy makes no model call for pending, failed, stale or incomplete verification', async () => {
  for (const scenario of ['pending', 'failed', 'stale', 'missing step']) {
    const pr = {number: 20, state: 'open', draft: false, head: {sha: head, ref: 'fix/cors', repo: {id: 1}}, base: {sha: 'b'.repeat(40), ref: 'main'}};
    const run = {id: 9, head_sha: scenario === 'stale' ? 'c'.repeat(40) : head, pull_requests: [{number: 20}], status: scenario === 'pending' ? 'in_progress' : 'completed', conclusion: scenario === 'failed' ? 'failure' : 'success'};
    const github = {rest: {pulls: {get: async () => ({data: pr})}, actions: {
      listWorkflowRuns: async (args) => { assert.equal(args.workflow_id, 'ci.yml'); assert.equal(args.event, 'pull_request'); return {data: {workflow_runs: [run]}}; },
      listJobsForWorkflowRun: async () => ({data: [{name: 'verify', conclusion: 'success', steps: config.verification.steps.filter(name => scenario !== 'missing step' || name !== 'Enforce 100% line and branch coverage').map(name => ({name, conclusion: 'success'}))}]}),
    }}, paginate: async (method, args) => (await method(args)).data};
    const c = {repo: {owner: 'gaulatti', repo: 'kolibri'}, payload: {pull_request: {number: 20}}};
    const result = await require(`${engine}/src/policy.cjs`).createPolicy(config, {engine: require(`${engine}/src/central-version.cjs`).environmentEngine()}).assess({github, context: c, fetchImpl: async () => assert.fail('no model request before genuine verification')});
    assert.equal(result.decision, ['pending', 'stale'].includes(scenario) ? 'pending_technical' : 'blocked_technical');
  }
});

test('the actual wait step uses fresh PR verification, reports pending work and fails before any model execution', async (t) => {
  const project = fileURLToPath(new URL('../../', import.meta.url));
  const reviewCheckout = fileURLToPath(new URL('../../.clouseau-review', import.meta.url));
  // The unit job checks out the same exact engine at .clouseau-ci; the
  // privileged job uses a separately owned .clouseau-review checkout.
  if (!existsSync(reviewCheckout)) {
    symlinkSync(engine, reviewCheckout, 'dir');
    t.after(() => unlinkSync(reviewCheckout));
  }
  const originalCwd = process.cwd();
  process.chdir(project);
  t.after(() => process.chdir(originalCwd));
  const job = workflow.jobs['assess-intent'];
  const step = job.steps.find(step => step.name === 'Wait for tests and exact coverage');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const invoke = new AsyncFunction('github', 'context', 'core', 'require', 'setTimeout', step.with.script);
  const pr = {number: 20, state: 'open', draft: false, head: {sha: head, ref: 'fix/cors', repo: {id: 1}}};
  const c = {repo: {owner: 'gaulatti', repo: 'kolibri'}, payload: {pull_request: {number: 20, head: {sha: head}}}};
  for (const scenario of ['ready', 'pending', 'failed', 'stale', 'closed', 'missing step', 'never-ready']) {
    const messages = [];
    let polls = 0;
    const github = {rest: {pulls: {get: async () => ({data: {...pr, state: scenario === 'closed' ? 'closed' : 'open', head: {...pr.head, sha: scenario === 'stale' ? 'c'.repeat(40) : head}}})}, actions: {
      listWorkflowRuns: async () => { polls += 1; return {data: {workflow_runs: [{id: 3, head_sha: head, pull_requests: [{number: 20}], status: scenario === 'never-ready' || scenario === 'pending' && polls === 1 ? 'in_progress' : 'completed', conclusion: scenario === 'failed' ? 'failure' : 'success', html_url: 'https://github.com/gaulatti/kolibri/actions/runs/3'}]}}; },
      listJobsForWorkflowRun: async () => ({data: [{name: 'verify', conclusion: 'success', steps: config.verification.steps.filter(name => scenario !== 'missing step' || name !== 'Enforce 100% line and branch coverage').map(name => ({name, conclusion: 'success'}))}]}),
    }}, paginate: async (method, args) => (await method(args)).data};
    const operation = invoke(github, c, {info: line => messages.push(line)}, require, (callback, ms) => { assert.equal(ms, 15000); callback(); });
    if (['ready', 'pending'].includes(scenario)) {
      await operation;
      assert.ok(messages.some(line => line.includes('Clouseau acceptance can now start')));
      assert.equal(polls, scenario === 'pending' ? 2 : 1);
    } else await assert.rejects(operation, /verification|changed|closed/i);
  }
});

test('strict owner-only automatic merge is selected and backed by repository-wide ownership', () => {
  assert.equal(config.merge_mode, 'automatic');
  assert.equal(readFileSync(new URL('../CODEOWNERS', import.meta.url), 'utf8'), '* @gaulatti\n');
});
