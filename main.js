"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => AzgaarLoaderPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  azgaarUrl: "https://azgaar.github.io/Fantasy-Map-Generator/"
};
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
function buildMapInjectionScript(fileName, base64) {
  return `(() => {
    const fileName = ${JSON.stringify(fileName)};
    const base64 = ${JSON.stringify(base64)};

    const decodeBase64 = (b64) => {
      const raw = atob(b64);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      return bytes;
    };

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const createMapFile = () => {
      const bytes = decodeBase64(base64);
      return new File([bytes], fileName, { type: "application/octet-stream" });
    };

    const findMapInput = () => {
      const selectors = [
        '#fileToLoad',
        '#mapToLoad',
        'input[type="file"][accept*=".map"]'
      ];

      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el instanceof HTMLInputElement && el.type === 'file') return el;
      }
      return null;
    };

    const injectViaInput = (input, file) => {
      const dt = new DataTransfer();
      dt.items.add(file);

      try {
        input.files = dt.files;
      } catch (_) {
        Object.defineProperty(input, 'files', {
          configurable: true,
          value: dt.files
        });
      }

      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));

      if (typeof input.onchange === 'function') {
        try {
          input.onchange(new Event('change', { bubbles: true }));
        } catch (_) {}
      }
    };

    return (async () => {
      const file = createMapFile();

      for (let i = 0; i < 40; i++) {
        const input = findMapInput();
        if (input) {
          injectViaInput(input, file);
          return true;
        }
        await wait(250);
      }

      return false;
    })();
  })();`;
}
function buildMapExportScript() {
  return `(() => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    const originalAnchorClick = HTMLAnchorElement.prototype.click;
    const objectUrls = new Set();

    URL.createObjectURL = function(obj) {
      const url = originalCreateObjectURL(obj);
      if (obj instanceof Blob) objectUrls.add(url);
      return url;
    };

    let capturedHref = null;
    let capturedName = null;

    HTMLAnchorElement.prototype.click = function(...args) {
      try {
        if (this.download && this.href && objectUrls.has(this.href)) {
          capturedHref = this.href;
          capturedName = this.download;
        }
      } catch (_) {}
      return originalAnchorClick.apply(this, args);
    };

    const toBase64 = (buffer) => {
      const bytes = new Uint8Array(buffer);
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      return btoa(binary);
    };

    const triggerMapSave = () => {
      if (typeof window.saveMap === "function") {
        window.saveMap();
        return true;
      }

      const saveDropdown = document.querySelector("#saveDropdown");
      if (saveDropdown && saveDropdown instanceof HTMLElement) {
        saveDropdown.style.display = "block";
      }

      const selectors = [
        "#saveMap",
        '[id*="save"][id*="Map"]',
        'button[title*=".map"]',
        'div[title*=".map"]'
      ];

      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el instanceof HTMLElement) {
          el.click();
          return true;
        }
      }

      return false;
    };

    return (async () => {
      try {
        const triggered = triggerMapSave();
        if (!triggered) {
          return { ok: false, error: "Could not trigger map save action in Azgaar" };
        }

        for (let i = 0; i < 30; i++) {
          if (capturedHref) break;
          await wait(100);
        }

        if (!capturedHref) {
          return { ok: false, error: "Save action did not produce a downloadable file" };
        }

        const response = await fetch(capturedHref);
        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();
        return {
          ok: true,
          fileName: capturedName || ("fantasy_map_" + Date.now() + ".map"),
          base64: toBase64(buffer)
        };
      } catch (error) {
        return { ok: false, error: String(error) };
      } finally {
        URL.createObjectURL = originalCreateObjectURL;
        HTMLAnchorElement.prototype.click = originalAnchorClick;
      }
    })();
  })();`;
}
var MapFileSuggestModal = class extends import_obsidian.FuzzySuggestModal {
  constructor(app, onChoose) {
    super(app);
    this.onChoose = onChoose;
    this.files = app.vault.getFiles().filter((file) => file.extension.toLowerCase() === "map");
    this.setPlaceholder("Select a .map file from your vault...");
  }
  getItems() {
    return this.files;
  }
  getItemText(item) {
    return item.path;
  }
  onChooseItem(item) {
    this.onChoose(item);
  }
};
var AzgaarModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.webview = null;
    this.fallbackFrame = null;
    this.pendingFiles = [];
    this.webviewReady = false;
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    this.setTitle("Azgaar Fantasy Map Generator");
    const controls = contentEl.createDiv({ cls: "azgaar-loader-controls" });
    const pickBtn = controls.createEl("button", {
      text: "Load .map from vault"
    });
    pickBtn.addEventListener("click", () => {
      this.plugin.openMapPicker(this);
    });
    controls.createDiv({
      cls: "azgaar-loader-hint",
      text: "Select a .map file to inject it into Azgaar's load dialog."
    });
    const webview = document.createElement("webview");
    webview.className = "azgaar-loader-webview";
    webview.setAttribute("partition", "persist:obsidian-azgaar-loader");
    webview.setAttribute("allowpopups", "true");
    webview.setAttribute("src", this.plugin.settings.azgaarUrl);
    contentEl.appendChild(webview);
    this.webview = webview;
    webview.addEventListener("dom-ready", () => {
      this.webviewReady = true;
      void this.flushPendingFiles();
    });
    window.setTimeout(() => {
      const canInject = typeof this.webview?.executeJavaScript === "function";
      if (canInject) return;
      this.webview?.remove();
      this.webview = null;
      this.fallbackFrame = contentEl.createEl("iframe", {
        cls: "azgaar-loader-iframe"
      });
      this.fallbackFrame.src = this.plugin.settings.azgaarUrl;
      new import_obsidian.Notice("Webview API unavailable. Opened Azgaar in iframe; auto file loading may not work.");
    }, 900);
  }
  async queueMapFile(file) {
    const data = await this.app.vault.readBinary(file);
    const base64 = arrayBufferToBase64(data);
    this.pendingFiles.push({
      fileName: file.name,
      base64
    });
    if (!this.webviewReady) {
      new import_obsidian.Notice(`Queued ${file.name}. It will load once Azgaar is ready.`);
      return;
    }
    await this.flushPendingFiles();
  }
  async flushPendingFiles() {
    if (!this.webview || typeof this.webview.executeJavaScript !== "function") {
      if (this.pendingFiles.length > 0) {
        new import_obsidian.Notice("Cannot inject file automatically in this embed mode.");
      }
      return;
    }
    while (this.pendingFiles.length > 0) {
      const next = this.pendingFiles.shift();
      if (!next) continue;
      try {
        const script = buildMapInjectionScript(next.fileName, next.base64);
        const result = await this.webview.executeJavaScript(script, true);
        if (result === true) {
          new import_obsidian.Notice(`Loaded ${next.fileName} into Azgaar.`);
        } else {
          new import_obsidian.Notice(
            `Could not auto-load ${next.fileName}. Try Azgaar's own Load button in the embedded page.`
          );
        }
      } catch (error) {
        console.error("[azgaar-loader] injection failed", error);
        new import_obsidian.Notice(
          `Injection failed for ${next.fileName}. Use Azgaar's Load button manually if needed.`
        );
      }
    }
  }
  onClose() {
    this.contentEl.empty();
    this.webview = null;
    this.fallbackFrame = null;
    this.pendingFiles.length = 0;
    this.webviewReady = false;
  }
};
var AzgaarSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("Azgaar URL").setDesc("Change if you want to point to another hosted version.").addText(
      (text) => text.setPlaceholder("https://azgaar.github.io/Fantasy-Map-Generator/").setValue(this.plugin.settings.azgaarUrl).onChange(async (value) => {
        this.plugin.settings.azgaarUrl = this.plugin.normalizeAzgaarUrl(value);
        text.setValue(this.plugin.settings.azgaarUrl);
        await this.plugin.saveSettings();
      })
    );
  }
};
var AzgaarLoaderPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.addRibbonIcon("globe", "Open Azgaar map generator", () => {
      this.openAzgaarModal();
    });
    this.addCommand({
      id: "open-azgaar-generator",
      name: "Open map generator",
      callback: () => this.openAzgaarModal()
    });
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
  onunload() {
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.azgaarUrl = this.normalizeAzgaarUrl(this.settings.azgaarUrl);
    await this.saveSettings();
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  openAzgaarModal() {
    const modal = new AzgaarModal(this.app, this);
    modal.open();
    return modal;
  }
  openAndPickMap() {
    const modal = this.openAzgaarModal();
    this.openMapPicker(modal);
  }
  openMapPicker(modal) {
    this.openMapPickerWithCallback(async (file) => {
      await modal.queueMapFile(file);
    });
  }
  openMapPickerWithCallback(onChoose) {
    const files = this.app.vault.getFiles().filter((file) => file.extension.toLowerCase() === "map");
    if (files.length === 0) {
      new import_obsidian.Notice("No .map files found in this vault.");
      return;
    }
    new MapFileSuggestModal(this.app, async (file) => {
      await onChoose(file);
    }).open();
  }
  insertAzgaarEmbed(editor) {
    const snippet = ["```azgaar", "mode: latest", "height: 720", "```"].join("\n");
    editor.replaceSelection(snippet);
    new import_obsidian.Notice("Inserted an inline Azgaar block into the current note.");
  }
  renderAzgaarBlock(source, el, ctx) {
    el.empty();
    el.addClass("azgaar-loader-inline");
    const sourcePath = ctx.sourcePath;
    const options = this.parseAzgaarBlockOptions(source);
    const controls = el.createDiv({ cls: "azgaar-loader-controls" });
    controls.createDiv({ cls: "azgaar-loader-hint", text: "Azgaar inline view" });
    const loadDefaultBtn = controls.createEl("button", {
      text: options.mapPath ? "Load configured map" : "Load latest map in this folder"
    });
    const pickMapBtn = controls.createEl("button", { text: "Pick .map from vault" });
    const saveCurrentFolderBtn = controls.createEl("button", { text: "Save .map to this folder" });
    const webview = document.createElement("webview");
    webview.className = "azgaar-loader-webview azgaar-loader-webview-inline";
    webview.style.height = `${options.height}px`;
    webview.setAttribute("partition", "persist:obsidian-azgaar-loader");
    webview.setAttribute("allowpopups", "true");
    webview.setAttribute("src", this.settings.azgaarUrl);
    el.appendChild(webview);
    let webviewReady = false;
    const pendingFiles = [];
    const queueMapFile = async (file, notifyQueued) => {
      const data = await this.app.vault.readBinary(file);
      const base64 = arrayBufferToBase64(data);
      pendingFiles.push({ fileName: file.name, base64 });
      if (!webviewReady) {
        if (notifyQueued) {
          new import_obsidian.Notice(`Queued ${file.name}. It will load once Azgaar is ready.`);
        }
        return;
      }
      await flushPendingFiles();
    };
    const flushPendingFiles = async () => {
      if (typeof webview.executeJavaScript !== "function") {
        if (pendingFiles.length > 0) {
          new import_obsidian.Notice("Cannot inject file automatically in this embed mode.");
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
            new import_obsidian.Notice(`Loaded ${next.fileName} into Azgaar.`);
          } else {
            new import_obsidian.Notice(`Could not auto-load ${next.fileName}. Use Azgaar's Load button if needed.`);
          }
        } catch (error) {
          console.error("[azgaar-loader] inline injection failed", error);
          new import_obsidian.Notice(`Injection failed for ${next.fileName}.`);
        }
      }
    };
    const resolveDefaultMap = () => {
      if (options.mapPath) {
        const file = this.app.vault.getAbstractFileByPath(options.mapPath);
        return file instanceof import_obsidian.TFile && file.extension.toLowerCase() === "map" ? file : null;
      }
      return this.findLatestMapInNoteFolder(sourcePath);
    };
    loadDefaultBtn.addEventListener("click", async () => {
      const file = resolveDefaultMap();
      if (!file) {
        new import_obsidian.Notice("No matching .map file found for this block.");
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
    window.setTimeout(() => {
      if (typeof webview.executeJavaScript === "function") return;
      webview.remove();
      const fallbackFrame = el.createEl("iframe", { cls: "azgaar-loader-iframe azgaar-loader-iframe-inline" });
      fallbackFrame.src = this.settings.azgaarUrl;
      fallbackFrame.style.height = `${options.height}px`;
      new import_obsidian.Notice("Inline webview API unavailable. Opened Azgaar in iframe; auto map loading may not work.");
    }, 900);
  }
  parseAzgaarBlockOptions(source) {
    const lines = source.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
    let mapPath = null;
    let mode = "latest";
    let height = 720;
    for (const line of lines) {
      if (line.startsWith("map:")) {
        const candidate = line.slice("map:".length).trim();
        mapPath = candidate.length > 0 ? candidate : null;
        continue;
      }
      if (line.startsWith("mode:")) {
        mode = line.slice("mode:".length).trim().toLowerCase() || "latest";
        continue;
      }
      if (line.startsWith("height:")) {
        const parsed = Number.parseInt(line.slice("height:".length).trim(), 10);
        if (Number.isFinite(parsed) && parsed >= 360 && parsed <= 2e3) {
          height = parsed;
        }
      }
    }
    return { mapPath, mode, height };
  }
  async saveMapFromWebviewToSourceFolder(webview, sourcePath) {
    if (typeof webview.executeJavaScript !== "function") {
      new import_obsidian.Notice("Inline save is unavailable in this embed mode.");
      return;
    }
    const result = await webview.executeJavaScript(buildMapExportScript(), true);
    if (!result || result.ok !== true) {
      const reason = result && "error" in result && result.error ? `: ${result.error}` : "";
      new import_obsidian.Notice(`Could not export map from Azgaar${reason}`);
      return;
    }
    const folderPath = this.getFolderPathFromSourcePath(sourcePath);
    const safeName = this.sanitizeMapFileName(result.fileName);
    const outputPath = this.getAvailableMapPath(folderPath, safeName);
    const buffer = this.base64ToArrayBuffer(result.base64);
    await this.app.vault.createBinary(outputPath, buffer);
    new import_obsidian.Notice(`Saved ${safeName} to ${folderPath || "vault root"}.`);
  }
  getFolderPathFromSourcePath(sourcePath) {
    if (!sourcePath.includes("/")) return "";
    return sourcePath.slice(0, sourcePath.lastIndexOf("/"));
  }
  sanitizeMapFileName(fileName) {
    let name = fileName.trim();
    if (name.length === 0) name = `fantasy_map_${Date.now()}.map`;
    name = name.replace(/[\\/:*?"<>|]/g, "_");
    if (!name.toLowerCase().endsWith(".map")) {
      name += ".map";
    }
    return name;
  }
  getAvailableMapPath(folderPath, fileName) {
    const splitIndex = fileName.toLowerCase().endsWith(".map") ? fileName.length - 4 : fileName.length;
    const base = fileName.slice(0, splitIndex);
    const ext = ".map";
    let candidate = folderPath ? `${folderPath}/${fileName}` : fileName;
    let count = 1;
    while (this.app.vault.getAbstractFileByPath(candidate)) {
      const nextName = `${base}-${count}${ext}`;
      candidate = folderPath ? `${folderPath}/${nextName}` : nextName;
      count += 1;
    }
    return candidate;
  }
  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
  findLatestMapInNoteFolder(sourcePath) {
    const folder = sourcePath.includes("/") ? sourcePath.slice(0, sourcePath.lastIndexOf("/")) : "";
    const folderPrefix = folder.length > 0 ? `${folder}/` : "";
    const candidates = this.app.vault.getFiles().filter((file) => {
      if (file.extension.toLowerCase() !== "map") return false;
      if (folderPrefix === "") return !file.path.includes("/");
      return file.path.startsWith(folderPrefix);
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.stat.mtime - a.stat.mtime);
    return candidates[0];
  }
  normalizeAzgaarUrl(raw) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return DEFAULT_SETTINGS.azgaarUrl;
    const maybeWithProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const url = new URL(maybeWithProtocol);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return DEFAULT_SETTINGS.azgaarUrl;
      }
      url.searchParams.delete("maplink");
      url.searchParams.delete("mapLink");
      return url.toString();
    } catch {
      return DEFAULT_SETTINGS.azgaarUrl;
    }
  }
};
