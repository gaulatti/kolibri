/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment -- these specs load modules in isolation with require() to control evaluation order */
const TYPE_ONLY_MODULES = [
  './auth/authenticated-user',
  './clients/figma/figma.types',
  './component-contracts/component-contract.types',
  './dashboard/dashboard.types',
  './figma-importer/figma-importer.types',
  './generation/generation-history.types',
  './reports/generation-history-report.types',
];

describe('type-only modules', () => {
  it.each(TYPE_ONLY_MODULES)(
    '%s loads with no runtime exports or side effects',
    (specifier) => {
      let loaded: Record<string, unknown> | undefined;
      jest.isolateModules(() => {
        loaded = require(specifier);
      });
      expect(Object.keys(loaded ?? { unloaded: true })).toEqual([]);
    },
  );
});
