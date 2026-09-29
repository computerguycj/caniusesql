/**
 * custom-theme.test.mjs — unit tests for src/elements/customTheme.js.
 *
 * The palettes mirror tokens.css (Light and Dark bases) at the time of
 * writing; they're fixtures for the math, not the source of truth.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  contrast, mix, deriveTokens, checkTokens, passes, nearestPassing, isSafeTokenMap, parseHex,
} from '../src/elements/customTheme.js';

const INKS = { lightInk: '#ffffff', darkInk: '#0d1117' };
const LIGHT = { bg: '#f5f7fa', surface: '#ffffff', surfaceAlt: '#f8f9fa', text: '#333333', ...INKS };
const DARK = { bg: '#0d1117', surface: '#161b22', surfaceAlt: '#1c2128', text: '#e6edf3', ...INKS };

test('contrast matches known WCAG values', () => {
  assert.equal(contrast('#ffffff', '#000000').toFixed(2), '21.00');
  assert.equal(contrast('#3498db', '#f5f7fa').toFixed(2), '2.94');  // the old Light accent
});

test('mix goes from a to b', () => {
  assert.equal(mix('#000000', '#ffffff', 0), '#000000');
  assert.equal(mix('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
});

test('the shipped accents pass on their own bases', () => {
  assert.ok(passes('#1f74ae', LIGHT));
  assert.ok(passes('#58a6ff', DARK));
});

test('text on accent picks the ink with more contrast', () => {
  assert.equal(deriveTokens('#1f74ae', LIGHT)['--color-text-on-accent'], '#ffffff');
  assert.equal(deriveTokens('#58a6ff', DARK)['--color-text-on-accent'], '#0d1117');
});

test('a failing pick names each failing pair with its ratio', () => {
  const failing = checkTokens(deriveTokens('#3498db', LIGHT), LIGHT).filter(c => !c.ok);
  assert.ok(failing.some(c => c.name === 'accent text on background' && c.ratio < 4.5));
  assert.ok(failing.every(c => typeof c.ratio === 'number'));
});

test('a light accent fails on Light but passes on Dark', () => {
  assert.ok(!passes('#ffd166', LIGHT));
  assert.ok(passes('#ffd166', DARK));
});

test('mid-lightness colors fail with both inks on them', () => {
  // Around this lightness, neither white nor near-black text reaches 4.5:1.
  const gray = '#7a7a7a';
  assert.ok(contrast('#ffffff', gray) < 4.5);
  assert.ok(contrast('#0d1117', gray) < 4.5);
  const onAccent = checkTokens(deriveTokens(gray, LIGHT), LIGHT).find(c => c.name === 'text on accent');
  assert.equal(onAccent.ok, false);
});

test('nearestPassing returns a passing color close to the pick, keeping the hue', () => {
  for (const [pick, base] of [['#3498db', LIGHT], ['#7a7a7a', LIGHT], ['#1f74ae', DARK], ['#ff00ff', LIGHT], ['#330066', DARK]]) {
    const fixed = nearestPassing(pick, base);
    assert.ok(fixed, `${pick} has a fix`);
    assert.ok(passes(fixed, base), `${fixed} passes`);
    // Same hue family: the dominant channel stays dominant.
    const [a, b] = [parseHex(pick), parseHex(fixed)];
    if (Math.max(...a) - Math.min(...a) > 30) assert.equal(a.indexOf(Math.max(...a)), b.indexOf(Math.max(...b)), `${pick} -> ${fixed} keeps its hue`);
  }
  assert.equal(nearestPassing('#1f74ae', LIGHT), '#1f74ae', 'a passing pick is returned as is');
});

test('isSafeTokenMap accepts only --color-* names with #hex values', () => {
  assert.ok(isSafeTokenMap(deriveTokens('#1f74ae', LIGHT)));
  assert.ok(!isSafeTokenMap({ '--color-primary': 'red' }));
  assert.ok(!isSafeTokenMap({ '--color-primary': '#fff' }));
  assert.ok(!isSafeTokenMap({ '--color-primary': '#1f74ae; background: url(https://evil.example/x)' }));
  assert.ok(!isSafeTokenMap({ 'background-image': '#1f74ae' }));
  assert.ok(!isSafeTokenMap({ '--color-primary': '#1f74ae', __proto__: null, '--x': '#000000' }));
  assert.ok(!isSafeTokenMap([]));
  assert.ok(!isSafeTokenMap({}));
  assert.ok(!isSafeTokenMap(null));
});
