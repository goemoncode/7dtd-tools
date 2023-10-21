import { basename, dirname, extname, join } from 'node:path';
import { createWriteStream, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { program } from 'commander';
import { red } from 'ansi-colors';
import { PNG } from 'pngjs';
import { handleMain } from './utils';

handleMain(async () => {
  program
    .name(basename(__filename, '.ts'))
    .description('Generate dtm.png from dtm.raw')
    .argument('<input>', 'The path to dtm.raw')
    .configureOutput({ outputError: (str, write) => write(red(str)) })
    .showHelpAfterError()
    .parse();
  await main(program.args[0]);
});

async function main(srcFileName: string) {
  const raw = await readFile(srcFileName);
  if (raw.length % 2 !== 0) throw Error(`Invalid raw data format: dataLength=${raw.length}`);
  const size = Math.sqrt(raw.length / 2);
  if (!Number.isSafeInteger(size)) throw Error(`Invalid raw data or size: dataLength=${raw.length} size=${size}`);
  console.log({ size });

  const png = new PNG({
    width: size,
    height: size,
    colorType: 4, // grayscale & alpha
  });
  for (let i = 0; i < raw.length; i += 2) {
    // raw[i] Sub height
    // raw[i + 1] Height
    png.data[i * 2] = raw[i + 1];
    png.data[i * 2 + 1] = raw[i + 1];
    png.data[i * 2 + 2] = raw[i + 1];
    png.data[i * 2 + 3] = raw[i];
  }

  const dstFileName = join(dirname(srcFileName), basename(srcFileName, extname(srcFileName)) + '.png');
  await new Promise((resolve, reject) => {
    png.pack().pipe(createWriteStream(dstFileName)).on('finish', resolve).on('error', reject);
  });

  const srcSize = statSync(srcFileName).size;
  const dstSize = statSync(dstFileName).size;
  console.log('Compress: %d (%d / %d)', (dstSize / srcSize) * 100, dstSize, srcSize);
}
