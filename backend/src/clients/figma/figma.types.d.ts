export type FigmaColor = {
  r: number;
  g: number;
  b: number;
  a?: number;
};

export type FigmaPaint = {
  type: string;
  color?: FigmaColor;
  visible?: boolean;
  opacity?: number;
  imageRef?: string;
  scaleMode?: string;
};

export type FigmaImageAsset = {
  imageRef: string;
  contentBase64: string;
};

export type FigmaPath = { path: string; windingRule?: string };

export type FigmaEffect = {
  type: string;
  visible?: boolean;
  color?: FigmaColor;
  offset?: { x: number; y: number };
  radius?: number;
  spread?: number;
};

export type FigmaNode = {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  children?: FigmaNode[];
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  background?: FigmaPaint[];
  absoluteBoundingBox?: {
    x?: number;
    y?: number;
    width: number;
    height: number;
  };
  componentId?: string;
  componentSetId?: string;
  componentProperties?: Record<string, { value?: unknown; type?: string }>;
  componentPropertyDefinitions?: Record<
    string,
    { defaultValue?: unknown; type?: string }
  >;
  layoutMode?: string;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  itemSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  cornerRadius?: number;
  rectangleCornerRadii?: [number, number, number, number];
  strokeWeight?: number;
  individualStrokeWeights?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  strokeAlign?: 'INSIDE' | 'OUTSIDE' | 'CENTER';
  strokesIncludedInLayout?: boolean;
  opacity?: number;
  rotation?: number;
  effects?: FigmaEffect[];
  clipsContent?: boolean;
  layoutSizingHorizontal?: string;
  layoutSizingVertical?: string;
  layoutGrow?: number;
  layoutWrap?: 'NO_WRAP' | 'WRAP';
  counterAxisSpacing?: number;
  fillGeometry?: FigmaPath[];
  strokeGeometry?: FigmaPath[];
  style?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    lineHeightPx?: number;
    letterSpacing?: number;
    textAlignHorizontal?: string;
    textDecoration?: string;
    [key: string]: unknown;
  };
  characters?: string;
  boundVariables?: unknown;
};

export type FigmaFile = {
  name?: string;
  document: FigmaNode;
  components?: Record<string, unknown>;
  componentSets?: Record<string, unknown>;
};
