// Scans assets/media/<project>/ folders and writes a manifest.json in each
// listing every image/video file found, so the site's carousels can render
// whatever the user drops in the folder without editing any HTML.
//
// Run with:  npm run build:media
import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEDIA_ROOT = path.join(__dirname, "..", "assets", "media");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const VIDEO_EXT = new Set([".mp4", ".webm"]);

const GITHUB_WARN_BYTES = 50 * 1024 * 1024; // GitHub warns above this
const GITHUB_HARD_LIMIT_BYTES = 100 * 1024 * 1024; // GitHub rejects pushes above this

function naturalCompare(a, b) {
  const chunk = (s) => s.match(/(\d+|\D+)/g) || [];
  const ac = chunk(a);
  const bc = chunk(b);
  const len = Math.max(ac.length, bc.length);
  for (let i = 0; i < len; i++) {
    const x = ac[i] ?? "";
    const y = bc[i] ?? "";
    if (x === y) continue;
    const xNum = /^\d+$/.test(x);
    const yNum = /^\d+$/.test(y);
    if (xNum && yNum) return Number(x) - Number(y);
    return x < y ? -1 : 1;
  }
  return 0;
}

function toAlt(fileName, projectLabel) {
  const base = fileName.replace(/\.[^.]+$/, "");
  const cleaned = base
    .replace(/^\d+[\s_-]*/, "")
    .replace(/[_-]+/g, " ")
    .trim();
  return cleaned ? `${projectLabel} - ${cleaned}` : projectLabel;
}

async function buildFolder(folderName) {
  const folderPath = path.join(MEDIA_ROOT, folderName);
  const entries = await readdir(folderPath, { withFileTypes: true });

  const files = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => name.toLowerCase() !== "manifest.json" && !name.startsWith("."))
    .sort(naturalCompare);

  const projectLabel = folderName
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const items = [];
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    let type = null;
    if (IMAGE_EXT.has(ext)) type = "image";
    else if (VIDEO_EXT.has(ext)) type = "video";
    else {
      console.warn(`  skipping unsupported file: ${folderName}/${file}`);
      continue;
    }

    const full = path.join(folderPath, file);
    const { size } = await stat(full);
    if (size >= GITHUB_HARD_LIMIT_BYTES) {
      console.warn(
        `  ⚠ ${folderName}/${file} is ${(size / (1024 * 1024)).toFixed(1)} MB - ` +
          `GitHub rejects files at or above 100 MB. This file will NOT appear in the manifest.`
      );
      continue;
    }
    if (size >= GITHUB_WARN_BYTES) {
      console.warn(
        `  ⚠ ${folderName}/${file} is ${(size / (1024 * 1024)).toFixed(1)} MB - ` +
          `GitHub warns above 50 MB. Consider compressing it or hosting it on YouTube instead.`
      );
    }

    items.push({
      file,
      type,
      alt: toAlt(file, projectLabel),
    });
  }

  const manifestPath = path.join(folderPath, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(items, null, 2) + "\n", "utf8");
  console.log(`✓ ${folderName}: ${items.length} item(s) -> manifest.json`);
}

async function main() {
  let projectDirs;
  try {
    projectDirs = (await readdir(MEDIA_ROOT, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch (err) {
    console.error(`Could not read ${MEDIA_ROOT}:`, err.message);
    process.exit(1);
  }

  for (const dir of projectDirs) {
    await buildFolder(dir);
  }
}

main();
