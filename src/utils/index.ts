import { join } from '@std/path';
import { blue, red } from '@std/fmt/colors';
import { parse } from '@std/jsonc';
import { expandGlob } from '@std/fs/expand-glob';

export interface AppConfig {
  steamAppsGameDir: string;
  gameDataDir: string;
  gameConfigDir: string;
  gamePrefabsDir: string;
  itemsXmlPath: string;
  lootXmlPath: string;
  blocksXmlPath: string;
}

export function loadAppConfig(): AppConfig {
  const steamAppsGameDir = Deno.env.get('STEAMAPPS_GAME_DIR') ?? '';
  if (!steamAppsGameDir) throw new Error('The STEAMAPPS_GAME_DIR environment variable is not defined or is empty.');
  const gameDataDir = Deno.env.get('GAME_DATA_DIR') ?? join(steamAppsGameDir, 'Data');
  const gameConfigDir = join(gameDataDir, 'Config');
  const gamePrefabsDir = join(gameDataDir, 'Prefabs');
  return {
    steamAppsGameDir,
    gameDataDir,
    gameConfigDir,
    gamePrefabsDir,
    itemsXmlPath: join(gameConfigDir, 'items.xml'),
    lootXmlPath: join(gameConfigDir, 'loot.xml'),
    blocksXmlPath: join(gameConfigDir, 'blocks.xml'),
  };
}

export async function handleMain(main: (config: AppConfig) => Promise<void | number | undefined>) {
  try {
    const config = loadAppConfig();
    const exitCode = await main(config);
    Deno.exit(exitCode ?? 0);
  } catch (e) {
    if (e instanceof Error) console.error(red(e.toString()));
    Deno.exit(1);
  }
}

export async function fileExists(file: string) {
  try {
    await Deno.stat(file);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

export async function readJsonFile<T>(file: string) {
  const json = await Deno.readTextFile(file);
  return parse(json) as T;
}

export async function writeJsonFile(file: string, json: unknown) {
  await Deno.writeTextFile(file, JSON.stringify(json, null, '\t'));
  console.log(blue('Write %s'), file);
}

export function consoleGroup(label: string) {
  console.group(label);
  return {
    [Symbol.dispose]() {
      console.groupEnd();
    },
  };
}

export async function glob(globPattern: string) {
  const files = [];
  for await (const file of expandGlob(globPattern)) {
    files.push(file.path);
  }
  return files.sort();
}

export function parseTags(tags: string | null | undefined = '') {
  return (tags ?? '')
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}
