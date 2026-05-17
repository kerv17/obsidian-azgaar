import { App, PluginSettingTab, Setting } from "obsidian";
import AzgaarLoaderPlugin from "../main";
import type { AzgaarLoaderSettings } from "./interfaces";
import { normalizeAzgaarUrl } from "./utils";

export class AzgaarSettingTab extends PluginSettingTab {
  plugin: AzgaarLoaderPlugin;

  constructor(app: App, plugin: AzgaarLoaderPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Azgaar URL")
      .setDesc("Change if you want to point to another hosted version.")
      .addText((text) =>
        text
          .setPlaceholder("https://azgaar.github.io/Fantasy-Map-Generator/")
          .setValue(this.plugin.settings.azgaarUrl)
          .onChange(async (value) => {
            this.plugin.settings.azgaarUrl = normalizeAzgaarUrl(value);
            text.setValue(this.plugin.settings.azgaarUrl);
            await this.plugin.saveSettings();
          })
      );
  }
}
