import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const buildGradlePath = join(process.cwd(), "apps", "mobile", "android", "app", "build.gradle");
let content = readFileSync(buildGradlePath, "utf8");

if (!content.includes("xionRelease")) {
  content = content.replace(
    /signingConfigs\s*\{\s*debug\s*\{/,
    `signingConfigs {
        xionRelease {
            if (project.hasProperty('ANDROID_KEYSTORE_PASSWORD')) {
                storeFile file(project.property('ANDROID_KEYSTORE_FILE'))
                storePassword project.property('ANDROID_KEYSTORE_PASSWORD')
                keyAlias project.property('ANDROID_KEY_ALIAS')
                keyPassword project.property('ANDROID_KEYSTORE_PASSWORD')
            }
        }
        debug {`
  );
}

content = content.replace(
  /release\s*\{\s*([\s\S]*?)signingConfig signingConfigs\.debug/,
  "release {\n            $1signingConfig signingConfigs.xionRelease"
);

writeFileSync(buildGradlePath, content);
