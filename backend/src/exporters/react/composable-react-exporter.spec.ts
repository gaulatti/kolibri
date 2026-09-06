import { applyComponentContract } from '../../component-contracts/component-contract.validator';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  Diagnostic,
  ImportedComponent,
  ImportedVisualNode,
  KolibriDesignSystem,
} from '../../figma-importer/figma-importer.types';
import { ReactExporterService } from './react-exporter.service';
import ts from 'typescript';

function visual(
  id: string,
  name: string,
  part?: string,
  children: ImportedVisualNode[] = [],
): ImportedVisualNode {
  return {
    id,
    key: id.replace(':', '-'),
    name,
    type: name === 'Title' ? 'TEXT' : 'FRAME',
    text: name === 'Title' ? 'Account settings' : undefined,
    visible: true,
    semanticMetadata: {},
    part,
    style: {},
    vectors: [],
    children,
  };
}

function component(): ImportedComponent {
  return {
    id: '1:1',
    name: 'modal',
    kind: 'molecule',
    type: 'component',
    pageName: '03-molecules',
    semanticMetadata: { 'semantic.component': 'dialog' },
    style: {},
    variants: [],
    composition: [],
    vectors: [],
    visual: [
      visual('1:2', 'Backdrop', 'backdrop'),
      visual('1:3', 'Content', 'content', [
        visual('1:4', 'Title', 'title'),
        visual('1:5', 'Close', 'close'),
      ]),
    ],
  };
}

