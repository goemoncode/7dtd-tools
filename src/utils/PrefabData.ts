import { basename, join } from '@std/path';
import { glob, parseTags } from './index.ts';
import { parsePrefabXml } from './parsePrefabXml.ts';

export async function loadPrefabData(inputDir: string): Promise<PrefabData[]> {
  const globPattern = join(inputDir, '**', '*.xml');
  const paths = await glob(globPattern);
  return await Promise.all(
    paths
      .filter((path) => !basename(path, '.xml').endsWith('_signs'))
      .map(async (path) => {
        const prefabName = basename(path, '.xml');
        const rawProps = await parsePrefabXml(path);
        const props = new Map(rawProps.map(({ name, value }) => [name, value]));
        return new PrefabData(prefabName, props);
      }),
  );
}

export class PrefabData {
  #props: Map<string, string>;
  public label: string = '';
  public size: Vector3Int;
  public tags: Tags;
  #tier: number;
  #themeTags: Tags;
  #questTags: Tags;
  #isTile: boolean = false;
  #poiSpawns: POISpawn[] = [];

  constructor(
    public name: string,
    props: Map<string, string>,
  ) {
    this.#props = props;
    this.size = Vector3Int.parse(props.get('PrefabSize'));
    this.tags = new Tags(props.get('Tags'));
    this.#tier = Number(props.get('DifficultyTier') ?? 0);
    this.#themeTags = new Tags(props.get('ThemeTags'));
    this.#questTags = new Tags(props.get('QuestTags'));
    this.#isTile = this.tags.matchAny('streettile') || this.name.startsWith('rwg_tile_');
    if (this.#isTile) {
      const rawMarkerType = props.get('POIMarkerType');
      const rawMarkerSize = props.get('POIMarkerSize');
      const rawMarkerTags = props.get('POIMarkerTags');
      if (rawMarkerType && rawMarkerSize) {
        const markerType = rawMarkerType.split(',').map((s) => s.trim());
        const markerSize = rawMarkerSize.split('#').map((s) => s.trim());
        const markerTags = rawMarkerTags?.split('#').map((s) => s.trim()) ?? [];
        const len = markerType.length;
        if (markerSize.length == len) {
          for (let i = 0; i < len; i++) {
            const type = markerType[i];
            if (type !== 'POISpawn') continue;
            const size = Vector3Int.parse(markerSize[i]);
            const tags = new Tags(markerTags[i]);
            this.#poiSpawns.push(new POISpawn(size, tags));
          }
        }
      }
    }
  }

  get props() {
    return this.#props;
  }
  get tier() {
    return this.#tier;
  }
  get themeTags() {
    return this.#themeTags;
  }
  get questTags() {
    return this.#questTags;
  }
  get isTile() {
    return this.#isTile;
  }
  get poiSpawns() {
    return this.#poiSpawns;
  }

  public getPropString(key: string): string | string[] | undefined {
    const value = key in this ? Reflect.get(this, key) : this.#props.get(key);
    if (value === null || value === undefined) return undefined;
    if (isRecord(value) && Array.isArray(value.tags)) {
      return value.tags.map((item) => String(item));
    } else if (Array.isArray(value)) {
      return value.map((item) => String(item));
    }
    return String(value);
  }

  public toDict(keys: (keyof this | string)[] = []) {
    const props = Object.fromEntries(
      keys.map((key) => {
        const classValue = key in this ? Reflect.get(this, key) : undefined;
        const propsValue = this.props?.get(key as string);
        return [key, classValue ?? propsValue];
      }),
    );
    return { ...this, ...props };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export class POISpawn {
  constructor(
    public size: Vector3Int,
    public tags: Tags,
  ) {}
}

export class Tags {
  public readonly tags: string[] = [];

  constructor(tags?: string | string[]) {
    if (!tags) {
      this.tags = [];
    } else if (Array.isArray(tags)) {
      this.tags = tags.map((tag) => tag.trim()).filter(Boolean);
    } else {
      this.tags = parseTags(tags);
    }
  }

  get isEmpty(): boolean {
    return this.tags.length === 0;
  }

  private toTargetArray(other: Tags | string[] | string): string[] {
    if (other instanceof Tags) return other.tags;
    if (Array.isArray(other)) return other;
    return parseTags(other);
  }

  matchAny(other: Tags | string[] | string): boolean {
    const target = this.toTargetArray(other);
    return target.some((tag) => this.tags.includes(tag));
  }

  matchAll(other: Tags | string[] | string): boolean {
    const target = this.toTargetArray(other);
    return target.every((tag) => this.tags.includes(tag));
  }

  toString(): string {
    return this.tags.join(',');
  }

  // [Symbol.for('Deno.customInspect')](inspect: (v: unknown) => string): string {
  //   return inspect(this.tags);
  // }
}

export interface ParseOptions {
  throwsOnError?: boolean;
}

export class Vector2Int {
  static parse(value: string | null | undefined, options?: ParseOptions): Vector2Int {
    const throwsOnError = options?.throwsOnError ?? false;
    const defaultVector = new Vector2Int();
    if (!value) return defaultVector;
    const parts = value.split(',');
    if (parts.length !== 2) {
      if (throwsOnError) {
        throw new Error(`Invalid format: ${value}. Expected "x,y"`);
      }
      return defaultVector;
    }
    const [x, y] = parts.map((x) => parseInt(x, 10));
    if (isNaN(x) || isNaN(y)) {
      if (throwsOnError) {
        throw new Error(`Failed to parse numbers from: ${value}`);
      }
      return defaultVector;
    }
    return new Vector2Int(x, y);
  }

  constructor(
    public x: number = 0,
    public y: number = 0,
  ) {}

  get isZero(): boolean {
    return this.x === 0 && this.y === 0;
  }

  equals(other: Vector2Int): boolean {
    return this.x === other.x && this.y === other.y;
  }

  toString(): string {
    return `${this.x},${this.y}`;
  }
}

export class Vector3Int {
  static parse(value: string | null | undefined, options?: ParseOptions): Vector3Int {
    const throwsOnError = options?.throwsOnError ?? false;
    const defaultVector = new Vector3Int();
    if (!value) return defaultVector;
    const parts = value.split(',').map((s) => s.trim());
    if (parts.length !== 3) {
      if (throwsOnError) {
        throw new Error(`Invalid format: ${value}. Expected "x,y,z"`);
      }
      return defaultVector;
    }
    const [x, y, z] = parts.map((x) => parseInt(x, 10));
    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      if (throwsOnError) {
        throw new Error(`Failed to parse numbers from: ${value}`);
      }
      return defaultVector;
    }
    return new Vector3Int(x, y, z);
  }

  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0,
  ) {}

  get isZero(): boolean {
    return this.x === 0 && this.y === 0 && this.z === 0;
  }

  equals(other: Vector3Int): boolean {
    return this.x === other.x && this.y === other.y && this.z === other.z;
  }

  toString(): string {
    return `${this.x},${this.y},${this.z}`;
  }
}
