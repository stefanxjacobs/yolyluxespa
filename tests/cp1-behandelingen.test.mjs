// cp1: inhoud van behandelingen.html, zonder browser. Hangt alleen aan id, data-treatment en zichtbare tekst.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leesHtml, blok, blokken, tekst, koppen, lijstpunten, links, bedragen, duur } from './helpers.mjs';
import { BEHANDELINGEN, IDS, PAGINAKOP } from './aanbod.mjs';

const html = leesHtml('behandelingen');
const NIET_NODIG = (s) => s.replace(/[→✦]/g, '');
const dash = (s) => s.replace(/[–—]/g, '-');

function blokVan(id) {
  const b = blok(html, 'data-treatment', id);
  assert.ok(b, `er is geen element met data-treatment="${id}"`);
  return b;
}

test('1. precies 6 behandelingen, in volgorde van Yoly, id gelijk aan data-treatment', () => {
  const bl = blokken(html, 'data-treatment');
  assert.deepEqual(bl.map((b) => b.waarde), IDS);
  for (const b of bl) {
    const open = b.html.match(/^<[a-zA-Z][\w-]*(?:"[^"]*"|'[^']*'|[^>"'])*>/)[0];
    assert.match(open, new RegExp(`\\bid\\s*=\\s*["']${b.waarde}["']`), `id ontbreekt of wijkt af bij ${b.waarde}`);
  }
});

for (const b of BEHANDELINGEN) {
  test(`2. naam: ${b.naam}`, () => {
    assert.ok(koppen(blokVan(b.id)).includes(b.naam), `kop "${b.naam}" ontbreekt; koppen: ${JSON.stringify(koppen(blokVan(b.id)))}`);
  });

  test(`3. prijs: ${b.naam}`, () => {
    const bl = blokVan(b.id);
    if (b.prijs === null) {
      assert.deepEqual(bedragen(bl), []);
      assert.ok(tekst(bl).includes('Prijs op aanvraag'));
    } else {
      assert.deepEqual(bedragen(bl), [b.prijs]);
    }
  });

  test(`4. duur: ${b.naam}`, () => {
    const bl = blokVan(b.id);
    if (b.duurNorm === null) {
      assert.equal(duur(bl), null);
      assert.ok(!tekst(bl).includes('±'), 'bij Melanin Glow mag geen ± staan');
    } else {
      assert.equal(duur(bl), b.duurNorm);
      const re = new RegExp(`±\\s*${b.duurNorm.replace('-', '\\s*-\\s*')}\\s*min`);
      assert.match(dash(tekst(bl)), re, `"${b.duurTekst}" ontbreekt`);
    }
  });

  test(`5. Yoly's tekst woord voor woord: ${b.naam}`, () => {
    const t = tekst(blokVan(b.id));
    for (const zin of b.zinnen) assert.ok(t.includes(zin), `zin ontbreekt: ${zin}`);
    if (b.extra) {
      assert.ok(t.includes(b.extra.zin), `extra regel ontbreekt: ${b.extra.zin}`);
      if (b.extra.kop) assert.ok(t.includes(b.extra.kop), `kop ontbreekt: ${b.extra.kop}`);
    }
  });

  test(`6. lijst: ${b.naam}`, () => {
    const bl = blokVan(b.id);
    if (b.lijstkop) assert.ok(tekst(bl).includes(b.lijstkop), `lijstkop ontbreekt: ${b.lijstkop}`);
    assert.deepEqual(lijstpunten(bl), b.punten);
  });

  test(`7. knop Afspraak maken: ${b.naam}`, () => {
    const knoppen = links(blokVan(b.id)).filter((l) => l.href === 'afspraak.html');
    assert.equal(knoppen.length, 1, `verwacht precies 1 link naar afspraak.html, gevonden ${knoppen.length}`);
    assert.match(knoppen[0].tekst, /^Afspraak maken(\s*→)?$/);
  });

  test(`9. geen Vanaf, geen emoji: ${b.naam}`, () => {
    const t = NIET_NODIG(tekst(blokVan(b.id)));
    assert.ok(!/vanaf/i.test(t), 'het woord Vanaf staat erin');
    assert.ok(!/\p{Extended_Pictographic}/u.test(t), 'er staat een emoji in');
  });

  test(`11. oude namen niet op de kaart: ${b.naam}`, () => {
    const t = tekst(blokVan(b.id));
    for (const oud of ['Basis Reiniging', 'Diepe Gezichtsreiniging', 'Hydra Glow Lips']) {
      assert.ok(!t.includes(oud), `oude naam "${oud}" staat nog op de kaart`);
    }
  });
}

test('8. paginakop: precies een h1 met Yoly\'s kop en de twee zinnen vóór de eerste behandeling', () => {
  const schoon = html
    .replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length))
    .replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, a, b, c) => a + ' '.repeat(b.length) + c)
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, a, b, c) => a + ' '.repeat(b.length) + c);
  const h1s = [...schoon.matchAll(/<h1\b/gi)];
  assert.equal(h1s.length, 1, `verwacht 1 h1, gevonden ${h1s.length}`);
  const alleH1 = koppen(html).length ? koppen(html) : [];
  const h1Tekst = tekst(schoon.slice(h1s[0].index, schoon.indexOf('</h1>', h1s[0].index) + 5));
  assert.equal(h1Tekst, PAGINAKOP.h1);
  assert.ok(alleH1.includes(PAGINAKOP.h1));
  const eerste = blokken(html, 'data-treatment')[0];
  assert.ok(eerste, 'geen eerste behandeling gevonden');
  assert.ok(h1s[0].index < eerste.start, 'de h1 staat niet vóór de eerste behandeling');
  const tussen = tekst(html.slice(h1s[0].index, eerste.start));
  for (const zin of PAGINAKOP.zinnen) assert.ok(tussen.includes(zin), `zin staat niet tussen h1 en eerste behandeling: ${zin}`);
});

test('10. oude kaarten weg (B3)', () => {
  assert.equal(blok(html, 'id', 'masker'), null, 'element met id="masker" bestaat nog');
  assert.equal(blok(html, 'id', 'steaming'), null, 'element met id="steaming" bestaat nog');
  assert.equal(html.split('Stoombehandeling').length - 1, 0, '"Stoombehandeling" komt nog voor');
  assert.equal(html.split('Gouden Masker').length - 1, 0, '"Gouden Masker" komt nog voor');
});

test('12. de link in de balk bovenaan landt op iets dat bestaat', () => {
  const balk = blok(html, 'id', 'announcement-bar');
  assert.ok(balk, '#announcement-bar bestaat niet');
  const doelen = links(balk)
    .map((l) => (l.href || '').match(/^(?:behandelingen\.html)?#(.+)$/))
    .filter(Boolean)
    .map((m) => m[1]);
  assert.ok(doelen.length >= 1, 'de balk heeft geen link naar #<id> of behandelingen.html#<id>');
  for (const id of doelen) {
    assert.ok([...IDS, 'packages'].includes(id), `de link wijst naar #${id}, dat is geen behandeling of packages`);
    assert.ok(blok(html, 'id', id), `er staat geen element met id="${id}" in de pagina`);
    if (id !== 'packages') {
      assert.ok(blokken(html, 'data-treatment').some((b) => b.waarde === id), `#${id} heeft geen data-treatment`);
    }
  }
});
