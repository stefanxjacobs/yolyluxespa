// cp6: werking die moet blijven: afsprakenagenda (afspraak.html), blog (artikelen, filter, zoeken), contactformulier.
// Externe diensten (Calendly, Formspree) worden niet geraakt: er wordt niets verstuurd.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { leesHtml, startServer, startBrowser,  schuifbreedte, isOpen } from './helpers.mjs';

let server, browser;
// Zoals openPagina uit helpers.mjs, maar wacht hooguit 1,5 s op "complete" (externe diensten zijn soms traag).
async function openen(browser, url, { breedte = 1440, hoogte = 900 } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: breedte, height: hoogte });
  const eigen = new URL(url).origin;
  const fouten = { console: [], pagina: [], netwerk: [] };
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const bron = (msg.location() && msg.location().url) || '';
    if (bron === '' || bron.startsWith(eigen)) fouten.console.push(msg.text());
  });
  page.on('pageerror', (e) => fouten.pagina.push(String(e && e.message ? e.message : e)));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState === 'complete', { timeout: 1500 }).catch(() => {});
  await page.addStyleTag({ content: '*{transition:none!important;animation:none!important;scroll-behavior:auto!important}' });
  return { page, fouten };
}

const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
before(async () => { server = await startServer(); browser = await startBrowser(); });
after(async () => {
  try { if (browser) await browser.close(); } catch {}
  try { if (server) await server.stop(); } catch {}
});

