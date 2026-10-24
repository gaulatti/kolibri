export type TokenKind =
  'color' | 'space' | 'radius' | 'typography' | 'size' | 'shadow';

export type TypographyValue = {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
};

export type SizeValue = { width?: number; height?: number };
export type TokenValue = string | number | TypographyValue | SizeValue;

export type KolibriToken = {
  name: string;
  cssName: string;
  kind: TokenKind;
  value: TokenValue;
  sourceNodeId: string;
};

export type NormalizedStyle = {
  background?: string;
  backgroundImageRef?: string;
  backgroundSize?: 'contain' | 'cover' | 'fill';
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  borderTopWidth?: number;
  borderRightWidth?: number;
  borderBottomWidth?: number;
  borderLeftWidth?: number;
  borderAlign?: 'inside' | 'outside' | 'center';
  borderIncludedInLayout?: boolean;
  opacity?: number;
  rotation?: number;
  boxShadow?: string;
  width?: number;
  height?: number;
  widthMode?: 'hug' | 'fill' | 'fixed';
  heightMode?: 'hug' | 'fill' | 'fixed';
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  overflow?: 'visible' | 'hidden' | 'auto';
  aspectRatio?: number;
  cornerRadius?: number;
  cornerRadii?: [number, number, number, number];
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  gap?: number;
  rowGap?: number;
  layout?: 'horizontal' | 'vertical';
  flexWrap?: 'nowrap' | 'wrap';
  alignItems?: 'flex-start' | 'center' | 'flex-end';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between';
  flexGrow?: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  textDecoration?: 'none' | 'underline' | 'line-through';
};

export type NormalizedVector = {
  name: string;
  width: number;
  height: number;
  paths: Array<{
    d: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
  }>;
};

export type ImportedComponentKind = 'atom' | 'molecule' | 'organism';

export type ImportedComponentVariant = {
  id: string;
  name: string;
  axes: Record<string, string>;
  style: NormalizedStyle;
  text?: string;
  vectors: NormalizedVector[];
  composition: ImportedComponentInstance[];
  visual: ImportedVisualNode[];
};

export type ImportedVisualNode = {
  id: string;
  key: string;
  name: string;
  type: string;
  text?: string;
  visible: boolean;
  semanticMetadata: Record<string, unknown>;
  part?: string;
  style: NormalizedStyle;
  vectors: NormalizedVector[];
  children: ImportedVisualNode[];
};

export type ComponentBehaviorKind =
  | 'none'
  | 'native-control'
  | 'disclosure'
  | 'accordion'
  | 'tabs'
  | 'dialog'
  | 'tooltip'
  | 'popover'
  | 'menu'
  | 'select'
  | 'form'
  | 'navigation';

export type ImportedComponentPart = {
  name: string;
  sourceNodeId: string;
  required: boolean;
  repeatable: boolean;
  element?: string;
};

export type ImportedBehaviorContract = {
  kind: ComponentBehaviorKind;
  adapterRequired: boolean;
  adapterEligible?: boolean;
  requiredParts: string[];
  optionalParts: string[];
  states: string[];
};

export type ImportedComponentInstance = {
  id: string;
  name: string;
  cssClass: string;
  componentId: string;
  componentName?: string;
  textOverride?: string;
  visible: boolean;
  semanticMetadata: Record<string, unknown>;
  style: NormalizedStyle;
  children: ImportedComponentInstance[];
};

export type ImportedComponent = {
  id: string;
  name: string;
  kind: ImportedComponentKind;
  type: 'component' | 'componentSet';
  pageName: string;
  sourceWidth?: number;
  sourceHeight?: number;
  semanticMetadata: Record<string, unknown>;
  style: NormalizedStyle;
  defaultText?: string;
  variants: ImportedComponentVariant[];
  composition: ImportedComponentInstance[];
  vectors: NormalizedVector[];
  visual: ImportedVisualNode[];
  parts?: ImportedComponentPart[];
  behavior?: ImportedBehaviorContract;
  contractVersion?: 'composable-v1';
};

export type Diagnostic = {
  severity: 'warning' | 'error';
  code: string;
  message: string;
  component?: string;
  nodeId?: string;
};

export type KolibriDesignSystem = {
  tokens: KolibriToken[];
  fontSources: ImportedFontSource[];
  imageReferences: string[];
  components: ImportedComponent[];
  diagnostics: Diagnostic[];
};

export type GeneratedArtifact = {
  path: string;
  content: string;
  encoding?: 'utf8' | 'base64';
};

export type ImportedFontSource = {
  family: string;
  provider: 'css';
  cssUrl: string;
  fallback: string;
  sourceNodeId: string;
};
