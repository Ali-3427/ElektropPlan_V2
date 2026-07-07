declare module "electron" {
  export interface BrowserWindowConstructorOptions {
    width?: number;
    height?: number;
    minWidth?: number;
    minHeight?: number;
    show?: boolean;
    autoHideMenuBar?: boolean;
    webPreferences?: {
      preload?: string;
      contextIsolation?: boolean;
      nodeIntegration?: boolean;
      sandbox?: boolean;
    };
  }

  export class BrowserWindow {
    constructor(options?: BrowserWindowConstructorOptions);
    static getAllWindows(): BrowserWindow[];
    once(event: "ready-to-show", listener: () => void): this;
    show(): void;
    loadURL(url: string): Promise<void>;
    loadFile(filePath: string): Promise<void>;
    webContents: {
      openDevTools(options?: {
        mode?: "detach" | "right" | "bottom" | "undocked";
      }): void;
    };
  }

  export const app: {
    whenReady(): Promise<void>;
    on(
      event: "activate" | "window-all-closed" | "before-quit",
      listener: () => void,
    ): void;
    quit(): void;
    getPath(
      name:
        | "home"
        | "appData"
        | "userData"
        | "sessionData"
        | "temp"
        | "exe"
        | "module"
        | "desktop"
        | "documents"
        | "downloads"
        | "music"
        | "pictures"
        | "videos"
        | "logs"
        | "crashDumps",
    ): string;
  };

  export interface IpcMainInvokeEvent {
    readonly sender: unknown;
  }

  export interface IpcMain {
    handle(
      channel: string,
      listener: (
        event: IpcMainInvokeEvent,
        ...args: unknown[]
      ) => Promise<unknown> | unknown,
    ): void;
    removeHandler(channel: string): void;
  }

  export const ipcMain: IpcMain;

  export interface SaveDialogOptions {
    title?: string;
    defaultPath?: string;
    buttonLabel?: string;
    filters?: { name: string; extensions: string[] }[];
  }

  export interface SaveDialogReturnValue {
    canceled: boolean;
    filePath?: string;
  }

  export const dialog: {
    showSaveDialog(
      options: SaveDialogOptions,
    ): Promise<SaveDialogReturnValue>;
    showSaveDialog(
      browserWindow: BrowserWindow,
      options: SaveDialogOptions,
    ): Promise<SaveDialogReturnValue>;
  };
}

declare const process: {
  env: Record<string, string | undefined>;
  platform: string;
};

declare class URL {
  constructor(input: string, base?: string);
  readonly pathname: string;
}

interface ImportMeta {
  readonly url: string;
}

declare module "node:path" {
  const path: {
    join(...segments: string[]): string;
    dirname(p: string): string;
    resolve(...segments: string[]): string;
    sep: string;
  };
  export default path;
  export function join(...segments: string[]): string;
  export function dirname(p: string): string;
  export function resolve(...segments: string[]): string;
}

declare module "node:fs/promises" {
  export function writeFile(
    path: string,
    data: Uint8Array | string,
  ): Promise<void>;
  export function mkdir(
    path: string,
    options?: { recursive?: boolean },
  ): Promise<string | undefined>;
}
