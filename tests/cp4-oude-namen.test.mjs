// cp4: oude namen en oude prijzen zijn weg op de rest van de site (zonder browser).
// Hangt alleen aan #announcement-bar, data-video-label, data-quote-label, #modal-a1..a6,
// tests/bewust-behouden.json en zichtbare tekst. Nooit aan klassenamen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, PAGINAS, leesHtml, blokken, blok, tekst, koppen, lijstpunten, links, bedragen } from './helpers.mjs';

const VIER = ['index', 'behandelingen', 'afspraak', 'blog'];
const html = Object.fromEntries(PAGINAS.map((p) => [p, leesHtml(p)]));
const NIEUWE_NAMEN = ['Basic Facial', 'Deep Clean Facial', 'HydraFacial', 'Dermapen', 'Lip Hydration', 'Melanin Glow'];
const OUD_PRIJS = /(€|&euro;)\s?(35|50|70|45)\b/;
const BALK = 'Nieuw: Yoly Luxe Packages. Voordeliger bij 3 of 5 behandelingen.';
const LIJST_PAD = path.join(ROOT, 'tests', 'bewust-behouden.json');
const TERMEN = { 'Gouden Masker': /gouden\s+masker/i, 'Hydra Glow Lips': /hydra\s+glow\s+lips/i };

