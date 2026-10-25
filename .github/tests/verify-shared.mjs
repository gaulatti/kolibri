import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {parse} from 'yaml';

const root = fileURLToPath(new URL('../../', import.meta.url));
const engine = path.resolve(root, process.argv[2]);
const require = createRequire(import.meta.url);
const config = require(path.join(engine, 'src/config.cjs')).loadConfig(path.join(root, '.github/clouseau.json'));
const action = parse(readFileSync(path.join(engine, 'action.yml'), 'utf8'));
const validation = action.runs.steps.find(step => step.name === 'Validate Clouseau operation');
assert.ok(validation);
let operations = 0;
for (const filename of ['verify.yml', 'clouseau-initial-trust.yml']) {
  const workflow = parse(readFileSync(path.join(root, '.github/workflows', filename), 'utf8'));
  for (const job of Object.values(workflow.jobs)) for (const step of job.steps) {
    if (step.uses !== './.clouseau-ci') continue;
    for (const key of Object.keys(step.with)) assert.ok(Object.hasOwn(action.inputs, key), `Unsupported shared input ${key}`);
    const result = spawnSync('bash', ['-e', '-c', validation.run], {encoding: 'utf8', env: {PATH: process.env.PATH,
      CLOUSEAU_OPERATION: step.with.operation,
      CLOUSEAU_RECORD_TRANSPORT: step.with['record-transport'] || action.inputs['record-transport'].default,
      CLOUSEAU_HAS_REVIEW_RECORD: String(Boolean(step.with['review-record']))}});
    assert.equal(result.status, 0, result.stderr);
    operations++;
  }
}
const ownership = require(path.join(engine, 'src/codeowners.cjs'));
const entries = ownership.parse(readFileSync(path.join(root, '.github/CODEOWNERS'), 'utf8'));
for (const filename of ['.github/CODEOWNERS', '.github/clouseau.json', 'backend/src/main.ts', 'frontend/app/root.tsx']) {
  const matched = entries.filter(entry => entry.pattern.test(filename)).at(-1);
  assert.deepEqual(matched?.owners, ['@gaulatti'], `Unexpected owner at ${filename}`);
}
assert.equal(config.merge_mode, 'automatic');
console.log(`Released shared configuration, ${operations} actual action operations and declared ownership validated.`);
