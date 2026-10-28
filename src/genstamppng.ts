import { basename, extname, join } from '@std/path';
import { glob, handleMain } from './utils/index.ts';
import { Stamp } from './utils/parseRaw.ts';

handleMain(async ({ gameDataDir }) => {
  const inputDir = join(gameDataDir, 'Stamps');
  const outputDir = join('public', 'Stamps');
  const globPattern = join(inputDir, '*.raw');
  const rawFiles = await glob(globPattern);
  await Promise.all(rawFiles.map((file) => main(file, outputDir)));
});

async function main(srcFileName: string, outputDir: string) {
  const raw = await Stamp.load(srcFileName);
  const dstFileName = join(outputDir, basename(srcFileName, extname(srcFileName)) + '.png');
  await raw.saveAsPng(dstFileName);
}
