export interface AzgaarLoaderSettings {
  azgaarUrl: string;
}

export interface PendingMapFile {
  fileName: string;
  base64: string;
}

type WebviewLike = HTMLElement & {
  addEventListener: (event: string, cb: () => void, options?: unknown) => void;
  executeJavaScript?: (code: string, userGesture?: boolean) => Promise<unknown>;
};

export type { WebviewLike };
