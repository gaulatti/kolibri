export type KolibriRuntimeMode = 'local' | 'production';

export function runtimeMode(
  environment: NodeJS.ProcessEnv = process.env,
): KolibriRuntimeMode {
  const configured = environment.KOLIBRI_RUNTIME_MODE?.trim().toLowerCase();
  if (!configured) {
    return environment.NODE_ENV === 'production' ? 'production' : 'local';
  }
  if (configured === 'local' || configured === 'production') {
    return configured;
  }
  throw new Error('KOLIBRI_RUNTIME_MODE must be local or production');
}
