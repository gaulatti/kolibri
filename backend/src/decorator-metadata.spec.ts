/* eslint-disable @typescript-eslint/no-require-imports -- these specs load modules in isolation with require() to control evaluation order */
import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Compiled decorators record design-time types with a runtime guard: a type
 * that cannot be resolved when the class is declared (a missing or circular
 * import, an unavailable global) is recorded as `Object` instead of throwing.
 * These tests declare the real classes in that situation and assert that
 * declaration still succeeds and degrades only the affected metadata, so
 * dependency injection tokens given explicitly (`@Inject`, repositories) are
 * unaffected.
 */

type Metadata = Record<string, unknown>;

const mockedModules = new Set<string>();
function mockModule(path: string, factory: () => unknown): void {
  mockedModules.add(path);
  jest.doMock(path, factory);
}

afterEach(() => {
  for (const path of mockedModules) jest.dontMock(path);
  mockedModules.clear();
  jest.resetModules();
});

function describeClass(cls: { prototype: object } & object): Metadata {
  const result: Metadata = {
    ctor: Reflect.getMetadata('design:paramtypes', cls),
  };
  for (const name of Object.getOwnPropertyNames(cls.prototype)) {
    if (name === 'constructor') continue;
    const target = cls.prototype;
    result[`${name}:type`] = Reflect.getMetadata('design:type', target, name);
    result[`${name}:params`] = Reflect.getMetadata(
      'design:paramtypes',
      target,
      name,
    );
    result[`${name}:return`] = Reflect.getMetadata(
      'design:returntype',
      target,
      name,
    );
  }
  return result;
}

function valueImports(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const specifiers: string[] = [];
  for (const match of source.matchAll(
    /^(?:import|export)\s+(?!type\s)[^;]*?from\s+'([^']+)'/gms,
  )) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

function declare(
  file: string,
  exportName: string,
  options: {
    blank?: string[];
    hideGlobals?: Array<'Promise' | 'Date'>;
    enumAsFunction?: string;
  } = {},
): { prototype: object } & object {
  const absolute = resolve(__dirname, file);
  jest.resetModules();
  for (const specifier of options.blank ?? []) {
    if (specifier.startsWith('.')) {
      mockModule(resolve(dirname(absolute), specifier), () => ({}));
    }
  }
  if (options.blank?.includes('@nestjs/core:Reflector')) {
    mockModule('@nestjs/core', () => ({
      ...jest.requireActual<object>('@nestjs/core'),
      Reflector: undefined,
    }));
  }
  if (options.enumAsFunction) {
    const enumPath = resolve(dirname(absolute), options.enumAsFunction);
    mockModule(enumPath, () => {
      const actual = jest.requireActual<Record<string, object>>(enumPath);
      const exports: Record<string, unknown> = {};
      for (const [name, value] of Object.entries(actual)) {
        exports[name] = Object.assign(function EnumLike() {}, value);
      }
      return exports;
    });
  }
  // Evaluate every dependency first so only the target's own declarations run
  // while the global is unavailable.
  for (const specifier of valueImports(absolute)) {
    if (specifier.startsWith('.')) {
      require(resolve(dirname(absolute), specifier));
    } else {
      require(specifier);
    }
  }
  const hidden = (options.hideGlobals ?? []).map((name) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)!;
    Object.defineProperty(globalThis, name, {
      value: undefined,
      configurable: true,
      writable: true,
    });
    return [name, descriptor] as const;
  });
  try {
    return (
      require(absolute) as Record<string, { prototype: object } & object>
    )[exportName];
  } finally {
    for (const [name, descriptor] of hidden) {
      Object.defineProperty(globalThis, name, descriptor);
    }
  }
}

function expectDegradedToObject(normal: Metadata, degraded: Metadata): void {
  let changed = 0;
  for (const key of Object.keys(normal)) {
    const before = normal[key];
    const after = degraded[key];
    if (Array.isArray(before) && Array.isArray(after)) {
      before.forEach((value, index) => {
        if (value !== after[index]) {
          changed += 1;
          expect(after[index]).toBe(Object);
        }
      });
    } else if (before !== after) {
      changed += 1;
      expect(after).toBe(Object);
    }
  }
  expect(changed).toBeGreaterThan(0);
}

