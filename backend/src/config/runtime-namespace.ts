const DEFAULT_RUNTIME_NAMESPACE = 'kolibri';

export function runtimeNamespace(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const value = environment.KOLIBRI_STACK_NAME?.trim();
  if (!value) return DEFAULT_RUNTIME_NAMESPACE;
  if (!/^[A-Za-z][A-Za-z0-9-]{0,127}$/.test(value)) {
    throw new Error(
      'KOLIBRI_STACK_NAME must be a valid CloudFormation stack name',
    );
  }
  return value;
}

export function systemSecretName(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  return `${runtimeNamespace(environment)}/system`;
}

export function designSystemRuntimeSecretName(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  return `${runtimeNamespace(environment)}/runtime/design-systems`;
}

export function generationStoragePrefix(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  return runtimeNamespace(environment);
}
