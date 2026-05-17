
import {
  Editor,
  MarkdownPostProcessorContext,
  Notice,
  Plugin,
  TFile
} from "obsidian";
import { MapFileSuggestModal } from "./classes/MapFileSuggestModal";
import { AzgaarModal } from "./classes/AzgaarModal";
import { AzgaarSettingTab } from "./classes/AzgaarSettingTab";

import type { AzgaarLoaderSettings, PendingMapFile, WebviewLike } from "./classes/interfaces";
import { arrayBufferToBase64, buildMapInjectionScript, buildMapExportScript, normalizeAzgaarUrl, base64ToArrayBuffer, parseAzgaarBlockOptions, findLatestMapInNoteFolder, getAvailableMapPath, getFolderPathFromSourcePath, sanitizeMapFileName } from "./classes/utils";

export const DEFAULT_SETTINGS: AzgaarLoaderSettings = {
  azgaarUrl: "https://azgaar.github.io/Fantasy-Map-Generator/"
};



export default class AzgaarLoaderPlugin extends Plugin {
  settings: AzgaarLoaderSettings = DEFAULT_SETTINGS;


  async onload(): Promise<void> {
    // Load settings and initialize plugin features
    await this.loadSettings();
    // Add ribbon icon and commands for user interaction
    this.addRibbonIcon("globe", "Open Azgaar map generator", () => {
      this.openAzgaarModal();
    });
    // Command to open generator and immediately pick a map file
    this.addCommand({
      id: "open-azgaar-generator",
      name: "Open map generator",
      callback: () => this.openAzgaarModal()
    });
    // Command to open generator and load a .map file from the vault
    this.addCommand({
      id: "open-and-load-map",
      name: "Open generator and load .map from vault",
      callback: () => this.openAndPickMap()
    });

    this.addCommand({
      id: "insert-azgaar-embed",
      name: "Insert Azgaar block into current page",
      editorCallback: (editor) => this.insertAzgaarEmbed(editor)
    });

    this.registerMarkdownCodeBlockProcessor("azgaar", (source, el, ctx) => {
      this.renderAzgaarBlock(source, el, ctx);
    });

    this.addSettingTab(new AzgaarSettingTab(this.app, this));
  }

