// Generates every project page (dontkillrumble.html, bioforce.html, etc.) and
// the nav menu on every page, straight from the `media/` folder.
//
// To add a new project page: create a folder under media/, add an info.txt,
// a Logo.png (optional), and drop files into a "content" subfolder (and
// optionally an "extra" subfolder for a second section at the bottom of the
// page). Then run this script (or just commit - the pre-commit hook runs it
// for you) and the page + nav button appear automatically.
//
// Run with:  npm run build
import { readdir, readFile, writeFile, stat, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const MEDIA_ROOT = path.join(ROOT, "media");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const VIDEO_EXT = new Set([".mp4", ".webm"]);

const GITHUB_WARN_BYTES = 50 * 1024 * 1024; // GitHub warns above this
const GITHUB_HARD_LIMIT_BYTES = 100 * 1024 * 1024; // GitHub rejects pushes above this

const FIXED_NAV = {
  about: { href: "index.html", label: "About Me" },
  contact: { href: "contact.html", label: "Contact" },
};

// ---------- small helpers ----------

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

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

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

// Escapes text, then turns *word* into a highlighted span.
function richText(str) {
  const escaped = escapeHtml(str);
  return escaped.replace(/\*([^*]+)\*/g, '<span class="highlight">$1</span>');
}

function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [/[?&]v=([\w-]{11})/, /youtu\.be\/([\w-]{11})/, /\/embed\/([\w-]{11})/];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

// ---------- info.txt parsing ----------

const KNOWN_KEYS = [
  "NavLabel",
  "IntroHeading",
  "Intro",
  "Steam",
  "YouTube",
  "GameplayHeading",
  "GalleryHeading",
  "ExtraHeading",
  "ExtraText",
];
const KEY_LOOKUP = new Map(KNOWN_KEYS.map((k) => [k.toLowerCase(), k]));

function parseInfoTxt(text) {
  const fields = {};
  let currentKey = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Za-z]+):\s?(.*)$/);
    const key = match ? KEY_LOOKUP.get(match[1].toLowerCase()) : null;

    if (key) {
      currentKey = key;
      fields[key] = match[2] || "";
    } else if (currentKey) {
      fields[currentKey] = fields[currentKey] ? `${fields[currentKey]} ${line}` : line;
    }
  }
  return fields;
}

// ---------- media folder scanning ----------

async function listMediaFiles(dirPath, projectLabel) {
  if (!(await exists(dirPath))) return [];

  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => !name.startsWith("."))
    .sort(naturalCompare);

  const items = [];
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    let type = null;
    if (IMAGE_EXT.has(ext)) type = "image";
    else if (VIDEO_EXT.has(ext)) type = "video";
    else {
      console.warn(`  skipping unsupported file: ${path.relative(ROOT, dirPath)}/${file}`);
      continue;
    }

    const full = path.join(dirPath, file);
    const { size } = await stat(full);
    if (size >= GITHUB_HARD_LIMIT_BYTES) {
      console.warn(
        `  ⚠ ${file} is ${(size / (1024 * 1024)).toFixed(1)} MB - GitHub rejects files ` +
          `at or above 100 MB. This file will be skipped.`
      );
      continue;
    }
    if (size >= GITHUB_WARN_BYTES) {
      console.warn(
        `  ⚠ ${file} is ${(size / (1024 * 1024)).toFixed(1)} MB - GitHub warns above 50 MB. ` +
          `Consider compressing it or hosting it on YouTube instead.`
      );
    }

    items.push({ file, type, alt: toAlt(file, projectLabel) });
  }
  return items;
}

// ---------- HTML fragments ----------

function renderNavUl(navItems, currentHref) {
  const li = navItems
    .map((item) => {
      const active = item.href === currentHref ? ' class="active"' : "";
      return `      <li><a href="${escapeAttr(item.href)}"${active}>${escapeHtml(item.label)}</a></li>`;
    })
    .join("\n");
  return `<ul>\n${li}\n    </ul>`;
}

function renderCarouselThumb(item, base) {
  const src = `${base}/${item.file}`;
  if (item.type === "video") {
    return (
      `        <button class="carousel-thumb is-video" type="button" data-type="video" data-src="${escapeAttr(src)}" data-alt="${escapeAttr(item.alt)}">\n` +
      `          <video class="carousel-thumb-video" src="${escapeAttr(src)}#t=0.5" muted playsinline preload="metadata"></video>\n` +
      `          <span class="carousel-thumb-play" aria-hidden="true"></span>\n` +
      `        </button>`
    );
  }
  return `        <button class="carousel-thumb" type="button" data-type="image" data-src="${escapeAttr(src)}" data-alt="${escapeAttr(item.alt)}" style="background-image:url('${src}')"></button>`;
}

