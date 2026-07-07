/**
 * Bundle script for ElektroPlan Desktop.
 *
 * Mirrors the exact dev-time directory structure inside bundle/ so that
 * the compiled main process (which uses import.meta.url-relative paths like
 * "../../preload/dist/index.js" and "../../renderer/dist/index.html") works
 * identically in production without any source changes.
 *
 * Bundle layout produced:
 *   bundle/
 *     package.json                        ← electron-builder app entry
 *     apps/
 *       desktop/
 *         main/dist/**                    ← main process
 *         preload/dist/**                 ← preload script
 *         renderer/dist/**               ← renderer HTML + assets
 *     node_modules/
 *       @elektroplan/<pkg>/dist/**        ← workspace packages (flat-copied)
 *       better-sqlite3/**                 ← native module (copied from pnpm store)
 *       zod/**                            ← runtime dep
 */

import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(desktopDir, "../..");
const bundleDir = path.join(desktopDir, "bundle");
const desktopPackage = JSON.parse(
  await readFile(path.join(desktopDir, "package.json"), "utf-8")
);

// ─── helpers ─────────────────────────────────────────────────────────────────

async function copyDir(src, dest) {
  if (!existsSync(src)) {
    throw new Error(`Source does not exist: ${src}`);
  }
  await mkdir(dest, { recursive: true });
  await cp(src, dest, { recursive: true, dereference: true });
}

async function collectFiles(entryPath) {
  if (!existsSync(entryPath)) {
    throw new Error(`Required path does not exist: ${entryPath}`);
  }

  const entryStat = await stat(entryPath);
  if (!entryStat.isDirectory()) {
    return [entryPath];
  }

  const children = await readdir(entryPath, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    children.map(async (child) => {
      const childPath = path.join(entryPath, child.name);
      if (child.isDirectory()) {
        return collectFiles(childPath);
      }
      return [childPath];
    }),
  );

  return nestedFiles.flat();
}

async function getNewestMtimeMs(paths) {
  const files = (await Promise.all(paths.map((entryPath) => collectFiles(entryPath)))).flat();
  if (files.length === 0) {
    throw new Error(`No files found under required inputs: ${paths.join(", ")}`);
  }

  const stats = await Promise.all(files.map((filePath) => stat(filePath)));
  return Math.max(...stats.map((entry) => entry.mtimeMs));
}

async function assertFreshBuild({ label, inputs, outputDir }) {
  if (!existsSync(outputDir)) {
    throw new Error(`${label} output is missing: ${outputDir}. Run the corresponding build first.`);
  }

  const sourceNewest = await getNewestMtimeMs(inputs);
  const outputNewest = await getNewestMtimeMs([outputDir]);

  if (sourceNewest > outputNewest) {
    throw new Error(
      `${label} output is stale: ${outputDir}. Source files are newer than build output; run the corresponding build first.`,
    );
  }
}

