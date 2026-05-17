// AzgaarModal: Modal dialog for embedding Azgaar Fantasy Map Generator in Obsidian
import { App, Modal, Notice, TFile } from "obsidian";
import AzgaarLoaderPlugin from "../main";
import type { PendingMapFile, WebviewLike } from "./interfaces";
import { arrayBufferToBase64, buildMapInjectionScript } from "./utils";

/**
 * Modal for displaying and interacting with Azgaar Fantasy Map Generator.
 * Handles loading .map files into the embedded webview or iframe.
 */
export class AzgaarModal extends Modal {
  // Reference to the parent plugin instance
  private readonly plugin: AzgaarLoaderPlugin;
  // The embedded webview element (if available)
  private webview: WebviewLike | null = null;
  // Fallback iframe if webview is unavailable
  private fallbackFrame: HTMLIFrameElement | null = null;
  // Queue of map files to inject when webview is ready
  private readonly pendingFiles: PendingMapFile[] = [];
  // Tracks if the webview is ready for injection
  private webviewReady = false;

  constructor(app: App, plugin: AzgaarLoaderPlugin) {
    super(app);
    this.plugin = plugin;
  }

  /**
   * Called when the modal is opened. Sets up UI and webview/iframe.
   */
  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    this.setTitle("Azgaar Fantasy Map Generator");

    // Controls for loading .map files
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

    // Try to use a webview for best integration
    const webview = document.createElement("webview") as WebviewLike;
    webview.className = "azgaar-loader-webview";
    webview.setAttribute("partition", "persist:obsidian-azgaar-loader");
    webview.setAttribute("allowpopups", "true");
    webview.setAttribute("src", this.plugin.settings.azgaarUrl);
    contentEl.appendChild(webview);
    this.webview = webview;

    // Listen for webview readiness
    webview.addEventListener("dom-ready", () => {
      this.webviewReady = true;
      void this.flushPendingFiles();
    });

    // Fallback to iframe if webview is not available
    window.setTimeout(() => {
      const canInject = typeof this.webview?.executeJavaScript === "function";
      if (canInject) return;
      this.webview?.remove();
      this.webview = null;
      this.fallbackFrame = contentEl.createEl("iframe", {
        cls: "azgaar-loader-iframe"
      });
      this.fallbackFrame.src = this.plugin.settings.azgaarUrl;
      new Notice("Webview API unavailable. Opened Azgaar in iframe; auto file loading may not work.");
    }, 900);
  }

  /**
   * Queue a .map file to be injected into Azgaar when ready.
   * @param file The TFile to load
   */
  async queueMapFile(file: TFile): Promise<void> {
    const data = await this.app.vault.readBinary(file);
    const base64 = arrayBufferToBase64(data);
    this.pendingFiles.push({
      fileName: file.name,
      base64
    });
    if (!this.webviewReady) {
      new Notice(`Queued ${file.name}. It will load once Azgaar is ready.`);
      return;
    }
    await this.flushPendingFiles();
  }

  /**
   * Inject all pending .map files into the webview (if possible).
   */
  private async flushPendingFiles(): Promise<void> {
    if (!this.webview || typeof this.webview.executeJavaScript !== "function") {
      if (this.pendingFiles.length > 0) {
        new Notice("Cannot inject file automatically in this embed mode.");
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
          new Notice(`Loaded ${next.fileName} into Azgaar.`);
        } else {
          new Notice(
            `Could not auto-load ${next.fileName}. Try Azgaar's own Load button in the embedded page.`
          );
        }
      } catch (error) {
        console.error("[azgaar-loader] injection failed", error);
        new Notice(
          `Injection failed for ${next.fileName}. Use Azgaar's Load button manually if needed.`
        );
      }
    }
  }

  /**
   * Cleanup when the modal is closed.
   */
  onClose(): void {
    this.contentEl.empty();
    this.webview = null;
    this.fallbackFrame = null;
    this.pendingFiles.length = 0;
    this.webviewReady = false;
  }
}
