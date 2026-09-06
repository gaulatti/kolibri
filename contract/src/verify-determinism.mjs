import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './contract.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const build = () => {
  execFileSync(process.execPath, ['src/build.mjs'], { cwd: root, stdio: 'pipe' });
  return readFile(join(root, 'releases', '0.1.0', 'manifest.json'), 'utf8');
};
const first = await build();
const second = await build();
if (first !== second) throw new Error('two clean builds produced different manifests');
console.log(`deterministic manifest sha256=${sha256(first)}`);
