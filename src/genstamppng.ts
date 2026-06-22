import { basename, extname, join } from 'node:path';
import { glob } from 'glob';
import { handleMain } from './utils';
import { Stamp } from './utils/parseRaw';

handleMain(async ({ gameDataDir }) => {
  const inputDir = join(gameDataDir, 'Stamps');
  const outputDir = join('public', 'Stamps');
  const globPattern = join(inputDir, '*.raw');
  const rawFiles = await glob(globPattern, { windowsPathsNoEscape: true });
  await Promise.all(rawFiles.map((file) => main(file, outputDir)));
});

async function main(srcFileName: string, outputDir: string) {
  const raw = await Stamp.load(srcFileName);
  const dstFileName = join(outputDir, basename(srcFileName, extname(srcFileName)) + '.png');
  await raw.saveAsPng(dstFileName);
}
