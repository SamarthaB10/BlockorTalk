import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../public/nova.html'), 'utf8');

test('nova landing keeps one sprite instead of a robot per section', () => {
  assert.equal(html.includes('three.module.js'), false);
  assert.equal(html.includes('three/addons'), false);
  assert.equal((html.match(/id="actor"/g) || []).length, 1);
  assert.match(html, /\/sprites\/purple\//);
  assert.match(html, /talk_standard/);
  assert.doesNotMatch(html, /\/sprites\/red\//);
  assert.doesNotMatch(html, /\/sprites\/green\//);
});

test('nova landing has the three sections, prompts, and fictional reviews', () => {
  for (const id of ['intro', 'product', 'reviews']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /Create a smart contract for a token named NOVA on Ethereum\./);
  assert.match(html, /Explain what a smart contract does in simple terms\./);
  assert.match(html, /Audit this contract for reentrancy vulnerabilities\./);
  assert.match(html, /What is the market sentiment on BTC today\?/);
  assert.match(html, /Ilan Brooks/);
  assert.match(html, /Rhea Okafor/);
  assert.match(html, /Mara Elling/);
  assert.match(html, /@font-face/);
  assert.match(html, /Schibsted Grotesk/);
  assert.match(html, /IBM Plex Mono/);
  assert.match(html, /Open scenarios/);
  assert.doesNotMatch(html, /Solutions/);
  assert.doesNotMatch(html, /LAUNCH NOVA/);
  assert.doesNotMatch(html, /Nova Pad/);
});