const SERVICE_AND_DTO_CASES: Array<{
  file: string;
  exportName: string;
  blank: string[];
  hideGlobals?: Array<'Promise' | 'Date'>;
}> = [
  {
    file: 'app.controller.ts',
    exportName: 'AppController',
    blank: ['./app.service'],
  },
  {
    file: 'auth/cognito-auth.guard.ts',
    exportName: 'CognitoAuthGuard',
    blank: ['./auth.service', '@nestjs/core:Reflector'],
  },
  {
    file: 'dashboard/dashboard.controller.ts',
    exportName: 'DashboardController',
    blank: ['./dashboard.service'],
    hideGlobals: ['Promise'],
  },
  {
    file: 'design-systems/design-systems.controller.ts',
    exportName: 'DesignSystemsController',
    blank: [
      './design-systems.service',
      './dto/create-design-system.dto',
      './dto/design-system-id.params',
      './dto/update-design-system.dto',
    ],
    hideGlobals: ['Promise'],
  },
  {
    file: 'design-systems/design-systems.service.ts',
    exportName: 'DesignSystemsService',
    blank: [
      '../secrets/design-system-secrets.service',
      '../storage/generation-storage',
    ],
  },
  {
    file: 'generation/generation.controller.ts',
    exportName: 'GenerationController',
    blank: [
      './generation-events.service',
      './generation-history.service',
      './generation.service',
      './dto/create-generation.dto',
      './dto/generation-history-query.dto',
      './dto/generation-id.params',
    ],
    hideGlobals: ['Promise'],
  },
  {
    file: 'generation/generation.service.ts',
    exportName: 'GenerationService',
    blank: [
      '../clients/figma/figma.client',
      '../css-exporter/css-exporter.service',
      '../exporters/react/react-exporter.service',
      '../figma-importer/figma-importer.service',
      '../package-assembler/package-assembler.service',
      '../npm-publication/npm-publication.service',
      '../secrets/design-system-secrets.service',
      '../storage/generation-storage',
      './generation-events.service',
    ],
  },
  {
    file: 'npm-publication/npm-publication.service.ts',
    exportName: 'NpmPublicationService',
    blank: ['../config/system-configuration.service'],
  },
  {
    file: 'reports/generation-history-report.service.ts',
    exportName: 'GenerationHistoryReportService',
    blank: ['../generation/generation-history.service'],
  },
  {
    file: 'reports/reports.controller.ts',
    exportName: 'ReportsController',
    blank: [
      './generation-history-report.service',
      '../generation/dto/generation-history-query.dto',
    ],
    hideGlobals: ['Promise'],
  },
  {
    file: 'secrets/design-system-credentials.controller.ts',
    exportName: 'DesignSystemCredentialsController',
    blank: [
      './design-system-secrets.service',
      '../design-systems/dto/design-system-id.params',
      './dto/set-design-system-runtime-configuration.dto',
      './dto/set-design-system-runtime-credentials.dto',
    ],
    hideGlobals: ['Promise'],
  },
  {
    file: 'secrets/design-system-secrets.service.ts',
    exportName: 'DesignSystemSecretsService',
    blank: [
      '../config/system-configuration.service',
      '../npm-publication/npm-publication.service',
    ],
  },
  {
    file: 'storage/local-generation.storage.ts',
    exportName: 'LocalGenerationStorage',
    blank: ['../artifacts/artifacts.service'],
  },
];

describe('decorator metadata when a design-time type is unavailable', () => {
  it.each(SERVICE_AND_DTO_CASES)(
    '$exportName still declares and records Object for unavailable types',
    ({ file, exportName, blank, hideGlobals }) => {
      const normal = describeClass(declare(file, exportName));
      const degraded = describeClass(
        declare(file, exportName, { blank, hideGlobals }),
      );
      expectDegradedToObject(normal, degraded);
    },
  );

  it.each([
    [
      'persistence/entities/design-system.entity.ts',
      'DesignSystem',
      ['createdAt', 'updatedAt'],
    ],
    [
      'persistence/entities/generation-event.entity.ts',
      'GenerationEvent',
      ['createdAt'],
    ],
    [
      'persistence/entities/generation-run.entity.ts',
      'GenerationRun',
      ['createdAt', 'updatedAt'],
    ],
    [
      'persistence/entities/user-reference.entity.ts',
      'UserReference',
      ['createdAt'],
    ],
  ])(
    '%s records Object for date columns when Date is unavailable',
    (file, exportName, dateProperties) => {
      const designType = (cls: { prototype: object }, property: string) =>
        Reflect.getMetadata('design:type', cls.prototype, property) as unknown;
      const normal = declare(file, exportName);
      for (const property of dateProperties) {
        expect(designType(normal, property)).toBe(Date);
      }
      // Blank the sibling entities so none of them pulls the target into the
      // module registry before Date is hidden.
      const blank = valueImports(resolve(__dirname, file)).filter(
        (specifier) =>
          specifier.startsWith('.') && !specifier.endsWith('.enum'),
      );
      const degraded = declare(file, exportName, {
        blank,
        hideGlobals: ['Date'],
      });
      for (const property of dateProperties) {
        expect(designType(degraded, property)).toBe(Object);
      }
    },
  );

  it.each([
    [
      'persistence/entities/generation-run.entity.ts',
      'GenerationRun',
      './generation-run-status.enum',
    ],
    [
      'generation/dto/generation-history-query.dto.ts',
      'GenerationHistoryQueryDto',
      '../../persistence/entities/generation-run-status.enum',
    ],
  ])(
    '%s records a constructor-typed enum as its design type',
    (file, exportName, enumModule) => {
      const cls = declare(file, exportName, { enumAsFunction: enumModule });
      const status = Reflect.getMetadata(
        'design:type',
        cls.prototype,
        'status',
      ) as unknown;
      expect(typeof status).toBe('function');
    },
  );
});
