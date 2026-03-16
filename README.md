# Azgaar Map Loader (Obsidian Plugin)
This is a plugin created to integrate [Azgaar's Fantasy Map Generator](https://github.com/Azgaar/Fantasy-Map-Generator) directly into obsidian.

It allows to open Azgaar's Fantasy Map Generator from Obsidian and load local `.map` files from your vault.

## Features

- Open Azgaar in an Obsidian modal
- Embed Azgaar directly inside notes via `azgaar` code blocks
- Pick `.map` files from your vault
- Inject selected file into Azgaar's load input automatically (desktop)

## Commands

- `Azgaar: Open map generator` : Opens a modal with the Fantasy Map Generator app. Kinda useless, but could be neat.
- `Azgaar: Open generator and load .map from vault` Opens a modal with the Fantasy Map Generator app, and lets you pick a file to open. Good for previews.
- `Azgaar: Insert Azgaar block into current page` Adds a block with the full Fantasy Map Generator app into it. Certain parameters can be added to modify load behavior.

## Note Block

Insert this in a note:

```azgaar
mode: latest
height: 720
```
`mode:latest` makes it so that the app instance loads the most recent `.map` found in the same folder as the `.md` file. Great for always opening the latest file for a region.

Optional explicit file:

```azgaar
map: World/maps/my-map.map
```

## Install into Obsidian vault

Copy these files to your vault plugin folder:

- `main.js`
- `manifest.json`
- `styles.css`

Path example:

`<Vault>/.obsidian/plugins/obsidian-azgaar-loader/`