function renderGalleryItem(item, base) {
  const src = `${base}/${item.file}`;
  if (item.type === "video") {
    return `      <video class="gallery-video" src="${escapeAttr(src)}" controls muted playsinline></video>`;
  }
  return `      <img src="${escapeAttr(src)}" alt="${escapeAttr(item.alt)}">`;
}

// ---------- page template ----------

function renderProjectPage({ folder, fields, hasLogo, contentItems, extraItems, navHtml }) {
  const navLabel = fields.NavLabel || folder;
  const contentBase = `media/${folder}/content`;
  const extraBase = `media/${folder}/extra`;

  let hero;
  if (hasLogo) {
    hero =
      `  <div class="panel project-hero">\n` +
      `    <img class="project-logo" src="media/${folder}/Logo.png" alt="${escapeAttr(navLabel)} logo">\n` +
      `    <div class="project-text">\n` +
      `      <p>${richText(fields.Intro)}</p>\n` +
      renderSteamButton(fields.Steam) +
      `    </div>\n` +
      `  </div>`;
  } else {
    hero =
      `  <div class="panel">\n` +
      (fields.IntroHeading ? `    <h2>${escapeHtml(fields.IntroHeading)}</h2>\n` : "") +
      `    <p>${richText(fields.Intro)}</p>\n` +
      renderSteamButton(fields.Steam) +
      `  </div>`;
  }

  const youtubeId = extractYouTubeId(fields.YouTube);
  const gameplay = youtubeId
    ? `\n\n  <div class="panel">\n` +
      `    <h2>${escapeHtml(fields.GameplayHeading || "-Gameplay-")}</h2>\n` +
      `    <div class="video-embed">\n` +
      `      <iframe width="560" height="315" src="https://www.youtube.com/embed/${youtubeId}" title="${escapeAttr(navLabel)}" frameborder="0" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>\n` +
      `    </div>\n` +
      `  </div>`
    : "";

  const gallery =
    contentItems.length > 0
      ? `\n\n  <div class="panel">\n` +
        `    <h2>${escapeHtml(fields.GalleryHeading || "-Gallery-")}</h2>\n` +
        `    <div class="carousel" data-carousel>\n` +
        `      <div class="carousel-stage">\n` +
        `        <div class="carousel-media"></div>\n` +
        `        <button class="carousel-next" type="button" aria-label="Next">&rsaquo;</button>\n` +
        `      </div>\n` +
        `      <div class="carousel-thumbs">\n` +
        contentItems.map((item) => renderCarouselThumb(item, contentBase)).join("\n") +
        `\n      </div>\n` +
        `    </div>\n` +
        `  </div>`
      : "";

  const extra =
    extraItems.length > 0
      ? `\n\n  <div class="panel">\n` +
        (fields.ExtraHeading ? `    <h2>${escapeHtml(fields.ExtraHeading)}</h2>\n` : "") +
        (fields.ExtraText ? `    <p>${richText(fields.ExtraText)}</p>\n` : "") +
        `    <div class="gallery">\n` +
        extraItems.map((item) => renderGalleryItem(item, extraBase)).join("\n") +
        `\n    </div>\n` +
        `  </div>`
      : "";

  return pageShell({
    title: `${navLabel} | Basilio Sainz`,
    navHtml,
    body: `${hero}${gameplay}${gallery}${extra}`,
  });
}

function renderSteamButton(steamUrl) {
  if (!steamUrl) return "";
  return (
    `      <a class="btn-steam" href="${escapeAttr(steamUrl)}" target="_blank" rel="noopener">\n` +
    `        -Go to Steam-\n` +
    `        <img src="assets/img/steam-icon.png" alt="">\n` +
    `      </a>\n`
  );
}

