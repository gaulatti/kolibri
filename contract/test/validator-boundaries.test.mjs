import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as source from "../src/contract.mjs";
import * as release from "../releases/0.1.0/lib/contract.mjs";

const fixture = JSON.parse(
  await readFile(
    new URL(
      "../releases/0.1.0/fixtures/sequential-behavior.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const composed = JSON.parse(
  await readFile(
    new URL(
      "../releases/0.1.0/fixtures/composed-component.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const cases = [
  ["non-object root", () => null, /must be an object/],
  [
    "unknown root key",
    (v) => {
      v.hidden = true;
    },
    /unsupported key: hidden/,
  ],
  [
    "missing root key",
    (v) => {
      delete v.entrypoints;
    },
    /entrypoints is required/,
  ],
  [
    "non-object metadata",
    (v) => {
      v.metadata = [];
    },
    /metadata must be an object/,
  ],
  [
    "wrong release",
    (v) => {
      v.metadata.releaseVersion = "9.0.0";
    },
    /releaseVersion must be/,
  ],
  [
    "wrong schema",
    (v) => {
      v.metadata.schemaVersion = "2.0.0";
    },
    /incompatible schema/,
  ],
  [
    "wrong compatibility",
    (v) => {
      v.metadata.compatibleSchemaVersions = "*";
    },
    /unsupported/,
  ],
  [
    "short revision",
    (v) => {
      v.metadata.sourceRevision = "abcd";
    },
    /full commit SHA/,
  ],
  [
    "missing components",
    (v) => {
      v.components = null;
    },
    /non-empty array/,
  ],
  [
    "empty components",
    (v) => {
      v.components = [];
    },
    /non-empty array/,
  ],
  [
    "non-array entrypoints",
    (v) => {
      v.entrypoints = "disclosure";
    },
    /entrypoints must be an array/,
  ],
  [
    "duplicate components",
    (v) => {
      v.components.push(structuredClone(v.components[0]));
    },
    /duplicate identifier: disclosure/,
  ],
  [
    "duplicate entrypoints",
    (v) => {
      v.entrypoints.push(v.entrypoints[0]);
    },
    /duplicate identifier: disclosure/,
  ],
  [
    "missing entrypoint reference",
    (v) => {
      v.entrypoints = ["missing"];
    },
    /missing component reference: missing/,
  ],
  [
    "unsupported component kind",
    (v) => {
      v.components[0].kind = "template";
    },
    /kind is unsupported/,
  ],
  ...["tree", "behaviors", "events", "actions", "assets"].map((key) => [
    `non-array ${key}`,
    (v) => {
      v.components[0][key] = null;
    },
    new RegExp(`${key} must be an array`),
  ]),
  [
    "duplicate tree node",
    (v) => {
      v.components[0].tree.push(structuredClone(v.components[0].tree[0]));
    },
    /duplicate identifier: root/,
  ],
  [
    "missing element",
    (v) => {
      delete v.components[0].tree[0].element;
    },
    /element is required/,
  ],
  [
    "component reference on element",
    (v) => {
      v.components[0].tree[0].componentId = "disclosure";
    },
    /componentId is invalid/,
  ],
  [
    "unsupported node type",
    (v) => {
      v.components[0].tree[0].type = "script";
    },
    /type is unsupported/,
  ],
  [
    "non-array children",
    (v) => {
      v.components[0].tree[0].children = {};
    },
    /children must be an array/,
  ],
  [
    "missing component reference",
    (v) => {
      v.components[0].tree[0] = { id: "ref", type: "component" };
    },
    /missing component reference: <empty>/,
  ],
  [
    "unknown component reference",
    (v) => {
      v.components[0].tree[0] = {
        id: "ref",
        type: "component",
        componentId: "unknown",
      };
    },
    /missing component reference: unknown/,
  ],
  [
    "element on component reference",
    (v) => {
      v.components[0].tree[0] = {
        id: "ref",
        type: "component",
        componentId: "disclosure",
        element: "div",
      };
    },
    /element is invalid/,
  ],
  [
    "missing event name",
    (v) => {
      v.components[0].events[0] = {};
    },
    /name is required/,
  ],
  [
    "duplicate event name",
    (v) => {
      v.components[0].events.push({ name: "activate" });
    },
    /duplicate identifier: activate/,
  ],
  [
    "duplicate action id",
    (v) => {
      v.components[0].actions.push(structuredClone(v.components[0].actions[0]));
    },
    /duplicate identifier: set-open/,
  ],
  [
    "unsupported action",
    (v) => {
      v.components[0].actions[0].type = "execute";
    },
    /type is unsupported/,
  ],
  [
    "missing asset fields",
    (v) => {
      v.components[0].assets = [{ id: "asset" }];
    },
    /kind is required/,
  ],
  [
    "unsupported behavior",
    (v) => {
      v.components[0].behaviors[0].kind = "parallel";
    },
    /kind is unsupported/,
  ],
  [
    "unsupported behavior field",
    (v) => {
      v.components[0].behaviors[0].delay = 1;
    },
    /unsupported key: delay/,
  ],
  [
    "nonconsecutive behavior order",
    (v) => {
      v.components[0].behaviors[0].steps[0].order = 2;
    },
    /consecutive order/,
  ],
  [
    "missing event reference",
    (v) => {
      v.components[0].behaviors[0].steps[0].event = "unknown";
    },
    /references missing event/,
  ],
  [
    "missing action reference",
    (v) => {
      v.components[0].behaviors[0].steps[0].actionId = "unknown";
    },
    /references missing action/,
  ],
];

for (const [name, library] of [
  ["source", source],
  ["immutable release", release],
]) {
  test(`${name} validates complete references, preserves values and canonicalizes deterministically`, () => {
    assert.equal(
      library.validateContract(structuredClone(composed)).components.length,
      2,
    );
    assert.equal(
      library.validateContract(structuredClone(fixture)).components[0]
        .behaviors[0].steps.length,
      2,
    );
    assert.deepEqual(
      library.canonicalize({ z: [null, 3, { b: false, a: "x" }], a: true }),
      { a: true, z: [null, 3, { a: "x", b: false }] },
    );
    assert.equal(
      library.serialize({ b: 2, a: 1 }),
      '{\n  "a": 1,\n  "b": 2\n}\n',
    );
    assert.equal(
      library.sha256("abc"),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
  for (const [boundary, mutate, expected] of cases) {
    test(`${name} rejects ${boundary}`, () => {
      const input = structuredClone(fixture);
      const replacement = mutate(input);
      assert.throws(
        () => library.validateContract(replacement === null ? null : input),
        expected,
      );
    });
  }
}
