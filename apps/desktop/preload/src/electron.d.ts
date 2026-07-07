declare module "electron" {
  export const contextBridge: {
    exposeInMainWorld(key: string, api: unknown): void;
  };

  export const ipcRenderer: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
    send(channel: string, ...args: unknown[]): void;
    on(
      channel: string,
      listener: (event: unknown, ...args: unknown[]) => void,
    ): void;
    removeAllListeners(channel: string): void;
  };
}

declare const process: {
  platform: string;
  versions: {
    chrome: string;
    electron: string;
    node: string;
  };
};
