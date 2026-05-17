import { App, FuzzySuggestModal, TFile } from "obsidian";

export class MapFileSuggestModal extends FuzzySuggestModal<TFile> {
  private readonly files: TFile[];
  private readonly onChoose: (file: TFile) => void;

  constructor(app: App, onChoose: (file: TFile) => void) {
    super(app);
    this.onChoose = onChoose;
    this.files = app.vault.getFiles().filter((file) => file.extension.toLowerCase() === "map");
    this.setPlaceholder("Select a .map file from your vault...");
  }

  getItems(): TFile[] {
    return this.files;
  }

  getItemText(item: TFile): string {
    return item.path;
  }

  onChooseItem(item: TFile): void {
    this.onChoose(item);
  }
}
