import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dir = process.argv[2] ?? "dist/releases";
const output = process.argv[3] ?? "dist/releases/checksums.json";

const files = async (root: string): Promise<string[]> => {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = join(root, entry.name);
      if (entry.isDirectory()) return files(full);
      return [full];
    })
  );
  return nested.flat();
};

const allFiles = (await files(dir)).filter((file) => !file.endsWith("checksums.json"));
const checksums = await Promise.all(
  allFiles.map(async (file) => {
    const data = await readFile(file);
    const meta = await stat(file);
    return {
      file,
      sha256: createHash("sha256").update(data).digest("hex"),
      size: meta.size
    };
  })
);

await writeFile(output, `${JSON.stringify({ generated_at: new Date().toISOString(), checksums }, null, 2)}\n`);
console.log(`checksums written: ${output}`);
