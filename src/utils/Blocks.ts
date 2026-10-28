import { parseXml } from './parseXml.ts';
import { isXmlClassProperty, type XmlProperty } from "./Xml.ts";

interface BlocksXml {
  blocks: {
    block: BlockXml[];
  };
}

interface BlockXml {
  $: { name: string };
  property: XmlProperty[];
}

export interface Block {
  name: string;
  props: BlockProperties;

  extendsFrom?: Block;
  omitProps?: string[];
  downgradeTo?: Block;
  downgradedFrom?: Block[];

  className?: string;
  creativeMode?: string;
  compositeFeatures?: BlockProperties;
  lootList?: string;
}

export interface BlockProperties {
  [name: string]: BlockPropertyValue | BlockClasses;
}

export interface BlockPropertyValue {
  value: string;
  param1?: string;
}

export interface BlockClasses {
  [name: string]: BlockPropertyValue | BlockClasses;
}

function isPropertyValue(prop: BlockPropertyValue | BlockClasses | undefined): prop is BlockPropertyValue {
  return prop !== undefined && 'value' in prop && typeof prop.value === 'string';
}

export type DowngradeGraph = Block[];

export class Blocks {
  public lootContainers: Map<string, Block[]> = new Map<string, Block[]>();

  constructor(private blocks: Map<string, Block>) {
    for (const block of blocks.values()) {
      if (block.lootList) {
        const blocks = this.lootContainers.getOrInsert(block.lootList, []);
        blocks.push(block);
      }
    }
  }

  static async loadFromXml(blocksXmlFileName: string): Promise<Blocks> {
    const blocksXml = await parseXml<BlocksXml>(blocksXmlFileName);
    const blocks = new Map<string, Block>(
      blocksXml.blocks.block.map(({ $, property }) => {
        const { name } = $;
        const props = convertProperties(property);
        return [name, { name, props }];
      }),
    );
    for (const block of blocks.values()) {
      const extendsProp = block.props['Extends'];
      if (extendsProp && isPropertyValue(extendsProp)) {
        block.extendsFrom = blocks.get(extendsProp.value?.trim());
        block.omitProps = extendsProp.param1?.split(',').map((p) => p.trim()) ?? [];
        if (!block.extendsFrom) console.warn('Unknown parent block: %d', extendsProp.value);
      }
      const downgradeBlockProp = block.props['DowngradeBlock'];
      if (downgradeBlockProp && isPropertyValue(downgradeBlockProp)) {
        block.downgradeTo = blocks.get(downgradeBlockProp.value?.trim());
        if (block.downgradeTo) {
          block.downgradeTo.downgradedFrom ??= [];
          block.downgradeTo.downgradedFrom.push(block);
        }
      }
    }
    for (const block of blocks.values()) {
      block.className = getPropertyExtended(block, 'Class')?.value;
      block.creativeMode = getPropertyExtended(block, 'CreativeMode')?.value;
      const compositeFeaturesProp = block.props['CompositeFeatures'];
      if (compositeFeaturesProp && !isPropertyValue(compositeFeaturesProp)) {
        block.compositeFeatures = compositeFeaturesProp;
        if ('TEFeatureStorage' in compositeFeaturesProp && 'LootList' in compositeFeaturesProp['TEFeatureStorage']) {
          const lootListProp = compositeFeaturesProp['TEFeatureStorage']['LootList'];
          if (lootListProp && isPropertyValue(lootListProp)) block.lootList = lootListProp.value;
        }
      }
    }
    return new Blocks(blocks);
  }

  find(predicate: (block: Block) => boolean): Block[] {
    return Array.from(this.blocks.values())
      .filter((block) => block.creativeMode !== 'None')
      .filter(predicate);
  }

  getDowngradeGraphs(graph: DowngradeGraph): DowngradeGraph[] {
    return graph[0].downgradedFrom?.flatMap((block) => this.getDowngradeGraphs([block, ...graph])) ?? [graph];
  }
}

function getPropertyExtended(block: Block, propertyName: string): BlockPropertyValue | undefined {
  const prop = block.props[propertyName];
  if (prop && isPropertyValue(prop)) return prop;
  const { extendsFrom, omitProps } = block;
  if (extendsFrom && !(omitProps ?? []).includes(propertyName)) {
    return getPropertyExtended(extendsFrom, propertyName);
  } else {
    return undefined;
  }
}

function convertProperties(xmlProperties: XmlProperty[]): BlockProperties {
  const result: BlockProperties = {};
  for (const prop of xmlProperties) {
    if (isXmlClassProperty(prop)) {
      const className = prop.$.class;
      result[className] = convertProperties(prop.property);
    } else {
      const propName = prop.$.name;
      result[propName] = prop.$;
    }
  }
  return result;
}
