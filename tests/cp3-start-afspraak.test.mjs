// cp3: index.html en afspraak.html tonen hetzelfde aanbod als behandelingen.html (zonder browser).
// Hangt alleen aan data-treatment, id="tekstband" en zichtbare tekst.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leesHtml, blokken, blok, tekst, koppen, bedragen, duur } from './helpers.mjs';
import { BEHANDELINGEN, IDS } from './aanbod.mjs';

const index = leesHtml('index');
const afspraak = leesHtml('afspraak');
const behandel = leesHtml('behandelingen');

// Naam die op afspraak.html moet voorkomen (bevat).
const AFSPRAAKNAAM = { basis: 'Basic Facial' };
const afspraakNaam = (b) => AFSPRAAKNAAM[b.id] || b.naam;
const EMOJI = /\p{Extended_Pictographic}/u;

const waarden = (html) => blokken(html, 'data-treatment').map((b) => b.waarde);

test('1. index: precies 6 kaarten met data-treatment, elk een keer', () => {
  assert.deepEqual([...waarden(index)].sort(), [...IDS].sort());
});

for (const b of BEHANDELINGEN) {
  test(`2. index: kaart ${b.id} heeft dezelfde naam als op de behandelpagina`, () => {
    const kaart = blok(index, 'data-treatment', b.id);
    assert.ok(kaart, `geen kaart ${b.id} op index.html`);
    assert.ok(koppen(kaart).includes(b.naam), `kop "${b.naam}" ontbreekt in de kaart; koppen: ${JSON.stringify(koppen(kaart))}`);
    const op = blok(behandel, 'data-treatment', b.id);
    assert.ok(op && koppen(op).includes(b.naam), 'naam ontbreekt op behandelingen.html');
  });

  test(`3. index: kaart ${b.id} heeft dezelfde prijs als op de behandelpagina`, () => {
    const kaart = blok(index, 'data-treatment', b.id);
    assert.ok(kaart, `geen kaart ${b.id} op index.html`);
    const op = blok(behandel, 'data-treatment', b.id);
    assert.deepEqual(bedragen(kaart), bedragen(op));
    if (b.prijs === null) {
      assert.deepEqual(bedragen(kaart), []);
      assert.ok(tekst(kaart).includes('Prijs op aanvraag'), 'Prijs op aanvraag ontbreekt');
    } else {
      assert.deepEqual(bedragen(kaart), [b.prijs]);
    }
  });
}

test('4. index: tekstband noemt de 6 nieuwe namen en niets anders', () => {
  const band = blok(index, 'id', 'tekstband');
  assert.ok(band, 'geen element met id="tekstband" op index.html');
  let t = tekst(band);
  for (const b of BEHANDELINGEN) {
    const opties = b.id === 'basis' ? ['Yoly Luxe Basic Facial', 'Basic Facial'] : [b.naam];
    assert.ok(opties.some((o) => t.includes(o)), `tekstband noemt ${b.naam} niet`);
  }
  const namen = ['Yoly Luxe Basic Facial', 'Basic Facial', ...BEHANDELINGEN.map((b) => b.naam)].sort((x, y) => y.length - x.length);
  for (const n of namen) t = t.split(n).join(' ');
  t = t.replace(/[◆✦·•|\s]/g, '');
  assert.equal(t, '', `de tekstband bevat meer dan de 6 namen: "${t}"`);
});

test('5. afspraak: precies 6 regels met data-treatment', () => {
  assert.deepEqual([...waarden(afspraak)].sort(), [...IDS].sort());
});

for (const b of BEHANDELINGEN) {
  test(`6. afspraak: regel ${b.id} heeft dezelfde naam, prijs en duur als de behandelpagina`, () => {
    const regel = blok(afspraak, 'data-treatment', b.id);
    assert.ok(regel, `geen regel ${b.id} op afspraak.html`);
    const op = blok(behandel, 'data-treatment', b.id);
    assert.ok(tekst(regel).includes(afspraakNaam(b)), `naam "${afspraakNaam(b)}" ontbreekt`);
    assert.deepEqual(bedragen(regel), bedragen(op));
    if (b.prijs === null) {
      assert.ok(tekst(regel).includes('Prijs op aanvraag'), 'Prijs op aanvraag ontbreekt');
      assert.deepEqual(bedragen(regel), []);
      assert.equal(duur(regel), null, 'Melanin Glow heeft geen duur');
    } else {
      assert.deepEqual(bedragen(regel), [b.prijs]);
      assert.equal(duur(regel), duur(op));
      assert.equal(duur(regel), b.duurNorm);
    }
  });
}

test('7. afspraak: het infoblok over het gouden masker is weg', () => {
  assert.equal((afspraak.match(/gouden masker/gi) || []).length, 0);
});

for (const [naam, html] of [['index', index], ['afspraak', afspraak]]) {
  test(`8. ${naam}: geen oude prijzen (35, 50, 70, 45)`, () => {
    assert.deepEqual(html.match(/(€|&euro;)\s?(35|50|70|45)\b/g) || [], []);
  });
  test(`9. ${naam}: geen "Basis Reiniging"`, () => {
    assert.equal((html.match(/basis reiniging/gi) || []).length, 0);
  });
}

test('10. geen "Vanaf" en geen emoji in de kaarten (index) en regels (afspraak)', () => {
  for (const [naam, html] of [['index', index], ['afspraak', afspraak]]) {
    for (const b of blokken(html, 'data-treatment')) {
      const t = tekst(b.html);
      assert.ok(!/vanaf/i.test(t), `"Vanaf" in ${naam} ${b.waarde}`);
      assert.ok(!EMOJI.test(t), `emoji in ${naam} ${b.waarde}: ${t}`);
    }
  }
});

test('11. tekstband bevat geen oude behandelingen', () => {
  const band = blok(index, 'id', 'tekstband');
  assert.ok(band, 'geen element met id="tekstband" op index.html');
  const t = tekst(band).toLowerCase();
  for (const oud of ['Basis Reiniging', 'Diepe Gezichtsreiniging', 'Hydra Glow Lips', 'Gouden Masker', 'Stoombehandeling']) {
    assert.ok(!t.includes(oud.toLowerCase()), `oude behandeling in de tekstband: ${oud}`);
  }
});

test('12. geen zevende kaart: alleen bekende data-treatment-waarden', () => {
  for (const [naam, html] of [['index', index], ['afspraak', afspraak]]) {
    const vreemd = waarden(html).filter((w) => !IDS.includes(w));
    assert.deepEqual(vreemd, [], `onbekende data-treatment op ${naam}`);
  }
});

test('13. afspraak: de Calendly-agenda staat er nog (bewaker)', () => {
  assert.match(afspraak, /<[a-z]+\b[^>]*class\s*=\s*["'][^"']*calendly-inline-widget[^"']*["'][^>]*>/i);
  assert.match(afspraak, /data-url\s*=\s*["']https:\/\/calendly\.com\/yolyluxespa/i);
  assert.match(afspraak, /https:\/\/assets\.calendly\.com\/assets\/external\/widget\.js/);
});
