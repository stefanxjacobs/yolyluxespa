// cp6: de look in de broncode van alle 9 pagina's (zonder browser): overgangen, kleuren, lettertypes,
// en gelijke balk, menu en footer. Hergebruikt look.mjs en helpers.mjs ongewijzigd.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, PAGINAS, leesHtml, blok, tekst, links } from './helpers.mjs';
import { leesBronnen, foutKleuren, classAttributen, familiesInBron, TOEGESTANE_FAMILIES, kleurToegestaan } from './look.mjs';

const REF = 'behandelingen';
const bronnen = leesBronnen(PAGINAS);
const paginaBronnen = bronnen.filter((b) => b.soort === 'html');

test('1. geen "alles tegelijk"-overgang in alle html, css en js in de hoofdmap', () => {
  const fouten = [];
  const bestanden = fs.readdirSync(ROOT).filter((f) => /\.(html|css|js)$/i.test(f)).sort();
  for (const f of bestanden) {
    const t = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
    const a = (t.match(/transition-all/g) || []).length;
    const c = (t.match(/transition(-property)?\s*:\s*all\b/g) || []).length;
    if (a + c) fouten.push(`${f}: ${a} x transition-all, ${c} x "transition: all"`);
  }
  assert.ok(bestanden.length >= 9, 'te weinig bestanden gescand');
  assert.deepEqual(fouten, [], `overgang op alles gevonden:\n${fouten.join('\n')}`);
});

test('2. alleen merkkleuren (en wit, zwart, goudtinten) in de stijlregels van alle 9 pagina\'s en alle css/js', () => {
  const fouten = [];
  for (const b of bronnen) {
    const tel = new Map();
    for (const d of b.declaraties) for (const [k, n] of foutKleuren(d)) tel.set(k, (tel.get(k) || 0) + n);
    for (const [k, n] of tel) fouten.push(`${b.naam}: ${k} (${n})`);
  }
  assert.deepEqual(fouten, [], `kleuren buiten de lijst:\n${fouten.join('\n')}`);
});

test('3. geen standaard Tailwind-kleuren in de class-attributen van de 9 pagina\'s', () => {
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

test('4. alle 9 pagina\'s laden Playfair Display en DM Sans; elke font-family begint daarmee (of is inherit)', () => {
  for (const b of paginaBronnen) {
    const fonts = [...b.tekst.matchAll(/<link\b[^>]*fonts\.googleapis\.com\/css2?[^>]*>/gi)].map((m) => m[0]).join(' ');
    assert.ok(/family=Playfair\+Display/.test(fonts), `${b.naam}: laadt Playfair Display niet via Google Fonts`);
    assert.ok(/family=DM\+Sans/.test(fonts), `${b.naam}: laadt DM Sans niet via Google Fonts`);
  }
  const fouten = familiesInBron(bronnen)
    .filter((f) => f.familie !== 'inherit' && !TOEGESTANE_FAMILIES.includes(f.familie))
    .map((f) => `${f.bestand}: font-family ${f.waarde}`);
  const uniek = [...new Set(fouten)];
  assert.deepEqual(uniek, [], `andere eerste familie dan Playfair Display of DM Sans:\n${uniek.join('\n')}`);
});

const gegevens = (naam) => {
  const html = leesHtml(naam);
  const deel = (id) => blok(html, 'id', id);
  return { html, bar: deel('announcement-bar'), nav: deel('main-nav'), mob: deel('mobile-menu'), foot: deel('footer') };
};
const alle = Object.fromEntries(PAGINAS.map((p) => [p, gegevens(p)]));
const lijst = (ls) => ls.map((l) => `${l.tekst} -> ${l.href}`);

function vergelijk(onderdeel, maak) {
  const fouten = [];
  const ref = maak(REF);
  for (const p of PAGINAS) {
    if (p === REF) continue;
    const w = maak(p);
    if (JSON.stringify(w) !== JSON.stringify(ref)) {
      fouten.push(`${p}: ${onderdeel} verschilt van ${REF}\n    ${REF}: ${JSON.stringify(ref)}\n    ${p}: ${JSON.stringify(w)}`);
    }
  }
  return fouten;
}

test('5a. tekst van #announcement-bar is op alle 9 gelijk', () => {
  for (const p of PAGINAS) assert.ok(alle[p].bar, `${p}: #announcement-bar ontbreekt`);
  const f = vergelijk('tekst #announcement-bar', (p) => tekst(alle[p].bar));
  assert.deepEqual(f, [], f.join('\n'));
});

test('5b. links in #main-nav (tekst + href, in volgorde) zijn op alle 9 gelijk', () => {
  for (const p of PAGINAS) assert.ok(alle[p].nav, `${p}: #main-nav ontbreekt`);
  const f = vergelijk('links #main-nav', (p) => lijst(links(alle[p].nav)));
  assert.deepEqual(f, [], f.join('\n'));
});

test('5c. links in #mobile-menu (tekst + href, in volgorde) zijn op alle 9 gelijk', () => {
  for (const p of PAGINAS) assert.ok(alle[p].mob, `${p}: #mobile-menu ontbreekt`);
  const f = vergelijk('links #mobile-menu', (p) => lijst(links(alle[p].mob)));
  assert.deepEqual(f, [], f.join('\n'));
});

test('5d. tekst van #footer is op alle 9 gelijk', () => {
  for (const p of PAGINAS) assert.ok(alle[p].foot, `${p}: #footer ontbreekt`);
  const f = vergelijk('tekst #footer', (p) => tekst(alle[p].foot));
  assert.deepEqual(f, [], f.join('\n'));
});

test('5e. links in #footer (tekst + href) zijn op alle 9 gelijk', () => {
  for (const p of PAGINAS) assert.ok(alle[p].foot, `${p}: #footer ontbreekt`);
  const f = vergelijk('links #footer', (p) => lijst(links(alle[p].foot)));
  assert.deepEqual(f, [], f.join('\n'));
});

test('6. geen onmouseover/onmouseout in de 9 pagina\'s', () => {
  const fouten = [];
  for (const b of paginaBronnen) {
    const n = (b.tekst.match(/\sonmouse(?:over|out)\s*=/gi) || []).length;
    if (n) fouten.push(`${b.naam}: ${n} x onmouseover/onmouseout`);
  }
  assert.deepEqual(fouten, [], fouten.join('\n'));
});

test('7. #hamburger-btn heeft op alle 9 pagina\'s een aria-label', () => {
  const fouten = [];
  for (const p of PAGINAS) {
    const m = alle[p].html.match(/<(button|a|div)\b((?:"[^"]*"|'[^']*'|[^>"'])*\bid\s*=\s*["']hamburger-btn["'](?:"[^"]*"|'[^']*'|[^>"'])*)>/i);
    if (!m) { fouten.push(`${p}: #hamburger-btn ontbreekt`); continue; }
    const a = m[2].match(/\baria-label\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    if (!a || !(a[1] ?? a[2]).trim()) fouten.push(`${p}: #hamburger-btn heeft geen aria-label`);
  }
  assert.deepEqual(fouten, [], fouten.join('\n'));
});
