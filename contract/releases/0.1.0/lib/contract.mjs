import { createHash } from 'node:crypto';

export const RELEASE_VERSION = '0.1.0';
export const SCHEMA_VERSION = '1.0.0';
export const COMPATIBILITY = '>=1.0.0 <2.0.0';
export const SOURCE_REVISION = '24e6905a0a6b9e6dae08b0832781b0f06f8c0b5f';

const allowed = {
  root: ['metadata', 'components', 'entrypoints'],
  metadata: ['releaseVersion', 'schemaVersion', 'compatibleSchemaVersions', 'sourceRevision'],
  component: ['id', 'name', 'kind', 'tree', 'behaviors', 'events', 'actions', 'assets'],
  node: ['id', 'type', 'element', 'componentId', 'part', 'text', 'props', 'children'],
  behavior: ['id', 'kind', 'steps'],
  step: ['order', 'event', 'actionId'],
  event: ['name'],
  action: ['id', 'type', 'value', 'target'],
  asset: ['id', 'kind', 'uri', 'integrity'],
};

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys, path) => {
  if (!object(value)) throw new Error(`${path} must be an object`);
  const unknown = Object.keys(value).filter((key) => !keys.includes(key));
  if (unknown.length) throw new Error(`${path} has unsupported key: ${unknown[0]}`);
};
const requireKeys = (value, keys, path) => {
  for (const key of keys) if (!(key in value)) throw new Error(`${path}.${key} is required`);
};
const unique = (values, path) => {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`${path} has duplicate identifier: ${value}`);
    seen.add(value);
  }
};

export function validateContract(document) {
  exactKeys(document, allowed.root, '$');
  requireKeys(document, allowed.root, '$');
  exactKeys(document.metadata, allowed.metadata, '$.metadata');
  requireKeys(document.metadata, allowed.metadata, '$.metadata');
  if (document.metadata.releaseVersion !== RELEASE_VERSION) throw new Error(`$.metadata.releaseVersion must be ${RELEASE_VERSION}`);
  if (document.metadata.schemaVersion !== SCHEMA_VERSION) throw new Error(`incompatible schema version: ${document.metadata.schemaVersion}`);
  if (document.metadata.compatibleSchemaVersions !== COMPATIBILITY) throw new Error('$.metadata.compatibleSchemaVersions is unsupported');
  if (!/^[0-9a-f]{40}$/.test(document.metadata.sourceRevision)) throw new Error('$.metadata.sourceRevision must be a full commit SHA');
  if (!Array.isArray(document.components) || !document.components.length) throw new Error('$.components must be a non-empty array');
  if (!Array.isArray(document.entrypoints)) throw new Error('$.entrypoints must be an array');
  const componentIds = document.components.map((component) => component.id);
  unique(componentIds, '$.components');
  const componentSet = new Set(componentIds);
  unique(document.entrypoints, '$.entrypoints');
  for (const entrypoint of document.entrypoints) if (!componentSet.has(entrypoint)) throw new Error(`missing component reference: ${entrypoint}`);

  const visitNode = (node, path, nodeIds) => {
    exactKeys(node, allowed.node, path);
    requireKeys(node, ['id', 'type'], path);
    if (nodeIds.has(node.id)) throw new Error(`${path} has duplicate identifier: ${node.id}`);
    nodeIds.add(node.id);
    if (node.type === 'element') {
      if (!node.element) throw new Error(`${path}.element is required for element nodes`);
      if ('componentId' in node) throw new Error(`${path}.componentId is invalid for element nodes`);
    } else if (node.type === 'component') {
      if (!node.componentId || !componentSet.has(node.componentId)) throw new Error(`missing component reference: ${node.componentId ?? '<empty>'}`);
      if ('element' in node) throw new Error(`${path}.element is invalid for component nodes`);
    } else throw new Error(`${path}.type is unsupported: ${node.type}`);
    if (node.children !== undefined) {
      if (!Array.isArray(node.children)) throw new Error(`${path}.children must be an array`);
      node.children.forEach((child, index) => visitNode(child, `${path}.children[${index}]`, nodeIds));
    }
  };

  document.components.forEach((component, componentIndex) => {
    const path = `$.components[${componentIndex}]`;
    exactKeys(component, allowed.component, path);
    requireKeys(component, allowed.component, path);
    if (!['atom', 'molecule', 'organism'].includes(component.kind)) throw new Error(`${path}.kind is unsupported`);
    for (const key of ['tree', 'behaviors', 'events', 'actions', 'assets']) if (!Array.isArray(component[key])) throw new Error(`${path}.${key} must be an array`);
    const nodeIds = new Set();
    component.tree.forEach((node, index) => visitNode(node, `${path}.tree[${index}]`, nodeIds));
    component.events.forEach((event, index) => { exactKeys(event, allowed.event, `${path}.events[${index}]`); requireKeys(event, ['name'], `${path}.events[${index}]`); });
    component.actions.forEach((action, index) => { exactKeys(action, allowed.action, `${path}.actions[${index}]`); requireKeys(action, ['id', 'type'], `${path}.actions[${index}]`); if (!['emit', 'set-state', 'focus'].includes(action.type)) throw new Error(`${path}.actions[${index}].type is unsupported`); });
    component.assets.forEach((asset, index) => { exactKeys(asset, allowed.asset, `${path}.assets[${index}]`); requireKeys(asset, allowed.asset, `${path}.assets[${index}]`); });
    unique(component.events.map((event) => event.name), `${path}.events`);
    unique(component.actions.map((action) => action.id), `${path}.actions`);
    const events = new Set(component.events.map((event) => event.name));
    const actions = new Set(component.actions.map((action) => action.id));
    component.behaviors.forEach((behavior, behaviorIndex) => {
      const behaviorPath = `${path}.behaviors[${behaviorIndex}]`;
      exactKeys(behavior, allowed.behavior, behaviorPath);
      requireKeys(behavior, allowed.behavior, behaviorPath);
      if (behavior.kind !== 'sequence') throw new Error(`${behaviorPath}.kind is unsupported: ${behavior.kind}`);
      behavior.steps.forEach((step, stepIndex) => {
        const stepPath = `${behaviorPath}.steps[${stepIndex}]`;
        exactKeys(step, allowed.step, stepPath);
        requireKeys(step, allowed.step, stepPath);
        if (step.order !== stepIndex + 1) throw new Error(`${behaviorPath}.steps must use consecutive order starting at 1`);
        if (!events.has(step.event)) throw new Error(`${stepPath} references missing event: ${step.event}`);
        if (!actions.has(step.actionId)) throw new Error(`${stepPath} references missing action: ${step.actionId}`);
      });
    });
  });
  return document;
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!object(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

export function serialize(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}
