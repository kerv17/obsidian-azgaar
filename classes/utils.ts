// Utility functions for AzgaarLoaderPlugin

/**
 * Converts an ArrayBuffer to a base64 string.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/**
 * Convert a base64 string to an ArrayBuffer.
 * @param base64 The base64-encoded string
 * @returns The decoded ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Builds a script to inject a map file into Azgaar's webview.
 */
export function buildMapInjectionScript(fileName: string, base64: string): string {
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

/**
 * Builds a script to export a map from Azgaar's webview.
 */
export function buildMapExportScript(): string {
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

import { TFile } from "obsidian";
// Utility to normalize Azgaar map generator URLs
import { DEFAULT_SETTINGS } from "../main";

/**
 * Normalize a user-provided Azgaar URL, ensuring protocol and removing maplink params.
 * @param raw The raw URL string
 * @returns A safe Azgaar URL string
 */
export function normalizeAzgaarUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return DEFAULT_SETTINGS.azgaarUrl;

  const maybeWithProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(maybeWithProtocol);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return DEFAULT_SETTINGS.azgaarUrl;
    }
    // Prevent stale/invalid map URLs from being persisted in base settings.
    url.searchParams.delete("maplink");
    url.searchParams.delete("mapLink");
    return url.toString();
  } catch {
    return DEFAULT_SETTINGS.azgaarUrl;
  }
}

/**
 * Parse options from an Azgaar code block source string.
 * @param source The code block content
 * @returns Parsed options: mapPath, mode, height
 */
export function parseAzgaarBlockOptions(source: string): { mapPath: string | null; mode: string; height: number } {
  const lines = source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let mapPath: string | null = null;
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
      if (Number.isFinite(parsed) && parsed >= 360 && parsed <= 2000) {
        height = parsed;
      }
    }
  }

  return { mapPath, mode, height };
}

/**
 * Get the folder path from a source file path.
 */
export function getFolderPathFromSourcePath(sourcePath: string): string {
  if (!sourcePath.includes("/")) return "";
  return sourcePath.slice(0, sourcePath.lastIndexOf("/"));
}

/**
 * Sanitize a file name for saving a map file.
 */
export function sanitizeMapFileName(fileName: string): string {
  let name = fileName.trim();
  if (name.length === 0) name = `fantasy_map_${Date.now()}.map`;
  name = name.replace(/[\\/:*?"<>|]/g, "_");
  if (!name.toLowerCase().endsWith(".map")) {
    name += ".map";
  }
  return name;
}

/**
 * Get a unique available map file path in a folder.
 */
export function getAvailableMapPath(
  app: { vault: { getAbstractFileByPath: (path: string) => unknown } },
  folderPath: string,
  fileName: string
): string {
  const splitIndex = fileName.toLowerCase().endsWith(".map") ? fileName.length - 4 : fileName.length;
  const base = fileName.slice(0, splitIndex);
  const ext = ".map";

  let candidate = folderPath ? `${folderPath}/${fileName}` : fileName;
  let count = 1;

  while (app.vault.getAbstractFileByPath(candidate)) {
    const nextName = `${base}-${count}${ext}`;
    candidate = folderPath ? `${folderPath}/${nextName}` : nextName;
    count += 1;
  }

  return candidate;
}

/**
 * Find the latest .map file in the same folder as the note.
 */
export function findLatestMapInNoteFolder(app: { vault: { getFiles: () => TFile[] } }, sourcePath: string): TFile | null {
  const folder = sourcePath.includes("/") ? sourcePath.slice(0, sourcePath.lastIndexOf("/")) : "";
  const folderPrefix = folder.length > 0 ? `${folder}/` : "";

  const candidates = app.vault.getFiles().filter((file: TFile) => {
    if (file.extension.toLowerCase() !== "map") return false;
    if (folderPrefix === "") return !file.path.includes("/");
    return file.path.startsWith(folderPrefix);
  });

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.stat.mtime - a.stat.mtime);
  return candidates[0];
}
