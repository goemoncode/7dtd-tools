import { parseXml } from './parseXml';

interface BlockXml {
  blocks: {
    block: BlockXmlBlock[];
  };
}

interface BlockXmlBlock {
  $: { name: string };
  property: BlockXmlBlockProperty[];
}

interface BlockXmlBlockProperty {
  $: { name: string; value: string; param1?: string };
}

type BlockName = string;

export interface Block {
  name: BlockName;
  properties: BlockProperties;
  parentBlock?: Block;
  excludedPropNames?: string[];
  downgradedFrom?: Block[];
}

export interface BlockProperties {
  [name: string]: BlockPropertyValue;
}

export interface BlockPropertyValue {
  value: string;
  param1?: string;
}

export type DowngradeGraph = Block[];

const LOOT_CLASS_NAMES = new Set(['Loot', 'CarExplodeLoot', 'SecureLoot']);

export class Blocks {
  constructor(private blocks: Map<BlockName, Block>) {}

  static async loadFromXml(blocksXmlFileName: string): Promise<Blocks> {
    const blockXml = await parseXml<BlockXml>(blocksXmlFileName);
    const blocks = new Map<BlockName, Block>(
      blockXml.blocks.block.map(({ $, property }) => [
        $.name,
        { name: $.name, properties: Object.fromEntries(new Map(property.map(({ $ }) => [$.name, $]))) },
      ])
    );
    for (const block of blocks.values()) {
      const extendsProp = block.properties['Extends'];
      if (extendsProp) {
        block.excludedPropNames = extendsProp.param1?.split(',').map((p) => p.trim()) ?? [];
        block.parentBlock = blocks.get(extendsProp.value?.trim());
        if (!block.parentBlock) {
          console.warn('Unknown parent block: %d', extendsProp.value);
        }
      }
      const downgradeBlock = blocks.get(block.properties['DowngradeBlock']?.value?.trim());
      if (downgradeBlock) {
        downgradeBlock.downgradedFrom ??= [];
        downgradeBlock.downgradedFrom.push(block);
      }
    }
    return new Blocks(blocks);
  }

  find(predicate: (block: Block) => boolean): Block[] {
    return Array.from(this.blocks.values())
      .filter((b) => {
        const creativeMode = this.getPropertyExtended(b, 'CreativeMode')?.value;
        return !creativeMode || creativeMode !== 'None';
      })
      .filter((b) => predicate(b));
  }

  findByLootIds(lootContainerIds: Set<string>): Block[] {
    return this.find((b) => {
      const blockClass = this.getPropertyExtended(b, 'Class')?.value ?? '';
      if (!LOOT_CLASS_NAMES.has(blockClass)) return false;
      const lootId = this.getPropertyExtended(b, 'LootList')?.value;
      if (!lootId) return false;
      return lootContainerIds.has(lootId);
    });
  }

  getDowngradeGraphs(graph: DowngradeGraph): DowngradeGraph[] {
    return graph[0].downgradedFrom?.flatMap((b) => this.getDowngradeGraphs([b, ...graph])) ?? [graph];
  }

  private getPropertyExtended(block: Block, propertyName: string): BlockPropertyValue | null {
    const prop = block.properties[propertyName];
    if (prop) return prop;
    const { parentBlock, excludedPropNames } = block;
    if (parentBlock && !(excludedPropNames ?? []).includes(propertyName)) {
      return this.getPropertyExtended(parentBlock, propertyName);
    } else {
      return null;
    }
  }
}
