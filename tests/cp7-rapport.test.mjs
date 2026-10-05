// cp7: het controlerapport en de beelden in de sessiemap (buiten de werkplek; YOLY_SESSIE overschrijft het pad).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SESSIE, PAGINAS } from './helpers.mjs';

const RAPPORT = path.join(SESSIE, 'controlerapport.md');
const BREEDTES = [1440, 375];
const combis = PAGINAS.flatMap((p) => BREEDTES.map((b) => ({ p, b, naam: `${p}-${b}.png` })));
const meld = (l) => (l.length ? '\n  ' + l.join('\n  ') : '');
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function rapport() {
  assert.ok(fs.existsSync(RAPPORT), `controlerapport ontbreekt: ${RAPPORT}`);
  const tekst = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(RAPPORT));
  return tekst.replace(/^﻿/, '');
}
function sectie(tekst, kop) {
  const m = new RegExp(`^##\\s+${kop}\\s*$`, 'mi').exec(tekst);
  if (!m) return null;
  const rest = tekst.slice(m.index + m[0].length);
  const volgende = rest.search(/^##\s/m);
  return volgende === -1 ? rest : rest.slice(0, volgende);
}
function rijen(sec) {
  return sec.split(/\r?\n/).map((r) => r.trim()).filter((r) => r.startsWith('|'))
    .map((r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
    .filter((c) => !c.every((x) => /^:?-{2,}:?$/.test(x)))
    .slice(1); // kopregel van de tabel
}
const paginaRe = (p) => new RegExp(`(^|[^\\w-])${p}(\\.html)?([^\\w-]|$)`, 'i');
const noemtPagina = (cel) => /alle pagina'?s/i.test(cel) || PAGINAS.some((p) => paginaRe(p).test(cel));

function pngInfo(pad) {
  if (!fs.existsSync(pad)) return { fout: `bestaat niet: ${pad}` };
  const buf = fs.readFileSync(pad);
  if (buf.length < 10 * 1024) return { fout: `kleiner dan 10 kB (${buf.length} bytes): ${pad}` };
  if (!buf.subarray(0, 8).equals(SIG)) return { fout: `geen png-handtekening: ${pad}` };
  return { breedte: buf.readUInt32BE(16), pad };
}

test('14 het controlerapport ligt er met de vaste koppen', () => {
  const t = rapport();
  const mist = ['Gevonden en opgelost', 'Niet opgelost', 'Gecontroleerd'].filter((k) => sectie(t, k) === null).map((k) => `## ${k}`);
  assert.deepEqual(mist, [], `koppen ontbreken in ${RAPPORT}:` + meld(mist));
});

test('15 opgeloste punten hebben pagina, probleem en oplossing, en er is een rij voor over.html', () => {
  const sec = sectie(rapport(), 'Gevonden en opgelost');
  assert.ok(sec !== null, `kop "## Gevonden en opgelost" ontbreekt in ${RAPPORT}`);
  const r = rijen(sec);
  assert.ok(r.length >= 1, 'geen enkele tabelrij onder "Gevonden en opgelost"');
  const slecht = r.map((c, i) => ({ c, i })).filter(({ c }) => c.length < 3 || c.slice(0, 3).some((x) => !x) || !noemtPagina(c[0]))
    .map(({ c, i }) => `rij ${i + 1}: ${c.join(' | ')}`);
  assert.deepEqual(slecht, [], 'rijen zonder drie gevulde cellen of zonder paginanaam:' + meld(slecht));
  assert.ok(r.some((c) => paginaRe('over').test(c[0])), 'geen rij voor over.html (svg-fouten uit de nulmeting)');
});

test('16 niet-opgeloste punten staan apart, met reden van minstens 15 tekens', () => {
  const sec = sectie(rapport(), 'Niet opgelost');
  assert.ok(sec !== null, `kop "## Niet opgelost" ontbreekt in ${RAPPORT}`);
  const r = rijen(sec);
  if (r.length === 0) {
    assert.ok(/^\s*Geen\.\s*$/m.test(sec), 'onder "Niet opgelost" staat geen tabelrij en ook niet de regel "Geen."');
    return;
  }
  const slecht = r.map((c, i) => ({ c, i })).filter(({ c }) => c.length < 3 || c.slice(0, 3).some((x) => !x) || c[2].length < 15)
    .map(({ c, i }) => `rij ${i + 1}: ${c.join(' | ')}`);
  assert.deepEqual(slecht, [], 'rijen zonder drie gevulde cellen of met reden < 15 tekens:' + meld(slecht));
});

test("17 alle 9 pagina's komen voor onder \"Gecontroleerd\", elk met 1440 en 375", () => {
  const sec = sectie(rapport(), 'Gecontroleerd');
  assert.ok(sec !== null, `kop "## Gecontroleerd" ontbreekt in ${RAPPORT}`);
  const regels = sec.split(/\r?\n/);
  const mist = [];
  for (const p of PAGINAS) {
    const idx = regels.map((l, i) => (paginaRe(p).test(l) ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) { mist.push(`${p}: niet genoemd`); continue; }
    const blok = idx.map((i) => regels.slice(i, i + 3).join(' ')).join(' ');
    for (const b of BREEDTES) if (!blok.includes(String(b))) mist.push(`${p}: ${b} niet genoemd bij de pagina`);
  }
  assert.deepEqual(mist, [], '"Gecontroleerd" is onvolledig:' + meld(mist));
});

test('18 18 na-beelden: png, > 10 kB, breedte precies 1440 of 375', () => {
  const fouten = combis.map(({ b, naam }) => {
    const i = pngInfo(path.join(SESSIE, 'na', naam));
    if (i.fout) return i.fout;
    return i.breedte === b ? null : `breedte ${i.breedte} in plaats van ${b}: ${i.pad}`;
  }).filter(Boolean);
  assert.deepEqual(fouten, [], 'na-beelden:' + meld(fouten));
});

function nieuwsteBron() {
  const kand = fs.readdirSync(ROOT).filter((f) => /\.(html|css|js)$/i.test(f)).map((f) => ({ f, t: fs.statSync(path.join(ROOT, f)).mtimeMs }));
  return kand.reduce((a, b) => (b.t > a.t ? b : a));
}
test('19 na-beelden zijn gemaakt na de laatste wijziging van html, css en js van de site', () => {
  const nieuw = nieuwsteBron();
  const fouten = [];
  for (const { naam } of combis) {
    const pad = path.join(SESSIE, 'na', naam);
    if (!fs.existsSync(pad)) { fouten.push(`na-beeld ontbreekt: ${pad}`); continue; }
    const t = fs.statSync(pad).mtimeMs;
    if (t <= nieuw.t) fouten.push(`${naam} (${new Date(t).toISOString()}) is ouder dan ${nieuw.f} (${new Date(nieuw.t).toISOString()})`);
  }
  assert.deepEqual(fouten, [], `na-beelden ouder dan de nieuwste site-wijziging (${nieuw.f}):` + meld(fouten));
});

test('20 18 voor-beelden bestaan nog in voor\\', () => {
  const fouten = combis.map(({ naam }) => path.join(SESSIE, 'voor', naam)).filter((p) => !fs.existsSync(p)).map((p) => `ontbreekt: ${p}`);
  assert.deepEqual(fouten, [], 'voor-beelden:' + meld(fouten));
});

test('21 18 voor/na-beelden: png, > 10 kB, minstens twee keer zo breed als een beeld', () => {
  const fouten = combis.map(({ b, naam }) => {
    const i = pngInfo(path.join(SESSIE, 'voor-na', naam));
    if (i.fout) return i.fout;
    const min = b === 1440 ? 2880 : 750;
    return i.breedte >= min ? null : `breedte ${i.breedte} is kleiner dan ${min}: ${i.pad}`;
  }).filter(Boolean);
  assert.deepEqual(fouten, [], 'voor-na-beelden:' + meld(fouten));
});
