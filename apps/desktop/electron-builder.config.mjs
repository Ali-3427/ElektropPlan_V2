export default {
  appId: "com.elektroplan.desktop",
  productName: "ElektroPlan",
  copyright: "Copyright © 2026 ElektroPlan",
  directories: {
    buildResources: "buildResources",
    output: "release",
  },
  files: [
    "bundle/**/*",
    "!bundle/**/*.map",
    "!bundle/**/*.d.ts",
    "!bundle/**/*.d.ts.map",
  ],
  win: {
    icon: "buildResources/icon.ico",
    target: [
      { target: "nsis", arch: ["x64"] },
      { target: "portable", arch: ["x64"] },
    ],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "ElektroPlan",
    installerIcon: "buildResources/icon.ico",
    uninstallerIcon: "buildResources/icon.ico",
  },
  asar: true,
  asarUnpack: ["**/better-sqlite3/**/*", "**/*.node"],
};
