#!/usr/bin/env node
/**
 * Design-token contrast checker.
 *
 * Parses the HSL custom properties out of src/index.css and asserts the
 * accessibility contract documented at the top of that file:
 *
 *   (a) `text-<token>`            reads on --background and --card  >= 4.5:1
 *   (b) `text-<token>-foreground` reads on `bg-<token>`             >= 4.5:1
 *
 * Both themes are checked independently, because a single lightness cannot
 * satisfy a near-white and a near-black surface at the same time.
 *
 * Run: node scripts/check-contrast.mjs
 * Exits non-zero on any failure, so it can gate CI.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSS = join(ROOT, 'src', 'index.css');

const AA_BODY = 4.5;

/** Tokens used both as `text-x` and as a `bg-x` + `text-x-foreground` pair. */
const SEMANTIC = ['primary', 'accent', 'success', 'warning', 'destructive'];

/**
 * Surface-only tokens: legitimately low-contrast against the background
 * because they ARE a background (cards, chips, raised panels). Only rule (b)
 * applies — never write `text-<token>` for these, use `-foreground`.
 */
const SURFACE_ONLY = ['secondary', 'muted'];

// ---------------------------------------------------------------- colour math

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => v * 255);
}

function relativeLuminance([r, g, b]) {
  const c = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(a, b) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const toHex = ([r, g, b]) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

// ------------------------------------------------------------------- parsing

/**
 * Pull `--name: H S% L%;` declarations out of a block of CSS text.
 * Deliberately ignores values carrying an alpha channel (`/ 0.3`) and
 * non-HSL values — those are effect tokens, not text/surface pairs.
 */
function parseTokens(block) {
  const out = {};
  const re = /--([a-z0-9-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*;/gi;
  let m;
  while ((m = re.exec(block)) !== null) {
    out[m[1]] = [parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4])];
  }
  return out;
}

function extractBlock(css, selector) {
  // Find `selector {` then balance braces to the matching close.
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`Could not find "${selector}" in index.css`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`Unbalanced braces after "${selector}"`);
}

// -------------------------------------------------------------------- checks

const css = readFileSync(CSS, 'utf8');
const themes = {
  light: parseTokens(extractBlock(css, ':root')),
  dark: parseTokens(extractBlock(css, '.dark')),
};

let failures = 0;
let checks = 0;

for (const [themeName, t] of Object.entries(themes)) {
  console.log(`\n=== ${themeName.toUpperCase()} ===`);

  const surfaces = { background: t.background, card: t.card };
  for (const [sName, s] of Object.entries(surfaces)) {
    if (!s) {
      console.log(`  ! missing --${sName} in ${themeName}`);
      failures++;
      continue;
    }
  }

  for (const token of SEMANTIC) {
    const fill = t[token];
    const fg = t[`${token}-foreground`];
    if (!fill) {
      console.log(`  ! missing --${token} in ${themeName}`);
      failures++;
      continue;
    }

    // (a) token used as text on each surface
    for (const [sName, s] of Object.entries(surfaces)) {
      if (!s) continue;
      const ratio = contrast(hslToRgb(...fill), hslToRgb(...s));
      const ok = ratio >= AA_BODY;
      checks++;
      if (!ok) failures++;
      console.log(
        `  ${ok ? 'ok  ' : 'FAIL'} ${ratio.toFixed(2).padStart(5)}:1  ` +
          `text-${token} on ${sName}`.padEnd(34) +
          `${toHex(hslToRgb(...fill))} on ${toHex(hslToRgb(...s))}`,
      );
    }

    // (b) foreground on the solid fill
    if (!fg) {
      console.log(`  ! missing --${token}-foreground in ${themeName}`);
      failures++;
      continue;
    }
    const ratio = contrast(hslToRgb(...fg), hslToRgb(...fill));
    const ok = ratio >= AA_BODY;
    checks++;
    if (!ok) failures++;
    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'} ${ratio.toFixed(2).padStart(5)}:1  ` +
        `${token}-foreground on bg-${token}`.padEnd(34) +
        `${toHex(hslToRgb(...fg))} on ${toHex(hslToRgb(...fill))}`,
    );
  }

  // Surface-only tokens: rule (b) only.
  for (const token of SURFACE_ONLY) {
    const fill = t[token];
    const fg = t[`${token}-foreground`];
    if (!fill || !fg) {
      console.log(`  ! missing --${token} / --${token}-foreground in ${themeName}`);
      failures++;
      continue;
    }
    const ratio = contrast(hslToRgb(...fg), hslToRgb(...fill));
    const ok = ratio >= AA_BODY;
    checks++;
    if (!ok) failures++;
    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'} ${ratio.toFixed(2).padStart(5)}:1  ` +
        `${token}-foreground on bg-${token}`.padEnd(34) +
        `${toHex(hslToRgb(...fg))} on ${toHex(hslToRgb(...fill))}  [surface-only]`,
    );
  }

  // Tokens that must be visually distinct from each other, or status badges
  // built on them become indistinguishable (primary/accent/warning were all
  // the same orange before v3.1).
  const distinct = ['primary', 'accent', 'warning'];
  for (let i = 0; i < distinct.length; i++) {
    for (let j = i + 1; j < distinct.length; j++) {
      const a = t[distinct[i]];
      const b = t[distinct[j]];
      if (!a || !b) continue;
      const same = a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
      checks++;
      if (same) failures++;
      console.log(
        `  ${same ? 'FAIL' : 'ok  '}         ` +
          `--${distinct[i]} distinct from --${distinct[j]}`,
      );
    }
  }
}

console.log(
  `\n${checks - failures}/${checks} checks passed` +
    (failures ? ` — ${failures} FAILURE(S)` : ''),
);
process.exit(failures ? 1 : 0);
