import { safeErrorMetadata, sanitizeLogText } from './safe-error';

describe('safe error metadata', () => {
  it('omits empty or fully sanitized messages rather than publishing empty fields', () => {
    expect(safeErrorMetadata('')).toEqual({ errorName: 'UnknownError' });
    expect(safeErrorMetadata({ message: '\u001b[0m' })).toEqual({
      errorName: 'UnknownError',
    });
  });
  it('retains actionable structured fields and sanitizes secrets', () => {
    const token = 'npm_sensitive-token-value-123456';
    const error = Object.assign(
      new Error(`publish rejected Authorization: Bearer ${token}`),
      {
        name: 'NpmProcessError',
        code: 'E403',
        command: 'npm publish',
        exitCode: 1,
        stderr: `npm ERR! code E403\n//registry.npmjs.org/:_authToken=${token}`,
        $metadata: {
          httpStatusCode: 403,
          requestId: 'request-123',
          attempts: 2,
        },
      },
    );

    const metadata = safeErrorMetadata(error, [token]);

    expect(metadata).toMatchObject({
      errorName: 'NpmProcessError',
      errorCode: 'E403',
      command: 'npm publish',
      exitCode: 1,
      httpStatusCode: 403,
      requestId: 'request-123',
      attempts: 2,
    });
    expect(JSON.stringify(metadata)).toContain('E403');
    expect(JSON.stringify(metadata)).not.toContain(token);
    expect(metadata.stderr).toContain('_authToken=[REDACTED]');
  });

  it('removes ANSI/control characters and bounds output', () => {
    const sanitized = sanitizeLogText(
      `\u001b[31mfailed\u001b[0m\u0000${'x'.repeat(100)}`,
      [],
      32,
    );
    expect(sanitized).not.toContain('\u001b');
    expect(sanitized).not.toContain('\u0000');
    expect(sanitized).toContain('[truncated]');
    expect(sanitized.length).toBeLessThanOrEqual(32);
  });

  it('handles primitive failures and both cause representations', () => {
    expect(safeErrorMetadata('plain failure')).toEqual({
      errorName: 'UnknownError',
      errorMessage: 'plain failure',
    });
    expect(safeErrorMetadata(null)).toEqual({
      errorName: 'UnknownError',
      errorMessage: 'null',
    });
    expect(
      safeErrorMetadata({ name: 'Outer', cause: new Error('inner') }),
    ).toMatchObject({ cause: 'Error: inner' });
    expect(safeErrorMetadata({ cause: 42 })).toMatchObject({ cause: '42' });
    expect(safeErrorMetadata({ cause: { code: 'INNER' } })).toMatchObject({
      cause: '{"code":"INNER"}',
    });
    expect(safeErrorMetadata({ cause: Symbol('inner') })).toMatchObject({
      cause: 'Unknown cause',
    });
  });
});
