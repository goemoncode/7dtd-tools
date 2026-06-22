import { parseXml } from './parseXml';

interface ItemsXmlRoot {
  items: {
    item: ItemsXmlElement[];
  };
}

interface ItemsXmlElement {
  $: { name: string };
  property: ItemsXmlProperty[];
  // effect_group
}

type ItemsXmlProperty = ItemsXmlValueProperty | ItemsXmlClassProperty;

interface ItemsXmlValueProperty {
  $: { name: string; value: string; param1?: string };
}

interface ItemsXmlClassProperty {
  $: { class: string };
  property: ItemsXmlValueProperty[];
  // requirement
}

function isValueProperty(value: ItemsXmlProperty): value is ItemsXmlValueProperty {
  return 'name' in value.$;
}

type ItemName = string;

export interface Item {
  name: ItemName;
  properties: ItemProperties;
  tags?: string[];
  parentItem?: Item;
  excludedPropNames?: string[];
}

export interface ItemProperties {
  [name: string]: ItemPropertyValue;
}

export interface ItemPropertyValue {
  value: string;
  param1?: string;
}

export class Items {
  constructor(public items: Item[]) {}

  static async loadFromXml(itemsXmlFileName: string): Promise<Items> {
    const itemsXml = await parseXml<ItemsXmlRoot>(itemsXmlFileName);
    const items = itemsXml.items.item.map<Item>(({ $, property }) => {
      const properties = Object.fromEntries(new Map(property.filter(isValueProperty).map(({ $ }) => [$.name, $])));
      return { name: $.name, properties, tags: properties.Tags?.value.split(',').map((p) => p.trim()) ?? [] };
    });
    const itemsMap = new Map<ItemName, Item>(items.map((x) => [x.name, x]));
    for (const item of items.values()) {
      const extendsProp = item.properties.Extends;
      if (extendsProp) {
        item.excludedPropNames = extendsProp.param1?.split(',').map((p) => p.trim()) ?? [];
        item.parentItem = itemsMap.get(extendsProp.value?.trim());
        if (!item.parentItem) {
          console.warn('Unknown parent item: %d', extendsProp.value);
        }
      }
    }
    return new Items(Array.from(items.values()));
  }

  hasTag(tag: string): Items {
    return new Items(this.items.filter(({ tags }) => tags?.includes(tag)));
  }

  statTags(): Map<string, number> {
    const stats = new Map<string, number>();
    this.items
      .flatMap(({ properties }) => properties?.Tags.value?.split(',') ?? [])
      .forEach((tag) => {
        stats.set(tag.trim(), (stats.get(tag) ?? 0) + 1);
      });
    return stats;
  }

  find(predicate: (item: Item) => boolean): Item[] {
    return this.items
      .filter((b) => {
        const creativeMode = this.getPropertyExtended(b, 'CreativeMode')?.value;
        return !creativeMode || creativeMode !== 'None';
      })
      .filter((b) => predicate(b));
  }

  private getPropertyExtended(item: Item, propertyName: string): ItemPropertyValue | null {
    const prop = item.properties[propertyName];
    if (prop) return prop;
    const { parentItem, excludedPropNames } = item;
    if (parentItem && !(excludedPropNames ?? []).includes(propertyName)) {
      return this.getPropertyExtended(parentItem, propertyName);
    } else {
      return null;
    }
  }
}
