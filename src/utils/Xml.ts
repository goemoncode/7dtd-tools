export type XmlProperty = XmlValueProperty | XmlClassProperty;

export interface XmlValueProperty {
  $: { name: string; value: string; param1?: string };
}

export interface XmlClassProperty {
  $: { class: string };
  property: XmlProperty[];
}

export function isXmlValueProperty(prop: XmlProperty): prop is XmlValueProperty {
  return prop !== undefined && prop !== null && '$' in prop && 'name' in prop.$;
}

export function isXmlClassProperty(prop: XmlProperty): prop is XmlClassProperty {
  return prop !== undefined && prop !== null && '$' in prop && 'class' in prop.$ && 'property' in prop && Array.isArray(prop.property);
}

export function evalOperation(leftSide: number, rightSide: number, operation: string) {
  switch (operation) {
    case 'LTE':
      return leftSide <= rightSide;
    case 'LT':
      return leftSide < rightSide;
    case 'GTE':
      return leftSide >= rightSide;
    case 'GT':
      return leftSide > rightSide;
    case 'EQ':
    case 'Equals':
      return leftSide == rightSide;
    default:
      return false;
  }
}
