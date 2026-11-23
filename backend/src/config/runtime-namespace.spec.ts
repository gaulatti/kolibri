import {
  designSystemRuntimeSecretName,
  generationStoragePrefix,
  runtimeNamespace,
} from './runtime-namespace';

describe('runtime namespace', () => {
  it('derives the Design System secret and the S3 key namespaces from the stack name', () => {
    const environment = { KOLIBRI_STACK_NAME: 'KolibriProduction' };
    expect(runtimeNamespace(environment)).toBe('KolibriProduction');
    expect(generationStoragePrefix(environment)).toBe('KolibriProduction');
    expect(designSystemRuntimeSecretName(environment)).toBe(
      'KolibriProduction/runtime/design-systems',
    );
  });

  it('reads process.env when no environment is given', () => {
    const saved = process.env.KOLIBRI_STACK_NAME;
    process.env.KOLIBRI_STACK_NAME = 'FromProcess';
    try {
      expect(runtimeNamespace()).toBe('FromProcess');
      expect(generationStoragePrefix()).toBe('FromProcess');
      expect(designSystemRuntimeSecretName()).toBe(
        'FromProcess/runtime/design-systems',
      );
    } finally {
      if (saved === undefined) delete process.env.KOLIBRI_STACK_NAME;
      else process.env.KOLIBRI_STACK_NAME = saved;
    }
  });

  it('uses the same local default for every namespace', () => {
    expect(runtimeNamespace({})).toBe('kolibri');
  });

  it('rejects names that cannot be CloudFormation stack names', () => {
    expect(() => runtimeNamespace({ KOLIBRI_STACK_NAME: '../escape' })).toThrow(
      'KOLIBRI_STACK_NAME',
    );
  });
});
