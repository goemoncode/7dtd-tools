import { basename, dirname, extname, join } from 'node:path';
import { statSync } from 'node:fs';
import { program } from 'commander';
import { red } from 'ansi-colors';
import { handleMain } from './utils';
import { DTM } from './utils/parseRaw';

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
  const dtm = await DTM.load(srcFileName);
  const dstFileName = join(dirname(srcFileName), basename(srcFileName, extname(srcFileName)) + '.png');
  await dtm.saveAsPng(dstFileName);
  const srcSize = statSync(srcFileName).size;
  const dstSize = statSync(dstFileName).size;
  console.log('Compress: %d (%d / %d)', (dstSize / srcSize) * 100, dstSize, srcSize);
}
