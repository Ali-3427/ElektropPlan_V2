import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const sourceDir = path.join(packageRoot, "src");
const targetDir = path.join(packageRoot, "dist");

await mkdir(targetDir, { recursive: true });
await cp(sourceDir, targetDir, {
  force: true,
  recursive: true,
  filter(sourcePath) {
    return (
      sourcePath === sourceDir ||
      !path.extname(sourcePath) ||
      sourcePath.endsWith(".json")
    );
  },
});
