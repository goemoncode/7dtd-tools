import { join } from 'node:path';
import { blue, red } from 'ansi-colors';
import { readFile, writeFile } from 'node:fs/promises';
import JSON5 from 'json5';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export interface AppConfig {
  steamAppsGameDir: string;
  gameConfigDir: string;
}

export async function loadAppConfig(): Promise<AppConfig> {
  const { STEAMAPPS_GAME_DIR = '' } = process.env;
  if (!STEAMAPPS_GAME_DIR) throw new Error('The STEAMAPPS_GAME_DIR environment variable is not defined or is empty.');
  return { steamAppsGameDir: STEAMAPPS_GAME_DIR, gameConfigDir: join(STEAMAPPS_GAME_DIR, 'Data', 'Config') };
}

export async function handleMain(main: (config: AppConfig) => Promise<void | number | undefined>) {
  try {
    const config = await loadAppConfig();
    const exitCode = await main(config);
    process.exit(exitCode ?? 0);
  } catch (e) {
    if (e instanceof Error) console.error(red(e.toString()));
    process.exit(1);
  }
}

export async function readJsonFile<T>(file: string) {
  const json = await readFile(file, 'utf8');
  return JSON5.parse(json) as T;
}

export async function writeJsonFile(file: string, json: unknown) {
  await writeFile(file, JSON.stringify(json, null, '\t'));
  console.log(blue('Write %s'), file);
}
