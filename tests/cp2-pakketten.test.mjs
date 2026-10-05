// cp2: pakketblok en slotblok op behandelingen.html, zonder browser.
// Hangt alleen aan id="packages", data-package, id="jouw-moment", data-treatment en zichtbare tekst.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leesHtml, blok, blokken, tekst, koppen, links, bedragen } from './helpers.mjs';
import { PAKKETTEN, SLOT } from './aanbod.mjs';

const html = leesHtml('behandelingen');
const GROEPEN = ['basis', 'diepe', 'hydrafacial'];
const packages = () => {
  const b = blok(html, 'id', 'packages');
  assert.ok(b, 'pakketblok ontbreekt: geen element met id="packages"');
  return b;
};
const slot = () => {
  const b = blok(html, 'id', 'jouw-moment');
  assert.ok(b, 'slotblok ontbreekt: geen element met id="jouw-moment"');
  return b;
};
const groep = (id) => {
  const g = blokken(packages(), 'data-package').find((x) => x.waarde === id);
  assert.ok(g, `pakketgroep ontbreekt: geen data-package="${id}" in #packages`);
  return g.html;
};
const startVan = (attr, waarde) => {
  const b = blokken(html, attr).find((x) => x.waarde === waarde);
  assert.ok(b, `geen element met ${attr}="${waarde}"`);
  return b.start;
};
const EMOJI = /\p{Extended_Pictographic}/u;

test('1. het pakketblok staat er en heet Yoly Luxe Packages', () => {
  assert.ok(tekst(packages()).includes('Yoly Luxe Packages'));
});

test('2. drie groepen in de juiste volgorde met hun naam', () => {
  const ids = blokken(packages(), 'data-package').map((g) => g.waarde);
  assert.deepEqual(ids, GROEPEN);
  for (const id of GROEPEN) assert.ok(tekst(groep(id)).includes(PAKKETTEN[id].naam), `naam ${PAKKETTEN[id].naam} ontbreekt in groep ${id}`);
});

test('3. de 9 prijzen kloppen', () => {
  for (const id of GROEPEN) assert.deepEqual(bedragen(groep(id)), PAKKETTEN[id].prijzen, `prijzen van ${id}`);
  assert.equal(bedragen(packages()).length, 9);
});

test('4. elk bedrag hoort bij het juiste aantal', () => {
  for (const id of GROEPEN) {
    const [a, b, c] = PAKKETTEN[id].prijzen;
    const re = new RegExp(`1 behandeling[^\\d€]{0,8}€\\s*${a}(?!\\d)[\\s\\S]{0,40}?3 behandelingen[^\\d€]{0,8}€\\s*${b}(?!\\d)[\\s\\S]{0,40}?5 behandelingen[^\\d€]{0,8}€\\s*${c}(?!\\d)`);
    assert.match(tekst(groep(id)), re, `aantal en bedrag horen niet bij elkaar in ${id}`);
  }
});

test('5. prijs voor 1 behandeling is gelijk aan de prijs op de kaart', () => {
  for (const id of GROEPEN) {
    const kaart = blok(html, 'data-treatment', id);
    assert.ok(kaart, `kaart ${id} ontbreekt`);
    assert.equal(bedragen(groep(id))[0], bedragen(kaart)[0], `1 behandeling bij ${id}`);
  }
});

test('6. het pakketblok staat onder de kaarten', () => {
  const laatste = Math.max(...blokken(html, 'data-treatment').map((b) => b.start));
  assert.ok(startVan('id', 'packages') > laatste);
});

test('7. slotblok met Yoly woorden', () => {
  const s = slot();
  assert.ok(koppen(s).includes(SLOT.kop), `kop "${SLOT.kop}" ontbreekt`);
  const t = tekst(s);
  for (const z of SLOT.zinnen) assert.ok(t.includes(z), `zin ontbreekt: ${z}`);
});

test('8. knop in het slotblok', () => {
  const naarAfspraak = links(slot()).filter((l) => l.href === 'afspraak.html');
  assert.equal(naarAfspraak.length, 1);
  assert.match(naarAfspraak[0].tekst, /^Afspraak maken(\s*→)?$/);
});

test('9. het slotblok staat onderaan', () => {
  const p = startVan('id', 'packages');
  const j = startVan('id', 'jouw-moment');
  const f = html.search(/<footer/i);
  assert.ok(f > 0, 'geen <footer gevonden');
  assert.ok(j > p, 'slotblok staat niet na het pakketblok');
  assert.ok(j < f, 'slotblok staat niet voor de footer');
});

test('10. het oude slotblok is weg', () => {
  const t = tekst(html);
  for (const oud of ['Reserveer jouw behandeling', 'Klaar voor jouw verwenmoment?', 'Maak een afspraak']) {
    assert.equal(t.split(oud).length - 1, 0, `oude tekst staat er nog: ${oud}`);
  }
});

test('11. geen emoji, geen Vanaf, geen boekknop per pakket', () => {
  const p = packages();
  const s = slot();
  for (const [naam, b] of [['#packages', p], ['#jouw-moment', s]]) {
    assert.ok(!EMOJI.test(tekst(b)), `emoji in ${naam}`);
    assert.ok(!/vanaf/i.test(tekst(b)), `"Vanaf" in ${naam}`);
  }
  assert.ok(links(p).filter((l) => l.href && l.href.includes('afspraak.html')).length <= 1, 'meer dan een afspraaklink in #packages');
});

test('12. pakketten zijn goedkoper dan los', () => {
  for (const id of GROEPEN) {
    const [een, drie, vijf] = bedragen(groep(id));
    assert.ok(drie < 3 * een, `${id}: 3 behandelingen (${drie}) niet goedkoper dan 3 x ${een}`);
    assert.ok(vijf < 5 * een, `${id}: 5 behandelingen (${vijf}) niet goedkoper dan 5 x ${een}`);
  }
});

test('13. de 6 behandelingen staan er nog', () => {
  assert.equal(blokken(html, 'data-treatment').length, 6);
});
