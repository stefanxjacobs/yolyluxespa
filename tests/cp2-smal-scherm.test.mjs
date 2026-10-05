// cp2: de 9 prijzen en de slotknop op 375 en 1440 pixels breed (puppeteer, eigen server).
// Hangt alleen aan #packages, #jouw-moment en zichtbare tekst.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, startBrowser, openPagina, schuifbreedte } from './helpers.mjs';

let server, browser, smal, breed;

before(async () => {
  server = await startServer();
  browser = await startBrowser();
  const url = `${server.url}/behandelingen.html`;
  smal = (await openPagina(browser, url, { breedte: 375, hoogte: 812 })).page;
  breed = (await openPagina(browser, url, { breedte: 1440, hoogte: 900 })).page;
});

after(async () => {
  try { if (browser) await browser.close(); } catch {}
  try { if (server) await server.stop(); } catch {}
});

async function zorgDatBlokBestaat(page, sel) {
  const bestaat = await page.evaluate((s) => !!document.querySelector(s), sel);
  assert.ok(bestaat, sel === '#packages' ? 'pakketblok ontbreekt: geen #packages' : `blok ontbreekt: geen ${sel}`);
  await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'start' }), sel);
}

async function meetPrijzen(page) {
  await zorgDatBlokBestaat(page, '#packages');
  return page.evaluate(() => {
    const root = document.querySelector('#packages');
    const uit = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (!n.textContent.includes('€')) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      const b = r.getBoundingClientRect();
      uit.push({
        tekst: n.textContent.trim(), left: b.left, right: b.right, breedte: b.width, hoogte: b.height,
        font: parseFloat(getComputedStyle(n.parentElement).fontSize),
      });
    }
    return { prijzen: uit, venster: document.documentElement.clientWidth };
  });
}

function controleerPrijzen({ prijzen, venster }, breedte) {
  assert.equal(prijzen.length, 9, `verwacht 9 prijzen, gevonden ${prijzen.length}`);
  for (const p of prijzen) {
    assert.ok(p.breedte > 0 && p.hoogte > 0, `prijs "${p.tekst}" is niet zichtbaar`);
    assert.ok(p.left >= 0, `prijs "${p.tekst}" valt links buiten het scherm (${p.left})`);
    assert.ok(p.right <= breedte, `prijs "${p.tekst}" valt rechts buiten ${breedte}px (${p.right})`);
    assert.ok(p.font >= 12, `prijs "${p.tekst}" is te klein (${p.font}px)`);
  }
  assert.ok(venster <= breedte);
}

test('14. alle 9 prijzen leesbaar op 375 zonder opzij te schuiven', async () => {
  controleerPrijzen(await meetPrijzen(smal), 375);
});

test('15. geen verborgen zijwaarts schuifvak in het pakketblok', async () => {
  await zorgDatBlokBestaat(smal, '#packages');
  const fout = await smal.evaluate(() => {
    const root = document.querySelector('#packages');
    return [root, ...root.querySelectorAll('*')]
      .filter((e) => e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0)
      .map((e) => `${e.tagName.toLowerCase()} ${e.scrollWidth}>${e.clientWidth}`);
  });
  assert.deepEqual(fout, []);
});

test('16. de pagina schuift niet horizontaal op 375', async () => {
  await zorgDatBlokBestaat(smal, '#packages');
  const { scrollWidth, clientWidth } = await schuifbreedte(smal);
  assert.ok(scrollWidth <= clientWidth, `scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`);
});

test('17. ook op een breed scherm (1440)', async () => {
  controleerPrijzen(await meetPrijzen(breed), 1440);
});

test('18. de slotknop is zichtbaar en aanklikbaar op 375', async () => {
  await zorgDatBlokBestaat(smal, '#jouw-moment');
  const r = await smal.evaluate(() => {
    const a = document.querySelector('#jouw-moment a[href="afspraak.html"]');
    if (!a) return { ontbreekt: true };
    a.scrollIntoView({ block: 'center' });
    const b = a.getBoundingClientRect();
    const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return { left: b.left, right: b.right, breedte: b.width, hoogte: b.height, bovenaan: !!top && (top === a || a.contains(top)) };
  });
  assert.ok(!r.ontbreekt, 'geen link naar afspraak.html in #jouw-moment');
  assert.ok(r.breedte > 0 && r.hoogte > 0, 'knop heeft geen grootte');
  assert.ok(r.left >= 0 && r.right <= 375, `knop valt buiten 0-375 (${r.left}-${r.right})`);
  assert.ok(r.bovenaan, 'knop wordt afgedekt door een ander element');
});
