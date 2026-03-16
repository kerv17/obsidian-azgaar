# Azgaar Map Loader (Obsidian Plugin)

Open Azgaar's Fantasy Map Generator from Obsidian and load local `.map` files from your vault.

## Features

- Open Azgaar in an Obsidian modal
- Embed Azgaar directly inside notes via `azgaar` code blocks
- Pick `.map` files from your vault
- Save exported `.map` files directly into the current note folder
- Inject selected file into Azgaar's load input automatically (desktop)

## Commands

- `Azgaar: Open map generator`
- `Azgaar: Open generator and load .map from vault`
- `Azgaar: Insert Azgaar block into current page`

## Note Block

Insert this in a note:

```azgaar
mode: latest
height: 720
```

Optional explicit file:

```azgaar
map: World/maps/my-map.map
```

## Development

```bash
npm install
npm run build
```

For watch mode:

```bash
npm run dev
```

## Install into Obsidian vault

Copy these files to your vault plugin folder:

- `main.js`
- `manifest.json`
- `styles.css`

Path example:

`<Vault>/.obsidian/plugins/obsidian-azgaar-loader/`
