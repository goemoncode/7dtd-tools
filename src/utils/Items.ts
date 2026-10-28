import { parseXml } from './parseXml.ts';
import { isXmlValueProperty, type XmlProperty } from "./Xml.ts";

interface ItemsXml {
  items: {
    item: ItemXml[];
  };
}

interface ItemXml {
  $: { name: string };
  property: XmlProperty[];
  // effect_group
}

export interface Item {
  name: string;
  properties: ItemProperties;
  tags?: string[];
  extendsFrom?: Item;
  omitProps?: string[];
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
    const itemsXml = await parseXml<ItemsXml>(itemsXmlFileName);
    const items = itemsXml.items.item.map<Item>(({ $, property }) => {
      const properties = Object.fromEntries(new Map(property.filter(isXmlValueProperty).map(({ $ }) => [$.name, $])));
      return { name: $.name, properties, tags: properties.Tags?.value.split(',').map((p) => p.trim()) ?? [] };
    });
    const itemsMap = new Map<string, Item>(items.map((x) => [x.name, x]));
    for (const item of items.values()) {
      const extendsProp = item.properties.Extends;
      if (extendsProp) {
        item.extendsFrom = itemsMap.get(extendsProp.value?.trim());
        item.omitProps = extendsProp.param1?.split(',').map((p) => p.trim()) ?? [];
        if (!item.extendsFrom) {
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
    const { extendsFrom, omitProps } = item;
    if (extendsFrom && !(omitProps ?? []).includes(propertyName)) {
      return this.getPropertyExtended(extendsFrom, propertyName);
    } else {
      return null;
    }
  }
}