describe('composable React generation', () => {
  it('normalizes stable parts and attaches an adapter only to complete contracts', () => {
    const diagnostics: Diagnostic[] = [];
    const normalized = applyComponentContract(component(), diagnostics);
    expect(normalized.behavior).toMatchObject({
      kind: 'dialog',
      adapterRequired: true,
      requiredParts: ['content', 'title'],
    });
    expect(normalized.parts?.map((part) => part.name)).toEqual([
      'backdrop',
      'content',
      'title',
      'close',
    ]);
    expect(diagnostics).toEqual([]);

    const system: KolibriDesignSystem = {
      tokens: [],
      fontSources: [],
      imageReferences: [],
      components: [normalized],
      diagnostics,
    };
    const artifacts = new ReactExporterService().generateComponents(
      system,
      'composable-v1',
    );
    const view = artifacts.find((artifact) =>
      artifact.path.endsWith('Modal.view.tsx'),
    );
    const binding = artifacts.find((artifact) =>
      artifact.path.endsWith('/Modal.tsx'),
    );
    const manifest = artifacts.find(
      (artifact) => artifact.path === 'kolibri.manifest.json',
    );
    const story = artifacts.find((artifact) =>
      artifact.path.endsWith('Modal.stories.tsx'),
    );
    expect(view?.content).toContain('export function ModalView');
    expect(view?.content).toContain('data-part="content"');
    expect(view?.content).toContain('slots?: Partial<Record<ModalPart');
    expect(view?.content).not.toContain('useState');
    expect(binding?.content).toContain('withDialogBehavior(ModalView)');
    expect(story?.content).toContain('BehaviorContract');
    expect(story?.content).toContain("toHaveAttribute('role', 'dialog')");
    expect(JSON.parse(manifest?.content ?? '{}')).toMatchObject({
      contractVersion: 'composable-v1',
      components: {
        Modal: {
          behavior: 'dialog',
          adapterAttached: true,
        },
      },
    });
    for (const artifact of artifacts.filter((candidate) =>
      /\.(?:ts|tsx)$/.test(candidate.path),
    )) {
      const result = ts.transpileModule(artifact.content, {
        fileName: artifact.path,
        reportDiagnostics: true,
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2020,
        },
      });
      expect(result.diagnostics ?? []).toEqual([]);
    }
  });

  it('exports only the view when a required behavior part is absent', () => {
    const diagnostics: Diagnostic[] = [];
    const source = component();
    source.visual = source.visual.filter((node) => node.part !== 'content');
    const normalized = applyComponentContract(source, diagnostics);
    const artifacts = new ReactExporterService().generateComponents(
      {
        tokens: [],
        fontSources: [],
        imageReferences: [],
        components: [normalized],
        diagnostics,
      },
      'composable-v1',
    );
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'REQUIRED_COMPONENT_PART_MISSING',
        }),
      ]),
    );
    expect(
      artifacts.find((artifact) => artifact.path.endsWith('/Modal.tsx'))
        ?.content,
    ).toBe("export { ModalView } from './Modal.view';\n");
  });

  it('keeps composable diagnostics out of legacy validation', () => {
    const diagnostics: Diagnostic[] = [];
    const source = component();
    source.visual = [];

    const normalized = applyComponentContract(source, diagnostics, false);

    expect(normalized.contractVersion).toBe('composable-v1');
    expect(diagnostics).toEqual([]);
  });

  it.each(['switch', 'radio-group'])(
    'requires the actual native control part for %s',
    (name) => {
      const diagnostics: Diagnostic[] = [];
      const source = component();
      source.name = name;
      source.semanticMetadata = { 'semantic.component': name };
      source.visual = [];

      const normalized = applyComponentContract(source, diagnostics);

      expect(normalized.behavior).toMatchObject({
        kind: 'native-control',
        adapterRequired: false,
        requiredParts: ['control'],
        adapterEligible: false,
      });
      expect(diagnostics).toEqual([
        expect.objectContaining({
          code: 'REQUIRED_COMPONENT_PART_MISSING',
          component: name,
        }),
      ]);
    },
  );

  it('reports semantic-part drift between component-set variants', () => {
    const diagnostics: Diagnostic[] = [];
    const source = component();
    source.type = 'componentSet';
    source.variants = [
      {
        id: '1:10',
        name: 'state=open',
        axes: { state: 'open' },
        style: {},
        vectors: [],
        composition: [],
        visual: source.visual,
      },
      {
        id: '1:20',
        name: 'state=closed',
        axes: { state: 'closed' },
        style: {},
        vectors: [],
        composition: [],
        visual: [visual('1:21', 'Content', 'content')],
      },
    ];

    applyComponentContract(source, diagnostics);

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'VARIANT_PART_MISMATCH' }),
      ]),
    );
  });

  it('reports mismatched repeated behavior-part counts', () => {
    const diagnostics: Diagnostic[] = [];
    const source = component();
    source.name = 'accordion';
    source.semanticMetadata = { 'semantic.component': 'accordion' };
    source.visual = [
      visual('1:2', 'Item', 'item', [
        visual('1:3', 'Trigger', 'trigger'),
        visual('1:4', 'Panel', 'panel'),
      ]),
      visual('1:5', 'Item', 'item', [visual('1:6', 'Trigger', 'trigger')]),
      visual('1:7', 'Separator', 'separator'),
    ];

    const normalized = applyComponentContract(source, diagnostics);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe('COMPONENT_PART_CARDINALITY_MISMATCH');
    expect(diagnostics[0]?.message).toContain('item=2, trigger=2, panel=1');
    const binding = new ReactExporterService()
      .generateComponents(
        {
          tokens: [],
          fontSources: [],
          imageReferences: [],
          components: [normalized],
          diagnostics,
        },
        'composable-v1',
      )
      .find((artifact) => artifact.path.endsWith('/Accordion.tsx'));
    expect(binding?.content).toBe(
      "export { AccordionView } from './Accordion.view';\n",
    );
  });

  it('accepts semantic title and description parts in popovers', () => {
    const diagnostics: Diagnostic[] = [];
    const source = component();
    source.name = 'popover';
    source.semanticMetadata = { 'semantic.component': 'popover' };
    source.visual = [
      visual('1:2', 'Trigger', 'trigger'),
      visual('1:3', 'Content', 'content', [
        visual('1:4', 'Title', 'title'),
        visual('1:5', 'Description', 'description'),
      ]),
    ];

    const normalized = applyComponentContract(source, diagnostics);

    expect(normalized.behavior?.optionalParts).toEqual(
      expect.arrayContaining(['title', 'description']),
    );
    expect(diagnostics).toEqual([]);
  });

  it('type-checks the generated consumer modules as a package', async () => {
    const normalized = applyComponentContract(component(), []);
    const artifacts = new ReactExporterService()
      .generateComponents(
        {
          tokens: [],
          fontSources: [],
          imageReferences: [],
          components: [normalized],
          diagnostics: [],
        },
        'composable-v1',
      )
      .filter(
        (artifact) =>
          /\.(?:ts|tsx)$/.test(artifact.path) &&
          !artifact.path.includes('.stories.'),
      );
    const temporaryRoot = await mkdtemp(
      join(process.cwd(), '.generated-contract-'),
    );
    try {
      const sourceRoot = join(temporaryRoot, 'src');
      const rootNames: string[] = [];
      for (const artifact of artifacts) {
        const target = join(sourceRoot, artifact.path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, artifact.content, 'utf8');
        rootNames.push(target);
      }
      const program = ts.createProgram(rootNames, {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        jsx: ts.JsxEmit.ReactJSX,
        strict: true,
        noEmit: true,
        skipLibCheck: true,
      });
      const diagnostics = ts.getPreEmitDiagnostics(program);
      expect(
        diagnostics.map((diagnostic) =>
          ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        ),
      ).toEqual([]);
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });
});
