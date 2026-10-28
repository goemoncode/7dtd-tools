import { parseXml } from './parseXml.ts';

interface BlockPlaceholdersXml {
  blockplaceholders: {
    blockplaceholder: BlockPlaceholderXml[];
  };
}

interface BlockPlaceholderXml {
  $: { name: string };
  block: { $: BlockProb }[];
}

type BiomeType = 'pine_forest' | 'burnt_forest' | 'desert' | 'snow' | 'wasteland';

export interface BlockProb {
  name: string;
  prob?: number;
  biome?: BiomeType;
  randomrotation?: boolean;
}

export class BlockPlaceholders {
  constructor(public items: Map<string, BlockProb[]>) {}

  static async loadFromXml(xmlFileName: string): Promise<BlockPlaceholders> {
    const blockplaceholdersXml = await parseXml<BlockPlaceholdersXml>(xmlFileName);
    const items = new Map<string, BlockProb[]>(
      blockplaceholdersXml.blockplaceholders.blockplaceholder.map(({ $, block }) => [$.name, block.map((x) => x.$)]),
    );
    return new BlockPlaceholders(items);
  }
}