async function findNodeModulesPath(pkgName) {
  // Prefer the desktop app's installed modules so native deps match Electron.
  const desktopNodeModulesPath = path.join(desktopDir, "node_modules", pkgName);
  if (existsSync(desktopNodeModulesPath)) {
    return desktopNodeModulesPath;
  }

  // Search pnpm virtual store first, then root node_modules
  const pnpmStore = path.join(repoRoot, "node_modules/.pnpm");
  const directPath = path.join(repoRoot, "node_modules", pkgName);
  if (existsSync(directPath)) {
    return directPath;
  }

  const workspacePackageDirs = await readdir(path.join(repoRoot, "packages")).catch(() => []);
  for (const packageDir of workspacePackageDirs) {
    const workspacePackageNodeModulesPath = path.join(
      repoRoot,
      "packages",
      packageDir,
      "node_modules",
      pkgName,
    );
    if (existsSync(workspacePackageNodeModulesPath)) {
      return workspacePackageNodeModulesPath;
    }
  }

  // Search pnpm store entries matching the package name
  const storeEntries = await readdir(pnpmStore).catch(() => []);
  // e.g. "better-sqlite3@12.9.0" → look in that folder
  const safeName = pkgName.replace("/", "+").replace("@", "");
  const match = storeEntries.find((e) =>
    e.toLowerCase().startsWith(safeName.toLowerCase() + "@") ||
    e.toLowerCase().startsWith(pkgName.replace("@", "").replace("/", "+").toLowerCase() + "@")
  );
  if (match) {
    const candidate = path.join(pnpmStore, match, "node_modules", pkgName);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Cannot find node_modules path for: ${pkgName}`);
}

async function collectRuntimeDependencyGraph(entryDeps) {
  const queue = [...entryDeps];
  const seen = new Set();
  const graph = new Map();

  while (queue.length > 0) {
    const pkgName = queue.shift();
    if (!pkgName || seen.has(pkgName)) {
      continue;
    }

    seen.add(pkgName);

    const srcPath = await findNodeModulesPath(pkgName);
    const packageJson = JSON.parse(
      await readFile(path.join(srcPath, "package.json"), "utf-8")
    );

    graph.set(pkgName, {
      srcPath,
      version: packageJson.version,
    });

    for (const dependencyName of Object.keys(packageJson.dependencies ?? {})) {
      queue.push(dependencyName);
    }
  }

  return graph;
}

const bundleFreshnessChecks = [
  {
    label: "desktop main",
    inputs: [
      path.join(desktopDir, "main/src"),
      path.join(desktopDir, "main/package.json"),
      path.join(desktopDir, "main/tsconfig.json"),
    ],
    outputDir: path.join(desktopDir, "main/dist"),
  },
  {
    label: "desktop preload",
    inputs: [
      path.join(desktopDir, "preload/src"),
      path.join(desktopDir, "preload/package.json"),
      path.join(desktopDir, "preload/tsconfig.json"),
    ],
    outputDir: path.join(desktopDir, "preload/dist"),
  },
  {
    label: "desktop renderer",
    inputs: [
      path.join(desktopDir, "renderer/src"),
      path.join(desktopDir, "renderer/package.json"),
      path.join(desktopDir, "renderer/tsconfig.json"),
      path.join(desktopDir, "renderer/vite.config.ts"),
    ],
    outputDir: path.join(desktopDir, "renderer/dist"),
  },
  ...[
    "storage",
    "exporters",
    "calculation-data",
    "calculation-core",
    "contracts",
  ].map((pkgName) => ({
    label: pkgName,
    inputs: [
      path.join(repoRoot, "packages", pkgName, "src"),
      path.join(repoRoot, "packages", pkgName, "package.json"),
      path.join(repoRoot, "packages", pkgName, "tsconfig.json"),
    ],
    outputDir: path.join(repoRoot, "packages", pkgName, "dist"),
  })),
];

// ─── main ────────────────────────────────────────────────────────────────────

for (const check of bundleFreshnessChecks) {
  await assertFreshBuild(check);
}

console.log("Cleaning bundle directory …");
await rm(bundleDir, { recursive: true, force: true });
await mkdir(bundleDir, { recursive: true });

// 1. Mirror apps/desktop/main/dist → bundle/apps/desktop/main/dist
console.log("Copying main process …");
await copyDir(
  path.join(desktopDir, "main/dist"),
  path.join(bundleDir, "apps/desktop/main/dist")
);

// 2. Mirror apps/desktop/preload/dist → bundle/apps/desktop/preload/dist
console.log("Copying preload …");
await copyDir(
  path.join(desktopDir, "preload/dist"),
  path.join(bundleDir, "apps/desktop/preload/dist")
);

// 3. Mirror apps/desktop/renderer/dist → bundle/apps/desktop/renderer/dist
console.log("Copying renderer …");
await copyDir(
  path.join(desktopDir, "renderer/dist"),
  path.join(bundleDir, "apps/desktop/renderer/dist")
);

// 4. Workspace packages as node_modules
const workspacePackages = [
  {
    name: "@elektroplan/calculation-core",
    src: "packages/calculation-core",
  },
  {
    name: "@elektroplan/calculation-data",
    src: "packages/calculation-data",
  },
  {
    name: "@elektroplan/contracts",
    src: "packages/contracts",
  },
  {
    name: "@elektroplan/storage",
    src: "packages/storage",
  },
  {
    name: "@elektroplan/exporters",
    src: "packages/exporters",
  },
];

for (const pkg of workspacePackages) {
  console.log(`Copying workspace package: ${pkg.name} …`);
  const srcRoot = path.join(repoRoot, pkg.src);
  const destRoot = path.join(bundleDir, "node_modules", pkg.name);

  // Copy dist directory
  await copyDir(path.join(srcRoot, "dist"), path.join(destRoot, "dist"));

  // Write a minimal package.json so Node can resolve the package
  const srcPkg = JSON.parse(
    await readFile(path.join(srcRoot, "package.json"), "utf-8")
  );
  const minimalPkg = {
    name: srcPkg.name,
    version: srcPkg.version,
    type: srcPkg.type ?? "module",
    main: srcPkg.main ?? "./dist/index.js",
    ...(srcPkg.types ? { types: srcPkg.types } : {}),
    ...(srcPkg.exports ? { exports: srcPkg.exports } : {}),
  };
  await writeFile(
    path.join(destRoot, "package.json"),
    JSON.stringify(minimalPkg, null, 2)
  );
}

// 5. Copy runtime node_modules, including transitive deps needed at runtime
const runtimeDeps = ["better-sqlite3", "zod", "xlsx"];
const runtimeDependencyGraph = await collectRuntimeDependencyGraph(runtimeDeps);
for (const [dep, { srcPath }] of runtimeDependencyGraph) {
  console.log(`Copying runtime dep: ${dep} …`);
  const destPath = path.join(bundleDir, "node_modules", dep);
  await copyDir(srcPath, destPath);
}

const bundleDependencies = Object.fromEntries(
  await Promise.all(
    workspacePackages.map(async (pkg) => {
      const packageJson = JSON.parse(
        await readFile(path.join(repoRoot, pkg.src, "package.json"), "utf-8")
      );
      return [pkg.name, packageJson.version];
    })
  )
);

for (const [dep, { version }] of runtimeDependencyGraph) {
  bundleDependencies[dep] =
    dep in desktopPackage.dependencies ? desktopPackage.dependencies[dep] : version;
}

// 6. Write bundle-level package.json (electron-builder reads `main` from here)
//    Keep runtime dependencies listed so electron-builder does not prune the copied modules.
const bundlePkg = {
  name: desktopPackage.name,
  version: desktopPackage.version,
  private: desktopPackage.private,
  type: "module",
  description: desktopPackage.description,
  author: desktopPackage.author,
  main: "apps/desktop/main/dist/index.js",
  dependencies: bundleDependencies,
};
await writeFile(
  path.join(bundleDir, "package.json"),
  JSON.stringify(bundlePkg, null, 2)
);

console.log("\nBundle complete:", bundleDir);
console.log("Structure:");
const topLevel = await readdir(bundleDir);
for (const entry of topLevel) {
  console.log("  bundle/" + entry);
}
