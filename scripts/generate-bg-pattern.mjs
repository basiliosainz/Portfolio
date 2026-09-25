// Generates the two background-pattern SVGs (bg-pattern.svg for the page
// background, bg-pattern-panel.svg for panels/header/nav) plus the matching
// CSS tile-size variables, from the human-editable
// assets/img/bg-pattern-config.txt.
//
// Run with:  npm run bg-pattern   (or just `npm run build`, which calls this)
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "assets/img/bg-pattern-config.txt");
const CSS_PATH = path.join(ROOT, "assets/css/style.css");

const COLS = 6;
const ROWS = 4;
const CELL = 40;
// Reference (scale = 1) tile sizes, in px - not a round 240x160, there's a
// deliberate small overscan baked in. TAMANO_* is a multiplier on these, and
// height is always derived from width via this exact ratio so a single
// number can never distort/stretch the icons the way independently-set
// width+height could.
const BASE_SIZE_FONDO = { w: 244, h: 164 };
const BASE_SIZE_FRANJAS = { w: 305, h: 205 };
// Stagger step between each icon's animation phase (in seconds). Purely
// cosmetic (keeps icons from all trembling in sync) - doesn't need to scale
// with the configured speed/distance.
const STAGGER_STEP = 0.83;
// The 5 duration variants are spread evenly around the configured base
// speed, matching the original hand-tuned design (7.00/8.30/9.60/10.90/12.20
// around a base of 9.6s).
const DUR_STEPS = [-2.6, -1.3, 0, 1.3, 2.6];
// Base keyframe path the icons tremble along, at the reference distance of
// 1.6 units - scaled per-config by DISTANCIA_*.
const BASE_DISTANCE = 1.6;
const BASE_KEYFRAMES = [
  [0, 0],
  [1.6, -1.1],
  [-1.2, 1.4],
  [0.8, 0.6],
  [0, 0],
];

const LIGHT = "rgba(255,255,255,0.06)";
const DARK = "rgba(0,0,0,0.22)";

function parseConfig(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Z_]+)=(.+)$/);
    if (match) values[match[1]] = match[2].trim();
  }
  return values;
}

function icon(type, shade, cx, cy) {
  const a = shade === "a" ? LIGHT : DARK;
  const b = shade === "a" ? DARK : LIGHT;
  if (type === "controller") {
    return (
      `<rect x="${cx + 4}" y="${cy + 14}" width="32" height="16" rx="8" fill="${a}"/>` +
      `<rect x="${cx + 10}" y="${cy + 17}" width="3" height="8" rx="1" fill="${b}"/>` +
      `<rect x="${cx + 7.5}" y="${cy + 19.5}" width="8" height="3" rx="1" fill="${b}"/>` +
      `<circle cx="${cx + 27}" cy="${cy + 18.5}" r="2" fill="${b}"/>` +
      `<circle cx="${cx + 31.5}" cy="${cy + 23}" r="2" fill="${b}"/>`
    );
  }
  if (type === "joystick") {
    return (
      `<rect x="${cx + 9}" y="${cy + 27}" width="22" height="6" rx="3" fill="${a}"/>` +
      `<rect x="${cx + 18}" y="${cy + 10}" width="4" height="20" rx="2" fill="${a}"/>` +
      `<circle cx="${cx + 20}" cy="${cy + 9}" r="6" fill="${b}"/>`
    );
  }
  // brackets
  return (
    `<polyline points="${cx + 15},${cy + 11} ${cx + 6},${cy + 20} ${cx + 15},${cy + 29}" fill="none" stroke="${a}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<polyline points="${cx + 25},${cy + 11} ${cx + 34},${cy + 20} ${cx + 25},${cy + 29}" fill="none" stroke="${a}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

function buildSvg(durBase, distance) {
  const scale = distance / BASE_DISTANCE;
  const values = BASE_KEYFRAMES.map(([x, y]) => `${+(x * scale).toFixed(2)},${+(y * scale).toFixed(2)}`).join("; ");

  const groups = [];
  let idx = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const type = ["controller", "joystick", "brackets"][col % 3];
      const shade = (row + col) % 2 === 0 ? "a" : "b";
      const dur = +(durBase + DUR_STEPS[idx % DUR_STEPS.length]).toFixed(2);
      const begin = -+((idx * STAGGER_STEP) % dur).toFixed(2);
      const x = col * CELL;
      const y = row * CELL;
      const anim =
        `<animateTransform attributeName="transform" attributeType="XML" type="translate" additive="sum" ` +
        `values="${values}" keyTimes="0;0.28;0.58;0.82;1" calcMode="spline" ` +
        `keySplines="0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1" ` +
        `dur="${dur.toFixed(2)}s" begin="${begin.toFixed(2)}s" repeatCount="indefinite"/>`;
      groups.push(`<g transform="translate(${x},${y})">${icon(type, shade, 0, 0)}${anim}</g>`);
      idx++;
    }
  }

  const width = COLS * CELL;
  const height = ROWS * CELL;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n` +
    groups.join("\n") +
    `\n</svg>\n`
  );
}

function formatTileSize(scaleStr, base) {
  const scale = parseFloat(scaleStr);
  const width = Math.round(base.w * scale * 10) / 10;
  const height = Math.round(base.h * scale * 10) / 10;
  return `${width}px ${height}px`;
}

async function updateCssSizes(bgSize, panelSize) {
  const css = await readFile(CSS_PATH, "utf8");
  const markerRe = /\/\* BG-PATTERN-SIZE:START[\s\S]*?BG-PATTERN-SIZE:END \*\//;
  const block =
    `/* BG-PATTERN-SIZE:START (generated by scripts/generate-bg-pattern.mjs from assets/img/bg-pattern-config.txt - do not edit by hand) */\n` +
    `  --bg-pattern-size: ${bgSize};\n` +
    `  --panel-pattern-size: ${panelSize};\n` +
    `  /* BG-PATTERN-SIZE:END */`;
  if (!markerRe.test(css)) {
    console.warn("  ⚠ could not find BG-PATTERN-SIZE markers in style.css - sizes not updated");
    return;
  }
  await writeFile(CSS_PATH, css.replace(markerRe, block), "utf8");
}

export async function generate() {
  const config = parseConfig(await readFile(CONFIG_PATH, "utf8"));

  const bgSvg = buildSvg(parseFloat(config.VELOCIDAD_FONDO), parseFloat(config.DISTANCIA_FONDO));
  const panelSvg = buildSvg(parseFloat(config.VELOCIDAD_FRANJAS), parseFloat(config.DISTANCIA_FRANJAS));

  await writeFile(path.join(ROOT, "assets/img/bg-pattern.svg"), bgSvg, "utf8");
  await writeFile(path.join(ROOT, "assets/img/bg-pattern-panel.svg"), panelSvg, "utf8");

  const bgSize = formatTileSize(config.TAMANO_FONDO, BASE_SIZE_FONDO);
  const panelSize = formatTileSize(config.TAMANO_FRANJAS, BASE_SIZE_FRANJAS);
  await updateCssSizes(bgSize, panelSize);

  console.log("✓ bg-pattern.svg and bg-pattern-panel.svg regenerated from bg-pattern-config.txt");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  generate().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
