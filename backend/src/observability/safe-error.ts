const MAX_FIELD_LENGTH = 4_000;
const MAX_STACK_LENGTH = 8_000;

export type SafeErrorMetadata = {
  errorName: string;
  errorMessage?: string;
  errorCode?: string | number;
  errno?: string | number;
  syscall?: string;
  path?: string;
  address?: string;
  port?: string | number;
  command?: string;
  exitCode?: number;
  signal?: string;
  stdout?: string;
  stderr?: string;
  httpStatusCode?: number;
  requestId?: string;
  attempts?: number;
  totalRetryDelay?: number;
  cause?: string;
  errorStack?: string;
};

export function safeErrorMetadata(
  error: unknown,
  redactions: Array<string | null | undefined> = [],
): SafeErrorMetadata {
  if (typeof error !== 'object' || error === null) {
    const message = sanitizeLogText(String(error), redactions);
    return {
      errorName: 'UnknownError',
      ...(message ? { errorMessage: message } : {}),
    };
  }

  const value = error as Record<string, unknown>;
  const metadata = objectValue(value.$metadata);
  const statusCode =
    numberValue(value.statusCode) ?? numberValue(metadata.httpStatusCode);
  const errorName = stringValue(value.name) ?? 'UnknownError';
  const errorMessage = sanitizeOptional(value.message, redactions);
  const errorStack = sanitizeOptional(
    value.stack,
    redactions,
    MAX_STACK_LENGTH,
  );
  const cause = safeCause(value.cause, redactions);

  return compact({
    errorName,
    errorMessage,
    errorCode: scalarValue(value.code),
    errno: scalarValue(value.errno),
    syscall: sanitizeOptional(value.syscall, redactions),
    path: sanitizeOptional(value.path, redactions),
    address: sanitizeOptional(value.address, redactions),
    port: scalarValue(value.port),
    command: sanitizeOptional(value.command, redactions),
    exitCode: numberValue(value.exitCode),
    signal: sanitizeOptional(value.signal, redactions),
    stdout: sanitizeOptional(value.stdout, redactions),
    stderr: sanitizeOptional(value.stderr, redactions),
    httpStatusCode: statusCode,
    requestId: sanitizeOptional(metadata.requestId, redactions),
    attempts: numberValue(metadata.attempts),
    totalRetryDelay: numberValue(metadata.totalRetryDelay),
    cause,
    errorStack,
  });
}

export function sanitizeLogText(
  input: string,
  redactions: Array<string | null | undefined> = [],
  maximumLength = MAX_FIELD_LENGTH,
): string {
  let value = input
    // ANSI escape sequences necessarily contain control characters.
    // eslint-disable-next-line no-control-regex
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    // Remove non-printing control characters while preserving whitespace.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/(_authToken\s*[=:]\s*)[^\s"']+/gi, '$1[REDACTED]')
    .replace(
      /(authorization\s*[=:]\s*(?:Bearer|Basic)\s+)[^\s,;]+/gi,
      '$1[REDACTED]',
    )
    .replace(/\b(?:npm|figd)_[A-Za-z0-9_-]{16,}\b/g, '[REDACTED]')
    .replace(/(https?:\/\/[^:\s/]+:)[^@\s/]+@/gi, '$1[REDACTED]@')
    .replace(
      /((?:password|accessToken|refreshToken|clientSecret|secret)\s*[=:]\s*["']?)[^"',\s}]+/gi,
      '$1[REDACTED]',
    );

  for (const secret of redactions
    .filter((candidate): candidate is string => Boolean(candidate))
    .sort((left, right) => right.length - left.length)) {
    value = value.split(secret).join('[REDACTED]');
  }

  value = value.trim();
  return value.length <= maximumLength
    ? value
    : `${value.slice(0, maximumLength - 14)}...[truncated]`;
}

function safeCause(
  cause: unknown,
  redactions: Array<string | null | undefined>,
): string | undefined {
  if (cause === undefined || cause === null) return undefined;
  if (cause instanceof Error) {
    return sanitizeLogText(`${cause.name}: ${cause.message}`, redactions);
  }
  if (
    typeof cause === 'string' ||
    typeof cause === 'number' ||
    typeof cause === 'boolean' ||
    typeof cause === 'bigint'
  ) {
    return sanitizeLogText(String(cause), redactions);
  }
  return sanitizeLogText(JSON.stringify(cause) ?? 'Unknown cause', redactions);
}

function sanitizeOptional(
  value: unknown,
  redactions: Array<string | null | undefined>,
  maximumLength = MAX_FIELD_LENGTH,
): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const sanitized = sanitizeLogText(value, redactions, maximumLength);
  return sanitized || undefined;
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function scalarValue(value: unknown): string | number | undefined {
  return typeof value === 'string' || typeof value === 'number'
    ? value
    : undefined;
}

function compact<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined),
  ) as T;
}
