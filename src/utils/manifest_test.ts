import { join } from '@std/path';
import { writeDataManifest } from './manifest.ts';

Deno.test('writeDataManifest creates a deterministic manifest for JSON files', async () => {
  const outputDir = await Deno.makeTempDir();
  try {
    await Deno.mkdir(join(outputDir, 'l10n'));
    await Deno.writeTextFile(join(outputDir, 'index.json'), '[]');
    await Deno.writeTextFile(join(outputDir, 'l10n', 'english.json'), '{}');

    const first = await writeDataManifest(outputDir);
    const second = await writeDataManifest(outputDir);

    assert(JSON.stringify(first) === JSON.stringify(second), 'identical data should produce the same manifest');
    assert(JSON.stringify(Object.keys(first.files)) === JSON.stringify(['index.json', 'l10n/english.json']), 'JSON paths should be listed');
    assert(first.schemaVersion === 1, 'manifest schema version should be 1');
    assert(first.dataVersion.startsWith('sha256-'), 'data version should use the SHA-256 prefix');

    await Deno.writeTextFile(join(outputDir, 'index.json'), '[1]');
    const changed = await writeDataManifest(outputDir);
    assert(changed.dataVersion !== first.dataVersion, 'changing file contents should change the data version');
  } finally {
    await Deno.remove(outputDir, { recursive: true });
  }
});

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}
