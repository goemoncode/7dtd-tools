import { join, relative } from '@std/path';
import { glob, writeJsonFile } from './index.ts';

export interface DataManifest {
  schemaVersion: number;
  dataVersion: string;
  files: Record<string, string>;
}

export async function writeDataManifest(outputDir: string): Promise<DataManifest> {
  const manifestPath = join(outputDir, 'manifest.json');
  const jsonFiles = (await glob(join(outputDir, '**', '*.json'))).filter(
    (file) => relative(outputDir, file).replaceAll('\\', '/') !== 'manifest.json',
  );
  const files = Object.fromEntries(
    await Promise.all(
      jsonFiles.map(async (file) => {
        const path = relative(outputDir, file).replaceAll('\\', '/');
        return [path, await sha256(await Deno.readFile(file))] as const;
      }),
    ),
  );
  const dataVersion = `sha256-${await sha256(new TextEncoder().encode(JSON.stringify(files)))}`;
  const manifest = { schemaVersion: 1, dataVersion, files };
  await writeJsonFile(manifestPath, manifest);
  return manifest;
}

async function sha256(data: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