// ---------- Afspraak ----------
test('14. de agenda staat in de pagina (element met data-url en het Calendly-script)', () => {
  const html = leesHtml('afspraak');
  assert.ok(/id\s*=\s*["']calendly-inline["']/.test(html), '#calendly-inline ontbreekt');
  const w = html.match(/<[a-z]+\b[^>]*class\s*=\s*["'][^"']*\bcalendly-inline-widget\b[^"']*["'][^>]*>/i);
  assert.ok(w, 'element met klasse calendly-inline-widget ontbreekt');
  const url = w[0].match(/data-url\s*=\s*["']([^"']*)["']/i);
  assert.ok(url && url[1].startsWith('https://calendly.com/yolyluxespa'), `data-url begint niet met https://calendly.com/yolyluxespa (${url && url[1]})`);
  assert.ok(/<script\b[^>]*src\s*=\s*["']https:\/\/assets\.calendly\.com\/assets\/external\/widget\.js["']/i.test(html), 'Calendly widget.js ontbreekt');
});

test('15. de agenda past op 375 (links >= 0, rechts <= 375, breedte >= 300, hoogte >= 500) en de pagina schuift niet', async () => {
  const { page } = await openen(browser, `${server.url}/afspraak.html`, { breedte: 375, hoogte: 812 });
  try {
    await wacht(300);
    const r = await page.evaluate(() => {
      const e = document.querySelector('#calendly-inline');
      const w = e && (e.querySelector('.calendly-inline-widget') || e);
      if (!w) return null;
      const b = w.getBoundingClientRect();
      return { left: b.left, right: b.right, breedte: b.width, hoogte: b.height };
    });
    assert.ok(r, '#calendly-inline ontbreekt');
    assert.ok(r.left >= 0, `agenda links ${r.left} < 0`);
    assert.ok(r.right <= 375, `agenda rechts ${r.right} > 375`);
    assert.ok(r.breedte >= 300, `agenda ${r.breedte} breed (< 300)`);
    assert.ok(r.hoogte >= 500, `agenda ${r.hoogte} hoog (< 500)`);
    const b = await schuifbreedte(page);
    assert.ok(b.scrollWidth <= b.clientWidth, `afspraak: scrollWidth ${b.scrollWidth} > clientWidth ${b.clientWidth}`);
  } finally { await page.close(); }
});

test('16. de 6 behandelingen staan er nog naast (6 x data-treatment)', () => {
  const n = (leesHtml('afspraak').match(/\sdata-treatment\s*=/g) || []).length;
  assert.equal(n, 6, `${n} x data-treatment op afspraak.html`);
});

// ---------- Blog ----------
const KAARTEN = '#articles-list article[data-cat]';
const zichtbaarAantal = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.checkVisibility({ checkVisibilityCSS: true })).length, sel);

async function wachtOpen(page, sel, open) {
  const eind = Date.now() + 3000;
  while (Date.now() < eind) {
    if ((await isOpen(page, sel)) === open) return true;
    await wacht(50);
  }
  return false;
}

async function blogPagina() {
  const o = await openen(browser, `${server.url}/blog.html`);
  await o.page.bringToFront();
  return o;
}

test('17. artikel openen en sluiten: kaart, sluitknop, Escape, klik naast het artikel', async () => {
  const { page } = await blogPagina();
  try {
    const kaarten = await page.$$(KAARTEN);
    assert.equal(kaarten.length, 6, `${kaarten.length} artikelkaarten`);
    await kaarten[0].click();
    assert.ok(await wachtOpen(page, '#modal-a1', true), '#modal-a1 opent niet na klik op de eerste kaart');
    // Bestaand label in blog.html: "Sluit artikel"; ook "Sluiten" is goed.
    const sluit = await page.$('#modal-a1 [aria-label*="luit" i]');
    assert.ok(sluit, 'geen sluitknop (aria-label met "sluit") in #modal-a1');
    await sluit.click();
    assert.ok(await wachtOpen(page, '#modal-a1', false), '#modal-a1 sluit niet met de sluitknop');

    await page.evaluate(() => window.scrollTo(0, 0));
    await (await page.$$(KAARTEN))[3].click();
    assert.ok(await wachtOpen(page, '#modal-a4', true), '#modal-a4 opent niet');
    await page.keyboard.press('Escape');
    assert.ok(await wachtOpen(page, '#modal-a4', false), '#modal-a4 sluit niet met Escape');

    await (await page.$$(KAARTEN))[1].click();
    assert.ok(await wachtOpen(page, '#modal-a2', true), '#modal-a2 opent niet');
    await page.mouse.click(5, 450); // links naast het artikel, op de achtergrond
    assert.ok(await wachtOpen(page, '#modal-a2', false), '#modal-a2 sluit niet na klik naast het artikel');
  } finally { await page.close(); }
});

test('18. toetsenbord: focus op een artikelkaart en Enter opent het artikel', async () => {
  const { page } = await blogPagina();
  try {
    await page.evaluate((s) => document.querySelector(s).focus(), KAARTEN);
    const focus = await page.evaluate((s) => document.activeElement === document.querySelector(s), KAARTEN);
    assert.ok(focus, 'de eerste artikelkaart is niet focusbaar');
    await page.keyboard.press('Enter');
    assert.ok(await wachtOpen(page, '#modal-a1', true), 'Enter opent #modal-a1 niet');
  } finally { await page.close(); }
});

test('19. filter: HydraFacial toont alleen die kaarten, Alle artikelen toont alle 6', async () => {
  const { page } = await blogPagina();
  try {
    const klik = (tekstDeel) => page.evaluate((t) => {
      const li = [...document.querySelectorAll('#cat-list li')].find((l) => l.textContent.toLowerCase().includes(t));
      if (!li) return false;
      li.click();
      return true;
    }, tekstDeel);
    assert.ok(await klik('hydrafacial'), 'regel HydraFacial niet gevonden in #cat-list');
    const st = await page.evaluate(() => [...document.querySelectorAll('#articles-list article[data-cat]')].map((e) => ({ cat: e.dataset.cat, zicht: e.checkVisibility({ checkVisibilityCSS: true }) })));
    const juist = st.filter((k) => k.cat === 'hydrafacial');
    assert.ok(juist.length >= 1, 'geen kaart met data-cat="hydrafacial"');
    assert.ok(juist.every((k) => k.zicht), 'een HydraFacial-kaart is verborgen');
    assert.ok(st.filter((k) => k.cat !== 'hydrafacial').every((k) => !k.zicht), 'een kaart van een andere categorie is nog zichtbaar');
    assert.ok(await klik('alle artikelen'), 'regel Alle artikelen niet gevonden');
    assert.equal(await zichtbaarAantal(page, KAARTEN), 6, 'na Alle artikelen zijn niet alle 6 kaarten zichtbaar');
  } finally { await page.close(); }
});

test('20. zoeken zonder resultaat: 0 kaarten, geen console-fout; leegmaken toont weer 6', async () => {
  const { page, fouten } = await blogPagina();
  try {
    await page.click('#search-input');
    await page.keyboard.type('xqzv');
    await page.keyboard.press('Enter');
    await wacht(150);
    assert.equal(await zichtbaarAantal(page, KAARTEN), 0, 'kaarten zichtbaar bij zoekterm xqzv');
    await page.click('#search-input', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Enter');
    await wacht(150);
    assert.equal(await zichtbaarAantal(page, KAARTEN), 6, 'na leegmaken zijn niet alle 6 kaarten terug');
    assert.deepEqual(fouten.console, [], 'console-fouten bij zoeken');
    assert.deepEqual(fouten.pagina, [], 'paginafouten bij zoeken');
  } finally { await page.close(); }
});

// ---------- Contact ----------
test('21. leeg formulier wordt niet verstuurd: geen POST, geen #form-success', async () => {
  const { page } = await openen(browser, `${server.url}/contact.html`);
  const posts = [];
  try {
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      if (r.method() === 'POST') { posts.push(r.url()); r.abort(); } else r.continue();
    });
    await page.bringToFront();
    const knop = await page.evaluateHandle(() => document.querySelector('form [type="submit"], form button:not([type="button"])'));
    assert.ok(knop.asElement(), 'geen verzendknop in het formulier');
    await knop.asElement().evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await knop.asElement().click();
    await wacht(500);
    assert.deepEqual(posts, [], `er is een POST-verzoek geprobeerd: ${posts.join(', ')}`);
    assert.equal(await isOpen(page, '#form-success'), false, '#form-success is zichtbaar na versturen van een leeg formulier');
  } finally { await page.close(); }
});
