/**
 * customTheme.js — the math behind Custom mode: derive the accent-driven
 * tokens from one accent color on a Light or Dark base, check their
 * contrast (WCAG 2.2 AA), and suggest the nearest passing accent.
 *
 * Pure functions, no DOM, so node:test covers them (tests/custom-theme.test.mjs).
 * No color values live here: the base palette and the two text-on-accent
 * candidates ("inks") are read from tokens.css by the caller and passed in.
 *
 * Colors are "#rrggbb" strings. The focus ring is "#rrggbbaa".
 */

const HEX = /^#[0-9a-f]{6}$/i;
const TOKEN_NAME = /^--color-[a-z-]+$/;
const TOKEN_VALUE = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;

export const TEXT_MIN = 4.5;     // WCAG 1.4.3, normal text
export const NON_TEXT_MIN = 3;   // WCAG 1.4.11, focus ring and UI parts

export function isHex(value) {
  return typeof value === 'string' && HEX.test(value);
}

export function parseHex(hex) {
  if (!isHex(hex)) throw new Error(`Not a #rrggbb color: ${hex}`);
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}

export function toHex(rgb) {
  return '#' + rgb.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
}

// WCAG relative luminance and contrast ratio.
export function luminance(hex) {
  const [r, g, b] = parseHex(hex).map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// Straight sRGB mix: t = 0 gives a, t = 1 gives b.
export function mix(a, b, t) {
  const [x, y] = [parseHex(a), parseHex(b)];
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

/**
 * The tokens Custom mode sets on <html>, derived from one accent.
 * palette: { bg, surface, surfaceAlt, text, lightInk, darkInk } for the base.
 */
export function deriveTokens(accent, palette) {
  const onAccent = contrast(palette.lightInk, accent) >= contrast(palette.darkInk, accent) ? palette.lightInk : palette.darkInk;
  // Hover (and badge text) moves toward the base's text color: darker on
  // Light, lighter on Dark, so it gains contrast against the tints below.
  const stronger = mix(accent, palette.text, 0.15);
  return {
    '--color-primary': accent,
    '--color-primary-dark': stronger,
    '--color-text-on-accent': onAccent,
    '--color-focus-ring': accent + '33',  // 20% alpha
    '--color-badge-text': stronger,
    '--color-badge-bg': mix(palette.surface, accent, 0.08),
    '--color-badge-bg-hover': mix(palette.surface, accent, 0.14),
    '--color-badge-border': mix(palette.surface, accent, 0.35),
    '--color-search-hover': mix(palette.surface, accent, 0.06),
  };
}

/** Every pair Custom mode creates, with its ratio. */
export function checkTokens(tokens, palette) {
  const accent = tokens['--color-primary'];
  const pairs = [
    ['accent text on background', accent, palette.bg, TEXT_MIN],
    ['accent text on surface', accent, palette.surface, TEXT_MIN],
    ['accent text on alternate surface', accent, palette.surfaceAlt, TEXT_MIN],
    ['accent text on badge', tokens['--color-badge-text'], tokens['--color-badge-bg'], TEXT_MIN],
    ['accent text on search highlight', accent, tokens['--color-search-hover'], TEXT_MIN],
    ['hover color on background', tokens['--color-primary-dark'], palette.bg, TEXT_MIN],
    ['text on accent', tokens['--color-text-on-accent'], accent, TEXT_MIN],
    ['focus ring on background', accent, palette.bg, NON_TEXT_MIN],
  ];
  return pairs.map(([name, fg, bg, min]) => {
    const ratio = contrast(fg, bg);
    return { name, fg, bg, min, ratio, ok: ratio >= min };
  });
}

export function passes(accent, palette) {
  return checkTokens(deriveTokens(accent, palette), palette).every(c => c.ok);
}

// HSL helpers for the suggestion search.
function toHsl(hex) {
  const [r, g, b] = parseHex(hex).map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function fromHsl([h, s, l]) {
  if (s === 0) return toHex([l * 255, l * 255, l * 255]);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return toHex([f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]);
}

/**
 * The nearest passing accent: same hue and saturation, lightness moved in
 * small steps in both directions; the smaller move wins. null if nothing
 * passes (it can't happen with real palettes, but callers must handle it).
 */
export function nearestPassing(accent, palette) {
  if (passes(accent, palette)) return accent;
  const [h, s, l] = toHsl(accent);
  for (let step = 1; step <= 200; step++) {
    for (const dir of [-1, 1]) {
      const nl = l + (dir * step) / 200;
      if (nl < 0 || nl > 1) continue;
      const candidate = fromHsl([h, s, nl]);
      if (passes(candidate, palette)) return candidate;
    }
  }
  return null;
}

/**
 * Accepts only what Custom mode itself writes: --color-* names and #hex
 * values. Anything else in localStorage is ignored, so a tampered value
 * can't inject CSS. The inline head script repeats these two checks.
 */
export function isSafeTokenMap(map) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return false;
  const entries = Object.entries(map);
  return entries.length > 0 && entries.every(([name, value]) => TOKEN_NAME.test(name) && typeof value === 'string' && TOKEN_VALUE.test(value));
}
