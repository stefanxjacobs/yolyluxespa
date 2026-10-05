// cp1: het venster op behandelingen.html, in een echte browser (puppeteer, eigen server, 1440 x 900).
// Hangt alleen aan data-treatment, #treatment-modal, [aria-label="Sluiten"] en zichtbare tekst.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { leesHtml, blok, tekst, lijstpunten, links, bedragen, duur, startServer, startBrowser, openPagina, isOpen } from './helpers.mjs';
import { BEHANDELINGEN } from './aanbod.mjs';

const MODAL = '#treatment-modal';
const kaartHtml = (id) => blok(leesHtml('behandelingen'), 'data-treatment', id);
const dash = (s) => s.replace(/[–—]/g, '-');

let server, browser, page, fouten, url;

before(async () => {
  server = await startServer();
  browser = await startBrowser();
  url = `${server.url}/behandelingen.html`;
  ({ page, fouten } = await openPagina(browser, url));
});

after(async () => {
  try { if (browser) await browser.close(); } catch {}
  try { if (server) await server.stop(); } catch {}
});

async function herlaad() {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 }).catch(() => {});
  await page.addStyleTag({ content: '*{transition:none!important;animation:none!important;scroll-behavior:auto!important}' });
}

async function wacht(open) {
  const eind = Date.now() + 3000;
  while (Date.now() < eind) {
    if ((await isOpen(page, MODAL)) === open) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

// Handle van de naam-kop binnen het [data-treatment]-element.
async function naamKop(id, naam) {
  const handle = await page.evaluateHandle((i, n) => {
    const kaart = document.querySelector(`[data-treatment="${i}"]`);
    if (!kaart) return null;
    return [...kaart.querySelectorAll('h2,h3,h4')].find((h) => h.textContent.replace(/\s+/g, ' ').trim() === n) || null;
  }, id, naam);
  const el = handle.asElement();
  assert.ok(el, `geen kop "${naam}" gevonden in [data-treatment="${id}"]`);
  return el;
}

async function open(id) {
  const b = BEHANDELINGEN.find((x) => x.id === id);
  await (await naamKop(id, b.naam)).click();
  assert.ok(await wacht(true), `het venster opende niet na een klik op ${b.naam}`);
}

const modalHtml = () => page.$eval(MODAL, (e) => e.innerHTML);

for (const b of BEHANDELINGEN) {
  test(`13. klik opent het venster met dezelfde gegevens als de kaart: ${b.naam}`, async () => {
    await herlaad();
    const kaart = kaartHtml(b.id);
    assert.ok(kaart, `kaart ${b.id} ontbreekt op de pagina`);
    await open(b.id);
    const mh = await modalHtml();
    const t = tekst(mh);
    assert.ok(t.includes(b.naam), 'naam ontbreekt in het venster');
    if (b.prijs === null) {
      assert.ok(t.includes('Prijs op aanvraag'));
      assert.deepEqual(bedragen(mh), []);
      assert.ok(!t.includes('±'), 'geen ± bij Melanin Glow');
      assert.equal(duur(mh), null);
    } else {
      assert.deepEqual(bedragen(mh), [b.prijs]);
      assert.equal(duur(mh), duur(kaart));
      assert.equal(duur(mh), b.duurNorm);
      assert.match(dash(t), new RegExp(`±\\s*${b.duurNorm.replace('-', '\\s*-\\s*')}\\s*min`));
    }
    if (b.lijstkop) assert.ok(t.includes(b.lijstkop), `lijstkop ontbreekt: ${b.lijstkop}`);
    assert.deepEqual(lijstpunten(mh), lijstpunten(kaart));
    assert.deepEqual(lijstpunten(mh), b.punten);
  });

  test(`14. het venster heeft een knop Afspraak maken: ${b.naam}`, async () => {
    await herlaad();
    await open(b.id);
    const knoppen = links(await modalHtml()).filter((l) => /afspraak\.html$/.test(l.href || ''));
    assert.ok(knoppen.length >= 1, 'geen link naar afspraak.html in het venster');
    assert.ok(knoppen.some((l) => /^Afspraak maken(\s*→)?$/.test(l.tekst)), `knoptekst klopt niet: ${JSON.stringify(knoppen)}`);
  });
}

test('15. het kruisje sluit het venster (dermapen)', async () => {
  await herlaad();
  await open('dermapen');
  const kruis = await page.$(`${MODAL} [aria-label="Sluiten"]`);
  assert.ok(kruis, 'geen [aria-label="Sluiten"] in het venster');
  await kruis.click();
  assert.ok(await wacht(false), 'het venster bleef open na het kruisje');
});

test('16. Escape sluit het venster (melanin)', async () => {
  await herlaad();
  await open('melanin');
  await page.keyboard.press('Escape');
  assert.ok(await wacht(false), 'het venster bleef open na Escape');
});

test('17. een klik naast het venster sluit het (lips)', async () => {
  await herlaad();
  await open('lips');
  const box = await (await page.$(MODAL)).boundingBox();
  assert.ok(box, 'het venster heeft geen afmetingen');
  await page.mouse.click(box.x + 5, box.y + 5);
  assert.ok(await wacht(false), 'het venster bleef open na een klik op de achtergrond');
});

test('18. twee na elkaar: basis, sluiten, hydrafacial', async () => {
  await herlaad();
  await open('basis');
  await page.keyboard.press('Escape');
  assert.ok(await wacht(false), 'het eerste venster sloot niet');
  await open('hydrafacial');
  const t = tekst(await modalHtml());
  assert.ok(t.includes('HydraFacial'));
  assert.ok(t.includes('€95'));
  assert.ok(!t.includes('Yoly Luxe Basic Facial'), 'de naam van de vorige behandeling staat nog in het venster');
  assert.ok(!t.includes('€55'), 'de prijs van de vorige behandeling staat nog in het venster');
});

test('19. toetsenbord: Enter op het element dat het venster opent (diepe)', async () => {
  await herlaad();
  const opener = (await page.evaluateHandle(() => {
    const kaart = document.querySelector('[data-treatment="diepe"]');
    if (!kaart) return null;
    if (kaart.hasAttribute('tabindex')) return kaart;
    return kaart.querySelector('button, [role=button]');
  })).asElement();
  assert.ok(opener, 'geen toetsenbord-bereikbaar element in [data-treatment="diepe"] (tabindex, button of [role=button])');
  await opener.focus();
  const heeftFocus = await page.evaluate((el) => document.activeElement === el, opener);
  assert.ok(heeftFocus, 'het element kreeg geen focus');
  await page.keyboard.press('Enter');
  assert.ok(await wacht(true), 'Enter opende het venster niet');
  assert.ok(tekst(await modalHtml()).includes('Deep Clean Facial'));
});

test('20. de knop op de kaart opent het venster niet; een klik op de h1 ook niet', async () => {
  await herlaad();
  const knop = (await page.evaluateHandle(() => {
    const kaart = document.querySelector('[data-treatment="basis"]');
    if (!kaart) return null;
    return [...kaart.querySelectorAll('a')].find((a) => /afspraak\.html$/.test(a.getAttribute('href') || '')) || null;
  })).asElement();
  assert.ok(knop, 'geen link naar afspraak.html in [data-treatment="basis"]');
  const gegevens = await page.evaluate((a) => {
    a.addEventListener('click', (e) => e.preventDefault());
    return { href: a.getAttribute('href'), tekst: a.textContent.replace(/\s+/g, ' ').trim() };
  }, knop);
  assert.match(gegevens.href, /afspraak\.html$/);
  assert.match(gegevens.tekst, /^Afspraak maken(\s*→)?$/);
  await knop.click();
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(await isOpen(page, MODAL), false, 'de knop Afspraak maken opende het venster');
  const h1 = await page.$('h1');
  assert.ok(h1, 'geen h1');
  await h1.click();
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(await isOpen(page, MODAL), false, 'een klik op de h1 opende het venster');
});

test('21. geen console- of paginafouten', () => {
  assert.deepEqual(fouten.console, []);
  assert.deepEqual(fouten.pagina, []);
});
