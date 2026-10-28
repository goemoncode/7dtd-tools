import { ByteReader } from './ByteReader.ts';

export type BlockId = number;
export type BlockIdNames = Map<BlockId, string>;

// ".blocks.nim" format (Its just my guess, refered to no docs.)
// * Header part
// 1-4: (uint32) file format version?
// 5-8: (uint32) the number of block types `blockNum`
// * Body part: repeated each block ID-Name definisions
// 1-4: (uint32) block ID for a tts file
// 5:   (uint8) the number of chars of the block name
// 6-:  (string) block name
export async function parseNim(nimFileName: string): Promise<BlockIdNames> {
  const file = await Deno.open(nimFileName);
  const reader = new ByteReader(file.readable);
  let version: number;
  const blocks: BlockIdNames = new Map();
  try {
    version = new DataView((await reader.read(4)).buffer).getUint32(0, true);
    const idsNum = new DataView((await reader.read(4)).buffer).getUint32(0, true);
    for (let i = 0; i < idsNum; i++) {
      const id = new DataView((await reader.read(4)).buffer).getUint32(0, true);
      const nameLength = (await reader.read(1))[0];
      const name = new TextDecoder().decode(await reader.read(nameLength));
      blocks.set(id, name);
    }
  } finally {
    reader.close();
    file.close();
  }

  if (version !== 1) throw Error(`Unexpected version: filename=${nimFileName} version=${version}`);

  return blocks;
}
