# Data Tools for 7dtd-map

This project provides several scripts that generate prefab data files for 7 Days to Die Map renderer.

In addition, the prefab data files with version α21 have already been generated and included in the project and are published at the following website.

- https://goemoncode-7dtd-tools.onrender.com/

## Before run script

Set 7dtd game folder to the STEAMAPPS_GAME_DIR environment variable, or create .env.local in the project root and set.

```bash
STEAMAPPS_GAME_DIR="<path to 7dtd game folder>"
```

## Run script

```
npm run run-ts <script file name> [args...] [options]

  or

yarn run-ts <script file name> [args...] [options]
```
