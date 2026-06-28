import { readFile, writeFile } from "node:fs/promises";
import { updateManifestSchema } from "@xion-assistant/shared";

const manifestPath = process.argv[2] ?? "dist/releases/latest.json";
const outputPath = process.argv[3] ?? "dist/releases/published-version.json";
const manifest = updateManifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));

await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      published_at: new Date().toISOString(),
      manifest,
      note: "Upload artifact and latest manifest to R2 after checksum verification."
    },
    null,
    2
  )}\n`
);

console.log(`version metadata written: ${outputPath}`);
