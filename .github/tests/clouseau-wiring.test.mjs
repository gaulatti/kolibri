import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {parse} from 'yaml';
import {data, Evaluator, Lexer, Parser} from '@actions/expressions';
import {truthy} from '@actions/expressions/result';

const read = file => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const workflow = parse(read('.github/workflows/verify.yml'));
const initial = parse(read('.github/workflows/clouseau-initial-trust.yml'));
const config = JSON.parse(read('.github/clouseau.json'));
const recipe = JSON.parse(read('.clouseau-local.json'));
const typed = value => value == null ? new data.Null() : typeof value === 'boolean' ? new data.BooleanData(value) :
  typeof value === 'number' ? new data.NumberData(value) : typeof value === 'string' ? new data.StringData(value) :
    new data.Dictionary(...Object.entries(value).map(([key, item]) => ({key, value: typed(item)})));
const always = {name: 'always', minArgs: 0, maxArgs: 0, call: () => new data.BooleanData(true)};
function evaluate(expression, context) {
  const source = expression.replace(/^\s*\$\{\{\s*|\s*\}\}\s*$/g, '');
  const ast = new Parser(new Lexer(source).lex().tokens, Object.keys(context), [always]).parse();
  return new Evaluator(ast, typed(context), new Map([['always', always]])).evaluate();
}
const context = (event, draft = false) => ({github: {event_name: event, event: {pull_request: {draft}}}, inputs: {pull_request: ''}});

test('explicit owner-only automatic policy retains full coverage, public trust and manual deployment', () => {
  assert.equal(config.merge_mode, 'automatic');
  assert.equal(config.deployment, null);
  assert.equal(config.local_review.mode, 'optional');
  assert.deepEqual(config.local_review.central_source, {repository: 'gaulatti/clouseau', ref: 'refs/heads/main'});
  assert.equal(config.local_review.reviewer_digest, undefined);
  assert.ok(config.local_review.keys.every(key => key.github_actor === 'gaulatti' && key.public_key.startsWith('-----BEGIN PUBLIC KEY-----')));
  assert.equal(JSON.stringify(config).includes('PRIVATE KEY'), false);
  assert.deepEqual(recipe.coverage.map(part => part.source_directory), ['backend/src', 'frontend/app', 'contract', 'conformance/bleecker-toggle/src']);
});

test('all local verification commands and configured technical steps are mandatory in CI', () => {
  const steps = workflow.jobs.verify.steps;
  for (const argv of recipe.verification) assert.ok(steps.some(step => step.run?.trim() === argv.join(' ')), `Missing CI command ${argv.join(' ')}`);
  for (const name of config.verification.steps) {
    const step = steps.find(step => step.name === name);
    assert.ok(step, `Missing mandatory step ${name}`);
    assert.equal(step.if, undefined);
    assert.equal(step['continue-on-error'], undefined);
  }
  assert.ok(config.verification.steps.includes('Enforce 100% line and branch coverage'));
  assert.ok(config.verification.steps.includes('Select accepted coverage recipe as data'));
});

test('provider and writer jobs run only on ready trusted PR-target events', () => {
  for (const event of ['push', 'pull_request', 'issue_comment', 'workflow_dispatch']) {
    assert.equal(truthy(evaluate(workflow.jobs['assess-intent'].if, context(event))), false);
    assert.equal(truthy(evaluate(workflow.jobs['approve-and-merge'].if, context(event))), false);
  }
  for (const draft of [false, true]) {
    assert.equal(truthy(evaluate(workflow.jobs['assess-intent'].if, context('pull_request_target', draft))), !draft);
    assert.equal(truthy(evaluate(workflow.jobs['approve-and-merge'].if, context('pull_request_target', draft))), !draft);
  }
  const writer = workflow.jobs['approve-and-merge'];
  assert.ok(writer.needs.includes('assess-intent'));
  const failureStep = writer.steps.find(step => step.name === 'Require a completed assessment');
  for (const result of ['failure', 'cancelled', 'skipped']) assert.equal(truthy(evaluate(failureStep.if, {needs: {'assess-intent': {result}}})), true);
  assert.equal(failureStep.run, 'exit 1');
});

test('native approval naming cannot create a skipped duplicate check on code-review events', () => {
  const name = workflow.jobs['approve-and-merge'].name;
  assert.equal(evaluate(name, context('pull_request_target')).coerceString(), 'approve-and-merge');
  for (const event of ['pull_request', 'push', 'workflow_dispatch']) assert.notEqual(evaluate(name, context(event)).coerceString(), 'approve-and-merge');
});

test('one frozen engine identity reaches every engine job and independent initial checker', () => {
  for (const [definition, names] of [[workflow, ['verify', 'assess-intent', 'approve-and-merge', 'request-reassessment']], [initial, ['initial-trust']]]) {
    assert.equal(definition.jobs['resolve-clouseau'].steps.find(step => step.id === 'engine').with.provenance, 'summary');
    for (const name of names) {
      const job = definition.jobs[name];
      assert.ok(job.needs.includes('resolve-clouseau'));
      assert.equal(job.env.CLOUSEAU_ENGINE_SHA, '${{ needs.resolve-clouseau.outputs.sha }}');
      assert.equal(job.env.CLOUSEAU_ENGINE_DIGEST, '${{ needs.resolve-clouseau.outputs.digest }}');
      const checkout = job.steps.find(step => step.with?.repository === 'gaulatti/clouseau');
      assert.match(checkout.with.ref, /needs\.resolve-clouseau\.outputs\.sha/);
      assert.match(checkout.with.ref, /0000000000000000000000000000000000000000/);
      assert.equal(checkout.with['persist-credentials'], false);
    }
  }
  assert.notEqual(initial.name, workflow.name);
  assert.ok(Object.values(initial.permissions).every(value => value === 'read'));
});

test('credentials, assessment transport and deployment remain separated', () => {
  assert.deepEqual(workflow.permissions, {contents: 'read'});
  for (const [name, job] of Object.entries(workflow.jobs)) {
    if (name !== 'assess-intent') assert.equal(JSON.stringify(job).includes('secrets.'), false);
    for (const step of job.steps) assert.notEqual(step.with?.operation, 'finalize');
  }
  assert.ok(Object.values(workflow.jobs['assess-intent'].permissions).every(value => value === 'read'));
  const gate = workflow.jobs['approve-and-merge'].steps.find(step => step.with?.operation === 'gate');
  assert.equal(gate.uses, './.clouseau-ci');
  assert.equal(gate.with['native-gate'], 'true');
  assert.equal(gate.with['record-transport'], 'job-output');
  assert.equal(gate.with.assessment, '${{ needs.assess-intent.outputs.assessment }}');
  assert.equal(gate.with['review-record'], '${{ needs.assess-intent.outputs.review-record }}');
  assert.equal(read('AGENTS.md'), read('CLAUDE.md'));
});
