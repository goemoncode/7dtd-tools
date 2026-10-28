import { basename, dirname, extname, join } from '@std/path';
import { program } from 'commander';
import { red } from '@std/fmt/colors';;
import { handleMain } from './utils/index.ts';
import { DTM } from './utils/parseRaw.ts';

handleMain(async () => {
  program
    .name(basename(import.meta.filename!, '.ts'))
    .description('Generate dtm.png from dtm.raw')
    .argument('<input>', 'The path to dtm.raw')
    .configureOutput({ outputError: (str, write) => write(red(str)) })
    .showHelpAfterError()
    .parse();
  await main(program.args[0]);
});

async function main(srcFileName: string) {
  const dtm = await DTM.load(srcFileName);
  const dstFileName = join(dirname(srcFileName), basename(srcFileName, extname(srcFileName)) + '.png');
  await dtm.saveAsPng(dstFileName);
  const srcSize = (await Deno.stat(srcFileName)).size;
  const dstSize = (await Deno.stat(dstFileName)).size;
  console.log('Compress: %d (%d / %d)', (dstSize / srcSize) * 100, dstSize, srcSize);
}