  onunload(): void {
    // No persistent resources to clean up.
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.azgaarUrl = normalizeAzgaarUrl(this.settings.azgaarUrl);
    await this.saveSettings();
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  openAzgaarModal(): AzgaarModal {
    const modal = new AzgaarModal(this.app, this);
    modal.open();
    return modal;
  }

  openAndPickMap(): void {
    const modal = this.openAzgaarModal();
    this.openMapPicker(modal);
  }

  openMapPicker(modal: AzgaarModal): void {
    this.openMapPickerWithCallback(async (file) => {
      await modal.queueMapFile(file);
    });
  }

  private openMapPickerWithCallback(onChoose: (file: TFile) => Promise<void> | void): void {
    const files = this.app.vault.getFiles().filter((file) => file.extension.toLowerCase() === "map");

    if (files.length === 0) {
      new Notice("No .map files found in this vault.");
      return;
    }

    new MapFileSuggestModal(this.app, async (file) => {
      await onChoose(file);
    }).open();
  }

  private insertAzgaarEmbed(editor: Editor): void {
    const snippet = ["```azgaar", "mode: latest", "height: 720", "```"].join("\n");
    editor.replaceSelection(snippet);
    new Notice("Inserted an inline Azgaar block into the current note.");
  }

  private renderAzgaarBlock(
    source: string,
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): void {
    el.empty();
    el.addClass("azgaar-loader-inline");

    const sourcePath = ctx.sourcePath;
    const options = parseAzgaarBlockOptions(source);

    const controls = el.createDiv({ cls: "azgaar-loader-controls" });
    controls.createDiv({ cls: "azgaar-loader-hint", text: "Azgaar inline view" });

    const loadDefaultBtn = controls.createEl("button", {
      text: options.mapPath ? "Load configured map" : "Load latest map in this folder"
    });
    const pickMapBtn = controls.createEl("button", { text: "Pick .map from vault" });
    const saveCurrentFolderBtn = controls.createEl("button", { text: "Save .map to this folder" });

    const webview = document.createElement("webview") as WebviewLike;
    webview.className = "azgaar-loader-webview azgaar-loader-webview-inline";
    webview.style.height = `${options.height}px`;
    webview.setAttribute("partition", "persist:obsidian-azgaar-loader");
    webview.setAttribute("allowpopups", "true");
    webview.setAttribute("src", this.settings.azgaarUrl);
    el.appendChild(webview);

    let webviewReady = false;
    const pendingFiles: PendingMapFile[] = [];

    const queueMapFile = async (file: TFile, notifyQueued: boolean): Promise<void> => {
      const data = await this.app.vault.readBinary(file);
      const base64 = arrayBufferToBase64(data);

      pendingFiles.push({ fileName: file.name, base64 });
      if (!webviewReady) {
        if (notifyQueued) {
          new Notice(`Queued ${file.name}. It will load once Azgaar is ready.`);
        }
        return;
      }
      await flushPendingFiles();
    };

    const flushPendingFiles = async (): Promise<void> => {
      if (typeof webview.executeJavaScript !== "function") {
        if (pendingFiles.length > 0) {
          new Notice("Cannot inject file automatically in this embed mode.");
        }
        return;
      }

      while (pendingFiles.length > 0) {
        const next = pendingFiles.shift();
        if (!next) continue;

        try {
          const script = buildMapInjectionScript(next.fileName, next.base64);
          const result = await webview.executeJavaScript(script, true);
          if (result === true) {
            new Notice(`Loaded ${next.fileName} into Azgaar.`);
          } else {
            new Notice(`Could not auto-load ${next.fileName}. Use Azgaar's Load button if needed.`);
          }
        } catch (error) {
          console.error("[azgaar-loader] inline injection failed", error);
          new Notice(`Injection failed for ${next.fileName}.`);
        }
      }
    };

    const resolveDefaultMap = (): TFile | null => {
      if (options.mapPath) {
        const file = this.app.vault.getAbstractFileByPath(options.mapPath);
        return file instanceof TFile && file.extension.toLowerCase() === "map" ? file : null;
      }
      return findLatestMapInNoteFolder(this.app, sourcePath);
    };

    loadDefaultBtn.addEventListener("click", async () => {
      const file = resolveDefaultMap();
      if (!file) {
        new Notice("No matching .map file found for this block.");
        return;
      }
      await queueMapFile(file, true);
    });

    pickMapBtn.addEventListener("click", () => {
      this.openMapPickerWithCallback(async (file) => {
        await queueMapFile(file, true);
      });
    });

    saveCurrentFolderBtn.addEventListener("click", async () => {
      await this.saveMapFromWebviewToSourceFolder(webview, sourcePath);
    });

    webview.addEventListener("dom-ready", async () => {
      webviewReady = true;
      await flushPendingFiles();

      if (options.mode === "latest" || options.mapPath) {
        const file = resolveDefaultMap();
        if (file) {
          await queueMapFile(file, false);
        }
      }
    });
  }

  private async saveMapFromWebviewToSourceFolder(
    webview: WebviewLike,
    sourcePath: string
  ): Promise<void> {
    if (typeof webview.executeJavaScript !== "function") {
      new Notice("Inline save is unavailable in this embed mode.");
      return;
    }

    const result = (await webview.executeJavaScript(buildMapExportScript(), true)) as
      | { ok: true; fileName: string; base64: string }
      | { ok: false; error?: string }
      | undefined;

    if (!result || result.ok !== true) {
      const reason = result && "error" in result && result.error ? `: ${result.error}` : "";
      new Notice(`Could not export map from Azgaar${reason}`);
      return;
    }

    const folderPath = getFolderPathFromSourcePath(sourcePath);
    const safeName = sanitizeMapFileName(result.fileName);
    const outputPath = getAvailableMapPath(this.app, folderPath, safeName);
    const buffer = base64ToArrayBuffer(result.base64);

    await this.app.vault.createBinary(outputPath, buffer);
    new Notice(`Saved ${safeName} to ${folderPath || "vault root"}.`);
  }



}
