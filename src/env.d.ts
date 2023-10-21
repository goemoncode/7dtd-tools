/// <reference types="node" />

declare module 'process' {
  global {
    namespace NodeJS {
      interface ProcessEnv {
        STEAMAPPS_GAME_DIR?: string;
      }
    }
  }
}
