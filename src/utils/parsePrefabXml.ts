import { parseXml } from './parseXml.ts';
import type { XmlProperty } from "./Xml.ts";

interface PrefabXml {
  prefab: {
    property: XmlProperty[];
  };
}

export interface PrefabProperty {
  name: string;
  value: string;
}

export async function parsePrefabXml(xmlFileName: string): Promise<PrefabProperty[]> {
  try {
    const prefabXml = await parseXml<PrefabXml>(xmlFileName);
    return prefabXml.prefab.property.flatMap((p) => {
      if ('name' in p.$) return p.$;
      else return [];
    });
  } catch (e: unknown) {
    console.error(`Cannot read ${xmlFileName}: ${e}`);
    return [];
    // throw e;
  }
}
