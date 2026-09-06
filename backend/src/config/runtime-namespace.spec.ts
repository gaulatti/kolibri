import {
  designSystemRuntimeSecretName,
  generationStoragePrefix,
  runtimeNamespace,
  systemSecretName,
} from './runtime-namespace';

describe('runtime namespace', () => {
  it('derives all AWS namespaces from the stack name', () => {
    const environment = { KOLIBRI_STACK_NAME: 'KolibriProduction' };
    expect(runtimeNamespace(environment)).toBe('KolibriProduction');
    expect(generationStoragePrefix(environment)).toBe('KolibriProduction');
    expect(designSystemRuntimeSecretName(environment)).toBe(
      'KolibriProduction/runtime/design-systems',
    );
    expect(systemSecretName(environment)).toBe('KolibriProduction/system');
  });

  it('uses the same local default for every namespace', () => {
    expect(runtimeNamespace({})).toBe('kolibri');
    expect(systemSecretName({})).toBe('kolibri/system');
  });

  it('rejects names that cannot be CloudFormation stack names', () => {
    expect(() => runtimeNamespace({ KOLIBRI_STACK_NAME: '../escape' })).toThrow(
      'KOLIBRI_STACK_NAME',
    );
  });
});
