import { parseXml } from './parseXml';

interface LootXml {
  lootcontainers: {
    lootgroup: {
      $: { name: string; count?: string; loot_quality_template?: string };
      item?: LootXmlItem[];
    }[];
    lootcontainer: {
      $: { name: string; count: string; loot_quality_template?: string };
      item?: LootXmlItem[];
    }[];
  };
}

type LootXmlItem = LootXmlItemGroup | LootXmlLootItem;

interface LootXmlItemGroup {
  $: { group: string; count?: string; prob?: string; loot_prob_template?: string; force_prob?: string };
}

interface LootXmlLootItem {
  $: { name: string; count?: string; prob?: string; loot_prob_template?: string; force_prob?: string };
}

export interface LootTable {
  items: string[];
  groups: LootGroup[];
}

export interface LootContainer extends LootTable {
  name: string;
}

export interface LootGroup extends LootTable {
  name: string;
}

export class Loot {
  constructor(private lootXml: LootXml) {}

  static async loadFromXml(lootXmlFileName: string) {
    return new Loot(await parseXml<LootXml>(lootXmlFileName));
  }

  findLootContainer(pattern: RegExp | null = null): LootContainer[] {
    const { lootgroup, lootcontainer } = this.lootXml.lootcontainers;
    const groups = new Map(lootgroup.filter((g) => g.item).map(({ $, item }) => [$.name, item!]));
    return lootcontainer.flatMap((lootContainer) => {
      const m = matchLootTable(pattern, lootContainer.item ?? [], groups);
      if (m) {
        return { name: lootContainer.$.name, ...m };
      } else {
        return [];
      }
    });
  }
}

function matchLootTable(pattern: RegExp | null, items: LootXmlItem[], groups: Map<string, LootXmlItem[]>): LootTable | null {
  const matchedItems: string[] = [];
  const matchedGroups: LootGroup[] = [];

  for (const item of items) {
    if ('name' in item.$) {
      const itemName = item.$.name;
      if (pattern === null || pattern.test(itemName)) {
        matchedItems.push(itemName);
      }
    } else {
      const groupName = item.$.group;
      const group = groups.get(groupName);
      if (group) {
        const m = matchLootTable(pattern, group, groups);
        if (m) {
          matchedGroups.push({ name: groupName, ...m });
        }
      }
    }
  }

  if (matchedItems.length === 0 && matchedGroups.length === 0) {
    return null;
  }
  return { items: matchedItems, groups: matchedGroups };
}
