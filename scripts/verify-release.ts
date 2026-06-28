import { access, readFile } from "node:fs/promises";
import { updateManifestSchema } from "@xion-assistant/shared";

const manifestPath = process.argv[2] ?? "dist/releases/latest.json";
const raw = await readFile(manifestPath, "utf8");
const manifest = updateManifestSchema.parse(JSON.parse(raw));

if (/^0+$/.test(manifest.sha256)) {
  throw new Error("Release manifest uses placeholder sha256. Generate real checksum before publishing.");
}

await access(manifestPath);
console.log(`release manifest valid: ${manifest.version} ${manifest.platform} ${manifest.channel}`);
