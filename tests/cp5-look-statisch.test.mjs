// cp5: de look in de broncode (zonder browser): overgangen, kleuren, Tailwind-klassen, lettertypes, muis-handlers.
// Pagina's: index en behandelingen; stijlbestanden: alle css en js in de root (theme.css doet mee zodra het bestaat).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CP5_PAGINAS, paginasKeuze, leesBronnen, foutKleuren, classAttributen, familiesInBron, TOEGESTANE_FAMILIES, kleurToegestaan } from './look.mjs';

const PAGINAS = paginasKeuze(CP5_PAGINAS);
const bronnen = leesBronnen(PAGINAS);
const paginaBronnen = bronnen.filter((b) => b.soort === 'html');

test('1. geen "alles tegelijk"-overgang in pagina\'s, css en js', () => {
  const fouten = [];
  for (const b of bronnen) {
    const t = b.tekst.replace(/\/\*[\s\S]*?\*\//g, ' ');
    const a = (t.match(/transition-all/g) || []).length;
    const c = (t.match(/transition(-property)?\s*:\s*all\b/g) || []).length;
    if (a + c) fouten.push(`${b.naam}: ${a} x transition-all, ${c} x "transition: all"`);
  }
  assert.deepEqual(fouten, [], `overgang op alles gevonden:\n${fouten.join('\n')}`);
});

test('2. alleen merkkleuren (en wit, zwart, goudtinten) in de stijlregels', () => {
  const fouten = [];
  for (const b of bronnen) {
    const tel = new Map();
    for (const d of b.declaraties) for (const [k, n] of foutKleuren(d)) tel.set(k, (tel.get(k) || 0) + n);
    for (const [k, n] of tel) fouten.push(`${b.naam}: ${k} (${n})`);
  }
  assert.deepEqual(fouten, [], `kleuren buiten de lijst:\n${fouten.join('\n')}`);
});

test('3. geen standaard Tailwind-kleuren in de class-attributen', () => {
  const NAMEN = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
  const PREFIX = 'bg|text|border|from|via|to|ring|fill|stroke|shadow|outline|decoration|divide|placeholder|accent|caret';
  const standaard = new RegExp(`(?<![\\w-])(?:[\\w:-]*:)?(?:${PREFIX})-(?:${NAMEN})-\\d{2,3}`, 'g');
  const vrij = /\[(#[0-9a-fA-F]{3,8}|rgba?\([^\]]*\)|hsla?\([^\]]*\))\]/g;
  const fouten = [];
  for (const b of paginaBronnen) {
    const tel = new Map();
    for (const klasse of classAttributen(b.tekst)) {
      for (const m of klasse.matchAll(standaard)) tel.set(m[0], (tel.get(m[0]) || 0) + 1);
      for (const m of klasse.matchAll(vrij)) if (!kleurToegestaan(m[1].replace(/_/g, ' '))) tel.set(m[0], (tel.get(m[0]) || 0) + 1);
    }
    for (const [k, n] of tel) fouten.push(`${b.naam}: ${k} (${n})`);
  }
  assert.deepEqual(fouten, [], `standaard- of vrije kleuren in klassen:\n${fouten.join('\n')}`);
});

test('4. Playfair Display en DM Sans worden geladen en zijn de eerste familie', () => {
  for (const b of paginaBronnen) {
    const fonts = [...b.tekst.matchAll(/<link\b[^>]*fonts\.googleapis\.com\/css2?[^>]*>/gi)].map((m) => m[0]).join(' ');
    assert.ok(/family=Playfair\+Display/.test(fonts), `${b.naam}: laadt Playfair Display niet via Google Fonts`);
    assert.ok(/family=DM\+Sans/.test(fonts), `${b.naam}: laadt DM Sans niet via Google Fonts`);
  }
  const fouten = familiesInBron(bronnen)
    .filter((f) => f.familie !== 'inherit' && !TOEGESTANE_FAMILIES.includes(f.familie))
    .map((f) => `${f.bestand}: font-family ${f.waarde}`);
  assert.deepEqual([...new Set(fouten)], [], `andere eerste familie dan Playfair Display of DM Sans:\n${[...new Set(fouten)].join('\n')}`);
});

test('5. geen onmouseover/onmouseout in de html', () => {
  const fouten = [];
  for (const b of paginaBronnen) {
    const n = (b.tekst.match(/\sonmouse(?:over|out)\s*=/gi) || []).length;
    if (n) fouten.push(`${b.naam}: ${n} x onmouseover/onmouseout (zo'n knop heeft geen focus- of indrukstaat)`);
  }
  assert.deepEqual(fouten, [], fouten.join('\n'));
});
