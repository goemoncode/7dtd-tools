// https://github.com/kui/7dtd-map/blob/master/tools/lib/tts-parser.ts

import { ByteReader } from './ByteReader.ts';
import type { BlockId } from './parseNim.ts';

// TTS format: https://7daystodie.gamepedia.com/Prefabs#TTS
const KNOWN_VERSIONS = [13, 15, 16, 17, 18, 19];
const BLOCK_ID_BIT_MASK = 0b0111111111111111;

export async function parseTts(ttsFileName: string): Promise<Tts> {
  const file = await Deno.open(ttsFileName);
  const reader = new ByteReader(file.readable);
  let fileFormat: string;
  let version: number;
  let dim: { x: number; y: number; z: number };
  let blockIds: Uint32Array;
  try {
    fileFormat = new TextDecoder().decode(await reader.read(4));
    version = new DataView((await reader.read(4)).buffer).getUint32(0, true);
    dim = {
      x: new DataView((await reader.read(2)).buffer).getUint16(0, true),
      y: new DataView((await reader.read(2)).buffer).getUint16(0, true),
      z: new DataView((await reader.read(2)).buffer).getUint16(0, true),
    };

    const blocksNum = dim.x * dim.y * dim.z;
    blockIds = new Uint32Array(blocksNum);
    for (let i = 0; i < blocksNum; i++) {
      const blockData = new DataView((await reader.read(4)).buffer).getInt32(0, true);
      blockIds[i] = blockData & BLOCK_ID_BIT_MASK;
    }
  } finally {
    reader.close();
    file.close();
  }

  if (fileFormat !== 'tts\x00')
    throw Error(`Unexpected file prefix: filename=${ttsFileName}, format=${fileFormat}`);
  if (!KNOWN_VERSIONS.includes(version))
    throw Error(`Unknown version: filename=${ttsFileName} version=${version}`);
  return new Tts(version, dim, blockIds);
}

export class Tts {
  version: number;
  width: number;
  height: number;
  depth: number;
  blockIds: Uint32Array;
  blockNums: Map<BlockId, number>;

  constructor(version: number, dim: { x: number; y: number; z: number }, blockIds: Uint32Array) {
    this.version = version;
    this.width = dim.x;
    this.height = dim.y;
    this.depth = dim.z;
    this.blockIds = blockIds;
    this.blockNums = countBlocks(blockIds);
  }

  getBlockId(x: number, y: number, z: number): BlockId {
    if (x < 0 || this.width < x || y < 0 || this.height < y || z < 0 || this.depth < z) {
      throw Error(
        `Out of index range: x=${x}, y=${y}, z=${z}, maxValues=${this.width},${this.height},${this.depth}`
      );
    }
    return this.blockIds[x + this.width * y + this.width * this.height * z];
  }
}

function countBlocks(ids: Uint32Array) {
  return ids.reduce<Map<number, number>>((map, id) => {
    map.set(id, (map.get(id) ?? 0) + 1);
    return map;
  }, new Map());
}
