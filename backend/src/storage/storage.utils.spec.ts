import AdmZip from 'adm-zip';
import {
  assertRunId,
  assertSafeArtifactPath,
  createPackageArchive,
  safeDownloadFilename,
} from './storage.utils';

describe('storage utilities', () => {
  it('validates identifiers and all unsafe artifact path families', () => {
    expect(() =>
      assertRunId('f515082d-5e8b-4309-a52e-1ec6cc4c4627'),
    ).not.toThrow();
    expect(() => assertRunId('invalid')).toThrow('Invalid generation run ID');
    for (const path of [
      '',
      'folder\\file',
      'bad\0file',
      '/absolute',
      '..',
      '../escape',
    ]) {
      expect(() => assertSafeArtifactPath(path)).toThrow(
        'Unsafe artifact path',
      );
    }
    expect(() => assertSafeArtifactPath('package/src/index.ts')).not.toThrow();
  });

  it('archives UTF-8 and base64 artifacts and sanitizes filenames', () => {
    const archive = createPackageArchive([
      { path: 'package/a.txt', content: 'hello' },
      {
        path: 'package/image.bin',
        content: Buffer.from([1, 2]).toString('base64'),
        encoding: 'base64',
      },
    ]);
    const zip = new AdmZip(archive);
    expect(zip.readAsText('package/a.txt')).toBe('hello');
    expect(zip.readFile('package/image.bin')).toEqual(Buffer.from([1, 2]));
    expect(safeDownloadFilename('@scope/package')).toBe('-scope-package.zip');
    for (const name of ['', '.', '..'])
      expect(() => safeDownloadFilename(name)).toThrow(
        'Invalid package filename',
      );
  });
});
