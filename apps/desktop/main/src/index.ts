import path from "node:path";

import { app, BrowserWindow, ipcMain } from "electron";

import { registerIpcHandlers } from "./ipc/register.js";
import { createServices, type AppServices } from "./services/index.js";

const isDevelopment = process.env.NODE_ENV === "development";
const devServerUrl =
  process.env.ELECTRON_RENDERER_URL ?? process.env.VITE_DEV_SERVER_URL;

let services: AppServices | null = null;

function resolveBundledEntry(relativePath: string): string {
  const pathname = new URL(relativePath, import.meta.url).pathname;

  if (process.platform === "win32" && pathname.startsWith("/")) {
    return pathname.slice(1);
  }

  return pathname;
}

function getPreloadEntry(): string {
  return resolveBundledEntry("../../preload/dist/index.js");
}

function getRendererHtmlEntry(): string {
  return resolveBundledEntry("../../renderer/dist/index.html");
}

function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1200,
    minHeight: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: getPreloadEntry(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  if (isDevelopment && devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(getRendererHtmlEntry());
  }

  return mainWindow;
}

function closeServices(): void {
  if (services !== null) {
    try {
      services.close();
    } catch {
      // Swallow shutdown errors.
    }
    services = null;
  }
}

app.whenReady().then(() => {
  const databasePath = path.join(app.getPath("userData"), "elektroplan.db");
  services = createServices({ databasePath });

  services.materials.seedIfEmpty().then((result) => {
    if (result.seeded) {
      console.log(`[materials] Seeded ${result.categoriesAdded} categories, ${result.materialsAdded} materials (${result.dataVersion})`);
    }
  }).catch((err: unknown) => {
    console.error('[materials] Seed failed (non-fatal):', err);
  });

  registerIpcHandlers(ipcMain, services);

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}).catch((error: unknown) => {
  console.error("Failed to start ElektroPlan.", error);
  app.quit();
});

app.on("window-all-closed", () => {
  closeServices();

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  closeServices();
});
