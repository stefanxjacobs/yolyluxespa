// cp3: het venster op index.html, in een echte browser (puppeteer, eigen server, 1440 x 900).
// Hangt alleen aan data-treatment, #treatment-modal, [aria-label="Sluiten"] en zichtbare tekst.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { tekst, lijstpunten, bedragen, duur, startServer, startBrowser, openPagina, isOpen } from './helpers.mjs';
import { BEHANDELINGEN } from './aanbod.mjs';

const MODAL = '#treatment-modal';
let server, browser, page, fouten, url;

before(async () => {
  server = await startServer();
  browser = await startBrowser();
  url = `${server.url}/index.html`;
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

async function open(id) {
  const b = BEHANDELINGEN.find((x) => x.id === id);
  const handle = await page.evaluateHandle((i, n) => {
    const kaart = document.querySelector(`[data-treatment="${i}"]`);
    if (!kaart) return null;
    return [...kaart.querySelectorAll('h2,h3,h4')].find((h) => h.textContent.replace(/\s+/g, ' ').trim() === n) || null;
  }, id, b.naam);
  const el = handle.asElement();
  assert.ok(el, `geen kop "${b.naam}" gevonden in [data-treatment="${id}"] op index.html`);
  await el.click();
  assert.ok(await wacht(true), `het venster opende niet na een klik op ${b.naam}`);
}

const modalHtml = () => page.$eval(MODAL, (e) => e.innerHTML);

for (const b of BEHANDELINGEN) {
  test(`14. klik op de kaart opent het venster met de gegevens van de behandelpagina: ${b.naam}`, async () => {
    await herlaad();
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
      assert.equal(duur(mh), b.duurNorm);
    }
    if (b.lijstkop) assert.ok(t.includes(b.lijstkop), `lijstkop ontbreekt: ${b.lijstkop}`);
    assert.deepEqual(lijstpunten(mh), b.punten);
  });
}

test('15a. het kruisje sluit het venster (dermapen)', async () => {
  await herlaad();
  await open('dermapen');
  const kruis = await page.$(`${MODAL} [aria-label="Sluiten"]`);
  assert.ok(kruis, 'geen [aria-label="Sluiten"] in het venster');
  await kruis.click();
  assert.ok(await wacht(false), 'het venster bleef open na het kruisje');
});

test('15b. Escape sluit het venster (melanin)', async () => {
  await herlaad();
  await open('melanin');
  await page.keyboard.press('Escape');
  assert.ok(await wacht(false), 'het venster bleef open na Escape');
});

test('15c. een klik naast het venster sluit het (lips)', async () => {
  await herlaad();
  await open('lips');
  const box = await (await page.$(MODAL)).boundingBox();
  assert.ok(box, 'het venster heeft geen afmetingen');
  await page.mouse.click(box.x + 5, box.y + 5);
  assert.ok(await wacht(false), 'het venster bleef open na een klik op de achtergrond');
});

test('16. twee na elkaar: basis, sluiten, hydrafacial; geen 55 euro meer', async () => {
  await herlaad();
  await open('basis');
  await page.keyboard.press('Escape');
  assert.ok(await wacht(false), 'het eerste venster sloot niet');
  await open('hydrafacial');
  const t = tekst(await modalHtml());
  assert.ok(t.includes('HydraFacial'));
  assert.ok(t.includes('€95'));
  assert.ok(!t.includes('€55'), 'de prijs van de vorige behandeling staat nog in het venster');
});

test('17. geen console- of paginafouten', () => {
  assert.deepEqual(fouten.console, []);
  assert.deepEqual(fouten.pagina, []);
});