function pageShell({ title, navHtml, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<link rel="icon" href="assets/img/profile.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=clash-display@700,600,500,400&display=swap">
<link rel="stylesheet" href="assets/css/style.css">
<script src="assets/js/carousel.js" defer></script>
</head>
<body>
<header class="site-header">
  <div class="wrap header-inner">
    <div class="profile-pic"><img src="assets/img/profile.png" alt="Basilio Sainz"></div>
    <div class="header-titles">
      <h1>Basilio Sainz</h1>
      <p>Semi senior<br>-Technical Artist-</p>
    </div>
    <div class="engine-logos">
      <img src="assets/img/unreal-logo.png" alt="Unreal Engine">
      <img src="assets/img/unity-logo.png" alt="Unity">
    </div>
  </div>
</header>

<!-- NAV:START -->
<nav class="site-nav">
  <div class="wrap">
    ${navHtml}
  </div>
</nav>
<!-- NAV:END -->

<main class="wrap">
${body}
</main>

<footer class="site-footer">
  <div class="wrap">&copy; Basilio Sainz &mdash; San Rafael, Mendoza, Argentina</div>
</footer>
</body>
</html>
`;
}

// Swaps just the <nav>...</nav> block (marked with comments) in a fixed page
// like index.html or contact.html, leaving the rest of the file untouched.
async function updateNavInFixedPage(filePath, navHtml) {
  const html = await readFile(filePath, "utf8");
  const markerRe = /<!-- NAV:START -->[\s\S]*?<!-- NAV:END -->/;
  if (!markerRe.test(html)) {
    console.warn(`  ⚠ could not find NAV:START/NAV:END markers in ${path.basename(filePath)} - nav not updated`);
    return;
  }
  const replaced = html.replace(
    markerRe,
    `<!-- NAV:START -->\n<nav class="site-nav">\n  <div class="wrap">\n    ${navHtml}\n  </div>\n</nav>\n<!-- NAV:END -->`
  );
  await writeFile(filePath, replaced, "utf8");
}

// ---------- main ----------

async function loadProjectFolders() {
  const orderPath = path.join(MEDIA_ROOT, "order.json");
  let order = [];
  if (await exists(orderPath)) {
    order = JSON.parse(await readFile(orderPath, "utf8"));
  }

  const dirEntries = (await readdir(MEDIA_ROOT, { withFileTypes: true })).filter(
    (e) => e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith(".")
  );
  const dirNames = dirEntries.map((e) => e.name);

  const known = order.filter((name) => dirNames.includes(name));
  const extras = dirNames.filter((name) => !order.includes(name)).sort(naturalCompare);
  if (extras.length) {
    console.log(`Found project folder(s) not listed in media/order.json, appending: ${extras.join(", ")}`);
  }
  return [...known, ...extras];
}

async function main() {
  const folders = await loadProjectFolders();
  const projects = [];

  for (const folder of folders) {
    const folderPath = path.join(MEDIA_ROOT, folder);
    const infoPath = path.join(folderPath, "info.txt");
    if (!(await exists(infoPath))) {
      console.warn(`Skipping ${folder}: no info.txt found`);
      continue;
    }

    const fields = parseInfoTxt(await readFile(infoPath, "utf8"));
    const navLabel = fields.NavLabel || folder;
    const slug = folder.toLowerCase().replace(/[^a-z0-9]/g, "");
    const hasLogo = await exists(path.join(folderPath, "Logo.png"));

    const contentItems = await listMediaFiles(path.join(folderPath, "content"), navLabel);
    const extraItems = await listMediaFiles(path.join(folderPath, "extra"), navLabel);

    projects.push({ folder, slug, href: `${slug}.html`, label: navLabel, fields, hasLogo, contentItems, extraItems });
  }

  const navItems = [FIXED_NAV.about, ...projects.map((p) => ({ href: p.href, label: p.label })), FIXED_NAV.contact];

  for (const project of projects) {
    const navHtml = renderNavUl(navItems, project.href);
    const html = renderProjectPage({
      folder: project.folder,
      fields: project.fields,
      hasLogo: project.hasLogo,
      contentItems: project.contentItems,
      extraItems: project.extraItems,
      navHtml,
    });
    await writeFile(path.join(ROOT, project.href), html, "utf8");
    console.log(`✓ ${project.href} (${project.contentItems.length} gallery item(s), ${project.extraItems.length} extra item(s))`);
  }

  await updateNavInFixedPage(path.join(ROOT, "index.html"), renderNavUl(navItems, "index.html"));
  await updateNavInFixedPage(path.join(ROOT, "contact.html"), renderNavUl(navItems, "contact.html"));
  console.log("✓ nav updated in index.html and contact.html");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