const regels = (naam) => html[naam].split(/\r?\n/);
const kort = (r) => r.trim().slice(0, 160);
const telNieuw = (s) => NIEUWE_NAMEN.filter((n) => s.toLowerCase().includes(n.toLowerCase())).length;
const metaDescription = (naam) => {
  const m = html[naam].match(/<meta\s+[^>]*name\s*=\s*["']description["'][^>]*>/i);
  assert.ok(m, `${naam}.html: geen <meta name="description">`);
  const c = m[0].match(/content\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  assert.ok(c, `${naam}.html: meta description zonder content`);
  return c[1] ?? c[2];
};
const artikel = (id) => blok(html.blog, 'id', `modal-${id}`);
const kaart = (id) => {
  const k = blokken(html.blog, 'onclick').find((b) => b.waarde.includes(`'${id}'`) || b.waarde.includes(`"${id}"`));
  return k ? k.html : null;
};

// Laad de lijst "bewust behouden"; geeft { items, fouten } terug. Gooit niet.
function laadLijst() {
  if (!fs.existsSync(LIJST_PAD)) return { items: [], fouten: ['tests/bewust-behouden.json ontbreekt (de bouwer maakt dit bestand)'] };
  let data;
  try { data = JSON.parse(fs.readFileSync(LIJST_PAD, 'utf8')); } catch (e) { return { items: [], fouten: [`tests/bewust-behouden.json is geen geldige JSON: ${e.message}`] }; }
  if (!Array.isArray(data)) return { items: [], fouten: ['tests/bewust-behouden.json moet een JSON-lijst zijn'] };
  return { items: data, fouten: [] };
}

// Alle treffers van een zoekterm in de vier pagina's, per regel.
function treffers(term) {
  const uit = [];
  for (const naam of VIER) regels(naam).forEach((r, i) => { if (TERMEN[term].test(r)) uit.push({ bestand: `${naam}.html`, regel: i + 1, tekst: r }); });
  return uit;
}

const dekt = (item, t, term) => item && item.bestand === t.bestand && item.zoekterm === term && typeof item.tekst === 'string' && t.tekst.includes(item.tekst);

test('1. de balk bovenaan is op alle 9 pagina\'s gelijk en nieuw (B7)', () => {
  for (const p of PAGINAS) {
    const b = blok(html[p], 'id', 'announcement-bar');
    assert.ok(b, `${p}.html: geen #announcement-bar`);
    assert.ok(tekst(b).startsWith(BALK), `${p}.html: balk begint niet met "${BALK}"; nu: "${tekst(b).slice(0, 120)}"`);
    assert.ok(!/hydra\s+glow\s+lips/i.test(tekst(b)), `${p}.html: balk noemt nog Hydra Glow Lips`);
    const l = links(b);
    assert.equal(l.length, 1, `${p}.html: balk moet precies één link hebben, heeft ${l.length}`);
    const toegestaan = p === 'behandelingen' ? ['behandelingen.html#packages', '#packages'] : ['behandelingen.html#packages'];
    assert.ok(toegestaan.includes(l[0].href), `${p}.html: balklink is "${l[0].href}", verwacht ${toegestaan.join(' of ')}`);
  }
  assert.ok(blok(html.behandelingen, 'id', 'packages'), 'behandelingen.html heeft geen id="packages"');
});

test('2. oude prijzen (€35, €50, €70, €45): nul treffers', () => {
  const gevonden = [];
  for (const naam of VIER) regels(naam).forEach((r, i) => { if (OUD_PRIJS.test(r)) gevonden.push(`${naam}.html:${i + 1}: ${kort(r)}`); });
  assert.deepEqual(gevonden, [], `oude prijzen gevonden:\n${gevonden.join('\n')}`);
});

test('3. "Basis Reiniging": nul treffers', () => {
  const gevonden = [];
  for (const naam of VIER) regels(naam).forEach((r, i) => { if (/basis\s+reiniging/i.test(r)) gevonden.push(`${naam}.html:${i + 1}: ${kort(r)}`); });
  assert.deepEqual(gevonden, [], `"Basis Reiniging" gevonden:\n${gevonden.join('\n')}`);
});

test('4. "Gouden Masker" en "Hydra Glow Lips": alleen treffers die op de lijst staan', () => {
  const { items, fouten } = laadLijst();
  assert.deepEqual(fouten, [], fouten.join('; '));
  const ongedekt = [];
  for (const term of Object.keys(TERMEN)) {
    for (const t of treffers(term)) {
      if (!items.some((it) => dekt(it, t, term))) ongedekt.push(`${t.bestand}:${t.regel}: ${kort(t.tekst)}  [${term}]`);
    }
  }
  assert.deepEqual(ongedekt, [], `treffers die niet op de lijst staan:\n${ongedekt.join('\n')}`);
});

test('5. de lijst bewust-behouden.json is geldig', () => {
  const { items, fouten } = laadLijst();
  assert.deepEqual(fouten, [], fouten.join('; '));
  const mis = [];
  items.forEach((it, i) => {
    const wie = `item ${i + 1} (${JSON.stringify(it).slice(0, 120)})`;
    if (!it || typeof it !== 'object') { mis.push(`${wie}: geen object`); return; }
    const eigen = [];
    if (!['index.html', 'behandelingen.html', 'afspraak.html', 'blog.html'].includes(it.bestand)) eigen.push(`${wie}: onbekend bestand`);
    if (!Object.keys(TERMEN).includes(it.zoekterm)) eigen.push(`${wie}: zoekterm moet "Gouden Masker" of "Hydra Glow Lips" zijn`);
    if (typeof it.tekst !== 'string' || it.tekst.length < 12) eigen.push(`${wie}: tekst korter dan 12 tekens`);
    if (typeof it.reden !== 'string' || it.reden.trim().length < 15) eigen.push(`${wie}: reden korter dan 15 tekens of leeg`);
    if (eigen.length) { mis.push(...eigen); return; }
    const geraakt = treffers(it.zoekterm).some((t) => t.bestand === it.bestand && t.tekst.includes(it.tekst));
    if (!geraakt) mis.push(`${wie}: dekt geen echte treffer (verouderd item)`);
  });
  assert.deepEqual(mis, [], mis.join('\n'));
});

test('6. de vier blogartikelen staan er nog (B6) - bewaker', () => {
  for (const id of ['a1', 'a2', 'a3', 'a4']) {
    assert.ok(kaart(id), `blog.html: geen kaart voor ${id}`);
    const a = artikel(id);
    assert.ok(a, `blog.html: geen #modal-${id}`);
    assert.ok(koppen(a).length >= 1, `#modal-${id}: geen kop`);
    const n = (a.match(/<p\b/gi) || []).length + lijstpunten(a).length;
    assert.ok(n >= 3, `#modal-${id}: minder dan 3 alinea's/lijstpunten (${n})`);
  }
});

test('7. het gouden-masker-artikel is een achtergrondartikel', () => {
  const stukken = { 'modal-a4': artikel('a4'), 'kaart a4': kaart('a4') };
  for (const [naam, s] of Object.entries(stukken)) {
    assert.ok(s, `blog.html: ${naam} ontbreekt`);
    const t = tekst(s);
    assert.ok(!t.includes('€'), `${naam}: bevat een prijs (€)`);
    assert.ok(!/\bprijs\b/i.test(t), `${naam}: bevat het woord "Prijs"`);
    const slecht = links(s).filter((l) => /gouden\s+masker/i.test(l.tekst));
    assert.deepEqual(slecht, [], `${naam}: link met "gouden masker": ${JSON.stringify(slecht)}`);
    const knoppen = (s.match(/<button\b[\s\S]*?<\/button>/gi) || []).map(tekst).filter((x) => /gouden\s+masker/i.test(x));
    assert.deepEqual(knoppen, [], `${naam}: knop met "gouden masker": ${JSON.stringify(knoppen)}`);
  }
});

test('8. prijzen in de blog zijn prijzen van de behandelpagina', () => {
  const op = new Set(bedragen(html.behandelingen));
  const vreemd = [...new Set(bedragen(html.blog))].filter((b) => !op.has(b));
  assert.deepEqual(vreemd, [], `bedragen in blog.html die niet op behandelingen.html staan: ${vreemd.join(', ')}`);
  const a3 = bedragen(artikel('a3') || '').filter((b) => ![95, 270, 425].includes(b));
  assert.deepEqual(a3, [], `#modal-a3: bedragen buiten 95/270/425: ${a3.join(', ')}`);
  const a2 = bedragen(artikel('a2') || '').filter((b) => b !== 30);
  assert.deepEqual(a2, [], `#modal-a2: bedragen anders dan 30: ${a2.join(', ')}`);
});

test('9. korte paginabeschrijving voor zoekmachines noemt alleen nieuwe namen', () => {
  const OUD = ['Diepe Gezichtsreiniging', 'Hydra Glow Lips', 'Basis Reiniging', 'Gouden Masker', 'Stoombehandeling'];
  for (const p of ['index', 'behandelingen', 'blog']) {
    const d = metaDescription(p);
    const oud = OUD.filter((o) => d.toLowerCase().includes(o.toLowerCase()));
    assert.deepEqual(oud, [], `${p}.html: meta description noemt oude namen ${oud.join(', ')}: "${d}"`);
  }
  for (const p of ['index', 'behandelingen']) {
    const d = metaDescription(p);
    assert.ok(telNieuw(d) >= 2, `${p}.html: meta description noemt ${telNieuw(d)} nieuwe namen, minstens 2 nodig: "${d}"`);
  }
});

test('10. onderschriften bij de video\'s', () => {
  const labels = blokken(html.behandelingen, 'data-video-label');
  assert.ok(labels.length >= 1, 'behandelingen.html: geen enkel [data-video-label]');
  const VERBODEN = ['Hydra Glow Lips', 'Masker behandeling', 'Steamer behandeling', 'Gezichtsmasker', 'Stoombehandeling', 'Gouden Masker'];
  for (const l of labels) {
    const t = tekst(l.html);
    assert.ok(telNieuw(t) >= 1, `onderschrift "${t}" noemt geen nieuwe behandelnaam`);
    const slecht = VERBODEN.filter((v) => t.toLowerCase().includes(v.toLowerCase()));
    assert.deepEqual(slecht, [], `onderschrift "${t}" bevat oude naam ${slecht.join(', ')}`);
  }
});

test('11. labels onder klantquotes (B5)', () => {
  assert.ok(tekst(html.index).includes('De Hydra Glow Lips behandeling is fantastisch'), 'index.html: de zin van de klant ontbreekt of is aangepast');
  for (const naam of VIER) {
    const r = regels(naam).map((x, i) => [i + 1, x]).filter(([, x]) => x.includes('Diepe Gezichtsreiniging'));
    assert.deepEqual(r.map(([n, x]) => `${naam}.html:${n}: ${kort(x)}`), [], '"Diepe Gezichtsreiniging" staat er nog');
  }
  const labels = blokken(html.index, 'data-quote-label').map((l) => tekst(l.html));
  assert.ok(labels.length >= 1, 'index.html: geen enkel [data-quote-label]');
  const samen = labels.join(' | ');
  assert.ok(samen.includes('Lipbehandeling'), `labels bevatten geen "Lipbehandeling": ${samen}`);
  assert.ok(samen.includes('Deep Clean Facial'), `labels bevatten geen "Deep Clean Facial": ${samen}`);
  for (const l of labels) {
    assert.ok(!/hydra glow lips|diepe gezichtsreiniging/i.test(l), `label "${l}" bevat een oude naam`);
  }
});

test('12. gegevens voor zoekmachines in blog.html: geen oude prijs, geen Basis Reiniging', () => {
  const scripts = [...html.blog.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)].map((m) => m[1]);
  assert.ok(scripts.length >= 1, 'blog.html: geen application/ld+json');
  scripts.forEach((s, i) => {
    assert.ok(!OUD_PRIJS.test(s), `ld+json #${i + 1}: bevat een oude prijs`);
    assert.ok(!/basis\s+reiniging/i.test(s), `ld+json #${i + 1}: bevat "Basis Reiniging"`);
    assert.ok(!/"(?:price|lowPrice|highPrice)"\s*:\s*"?(?:35|50|70|45)\b/.test(s), `ld+json #${i + 1}: oude prijs als getal`);
  });
});

test('13. schrijfwijzen van het euroteken', () => {
  for (const s of ['€ 35', '€35', '&euro;35', '€70']) assert.ok(OUD_PRIJS.test(s), `${s} moet treffer zijn`);
  for (const s of ['€355', '35 min', '€ 350']) assert.ok(!OUD_PRIJS.test(s), `${s} mag geen treffer zijn`);
});

test('14. "Stoombehandeling" komt niet meer voor op behandelingen.html en index.html (B3)', () => {
  for (const naam of ['behandelingen', 'index']) {
    const r = regels(naam).map((x, i) => [i + 1, x]).filter(([, x]) => /stoombehandeling/i.test(x));
    assert.deepEqual(r.map(([n, x]) => `${naam}.html:${n}: ${kort(x)}`), [], '"Stoombehandeling" staat er nog');
  }
});

test('15. nieuwe inhoud niet per ongeluk verdwenen (rooktest) - bewaker', () => {
  assert.equal(blokken(html.behandelingen, 'data-treatment').length, 6, 'behandelingen.html: niet 6x data-treatment');
  assert.ok(blok(html.behandelingen, 'id', 'packages'), 'geen #packages');
  assert.ok(blok(html.behandelingen, 'id', 'jouw-moment'), 'geen #jouw-moment');
});
