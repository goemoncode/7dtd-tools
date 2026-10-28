# Data Tools for 7dtd-map

This project provides several scripts that generate prefab data files for 7 Days to Die Map renderer.

In addition, the prefab data files with version 3.0 have already been generated and included in the project and are published at the following website.

- https://goemoncode-7dtd-tools.onrender.com/

## Requirements

- Deno 2
- The 7 Days to Die game files

Set the `STEAMAPPS_GAME_DIR` environment variable or create `.env.local` in the project root:

```env
STEAMAPPS_GAME_DIR="<path to 7dtd game folder>"
```

## Generate prefab data files for vanilla

```sh
deno task prebuild
deno task genl10n
deno task genindex
```

## Development server

```sh
deno task dev
```

The server binds to `127.0.0.1:3000`. Set the `PORT` environment variable to use a different port.

## Credits

- Inspired by the original logic of [kui/7dtd-map](https://github.com/kui/7dtd-map).
