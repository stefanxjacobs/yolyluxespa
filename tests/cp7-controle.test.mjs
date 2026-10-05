// cp7: controle van de hele site. Deel A leest de bron; deel B opent 9 pagina's x 1440 en 375 in één browser.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, PAGINAS, leesHtml, blokken, startBrowser, schuifbreedte, isOpen } from './helpers.mjs';
import { startOmgeving, scrollDoorPagina } from './look.mjs';

const CSS = fs.readdirSync(ROOT).filter((f) => f.endsWith('.css'));
const EXTERN = /^(?:https?:|mailto:|tel:|data:|javascript:|\/\/)/i;
const bestaatOpSchijf = (rel) => fs.existsSync(path.join(ROOT, rel));
// Eigen, snelle linkzoeker (links() uit helpers is op sommige pagina's traag).
function links(fragment) {
  const zonder = fragment.replace(/<!--[\s\S]*?-->/g, ' ');
  const uit = [];
  for (const m of zonder.matchAll(/<a\b([^>]*)>([\s\S]{0,300}?)(?=<\/a\s*>|$)/gi)) {
    const h = m[1].match(/(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    uit.push({ href: h ? (h[1] ?? h[2] ?? h[3]) : null, tekst: m[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() });
  }
  return uit;
}
const meld = (lijst) => (lijst.length ? '\n  ' + lijst.join('\n  ') : '');

// Hoofdlettergevoelig: bestaat het pad precies zo op schijf?
function exactOpSchijf(rel) {
  let map = ROOT;
  for (const deel of rel.split('/').filter(Boolean)) {
    let namen;
    try { namen = fs.readdirSync(map); } catch { return false; }
    if (!namen.includes(deel)) return false;
    map = path.join(map, deel);
  }
  return true;
}
const schoonPad = (href) => {
  let p = href.split('#')[0].split('?')[0];
  try { p = decodeURIComponent(p); } catch {}
  return p.replace(/^\.\//, '').replace(/^\//, '');
};

function idsVan(html) {
  const zonder = html.replace(/<!--[\s\S]*?-->/g, '');
  return [...zonder.matchAll(/<[a-zA-Z][^>]*?\sid\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((m) => m[1] ?? m[2]);
}
const idsCache = {};
const ids = (naam) => (idsCache[naam] ??= new Set(idsVan(leesHtml(naam))));

function linkFouten(naam, fragment) {
  const fouten = [];
  for (const { href, tekst } of links(fragment)) {
    if (href === null) continue;
    if (href === '#') { fouten.push(`${naam}: kale href="#" ("${tekst.slice(0, 30)}")`); continue; }
    if (EXTERN.test(href)) continue;
    const pad = href.split('#')[0];
    const anker = href.includes('#') ? href.split('#').slice(1).join('#') : null;
    const doel = schoonPad(pad);
    if (doel === '') {
      if (anker && !ids(naam).has(anker)) fouten.push(`${naam}: anker #${anker} bestaat niet op de pagina`);
      continue;
    }
    if (!bestaatOpSchijf(doel)) { fouten.push(`${naam}: ${href} -> bestand ${doel} bestaat niet`); continue; }
    if (anker && doel.endsWith('.html')) {
      const doelNaam = doel.replace(/\.html$/, '');
      const idset = PAGINAS.includes(doelNaam) ? ids(doelNaam) : new Set(idsVan(fs.readFileSync(path.join(ROOT, doel), 'utf8')));
      if (!idset.has(anker)) fouten.push(`${naam}: ${href} -> id "${anker}" ontbreekt in ${doel}`);
    }
  }
  return fouten;
}

// ---------- A. bron ----------
test('A1 geen kapotte interne link (alle <a href>)', () => {
  const fouten = PAGINAS.flatMap((n) => linkFouten(n, leesHtml(n)).filter((f) => !f.includes('kale href') && !f.includes('anker #') && !f.includes('ontbreekt in')));
  assert.deepEqual(fouten, [], 'kapotte interne links:' + meld(fouten));
});

test('A2 geen kapot anker en geen kale href="#"', () => {
  const fouten = PAGINAS.flatMap((n) => linkFouten(n, leesHtml(n)).filter((f) => f.includes('anker #') || f.includes('ontbreekt in') || f.includes('kale href')));
  assert.deepEqual(fouten, [], 'kapotte ankers:' + meld(fouten));
});

for (const haak of ['main-nav', 'mobile-menu', 'announcement-bar', 'footer']) {
  test(`A3 links in #${haak} wijzen naar bestaande plekken`, () => {
    const fouten = [];
    for (const n of PAGINAS) {
      const b = blokken(leesHtml(n), 'id').find((x) => x.waarde === haak);
      if (!b) { fouten.push(`${n}: #${haak} ontbreekt`); continue; }
      fouten.push(...linkFouten(n, b.html));
    }
    assert.deepEqual(fouten, [], `#${haak}:` + meld(fouten));
  });
}

function urlVerwijzingen(tekst) {
  const uit = [];
  const zonderData = tekst.replace(/url\(\s*(["']?)data:[\s\S]*?\1\s*\)/gi, 'url()');
  for (const m of zonderData.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)) {
    const w = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    if (w && !w.startsWith('#')) uit.push({ w, bron: 'url()' });
  }
  return uit;
}
function mediaVerwijzingen(html) {
  const uit = [];
  const zonderComm = html.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  const voeg = (w, bron) => { if (w) uit.push({ w: w.trim(), bron }); };
  for (const m of zonderComm.matchAll(/\s(?:src|poster)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) voeg(m[1] ?? m[2], 'src/poster');
  for (const m of zonderComm.matchAll(/\ssrcset\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    for (const deel of (m[1] ?? m[2]).split(',')) voeg(deel.trim().split(/\s+/)[0], 'srcset');
  }
  return uit.concat(urlVerwijzingen(zonderComm));
}
const lokaal = (w) => w && !EXTERN.test(w) && !w.startsWith('#') && !/^(?:blob:|about:)/i.test(w);

function mediaFouten(label, verwijzingen, hoofdlettergevoelig) {
  const fouten = [];
  for (const { w, bron } of verwijzingen) {
    if (!lokaal(w)) continue;
    const rel = schoonPad(w);
    if (!rel || /\$\{|\{\{/.test(rel)) continue;
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) { fouten.push(`${label}: ${bron} "${w}" bestaat niet`); continue; }
    if (fs.statSync(p).isFile() && fs.statSync(p).size === 0) { fouten.push(`${label}: "${w}" is 0 bytes`); continue; }
    if (hoofdlettergevoelig && !exactOpSchijf(rel)) fouten.push(`${label}: "${w}" heeft andere hoofdletters dan op schijf`);
  }
  return fouten;
}
const alleBronnenMedia = () => [
  ...PAGINAS.map((n) => ({ label: `${n}.html`, verw: mediaVerwijzingen(leesHtml(n)) })),
  ...CSS.map((f) => ({ label: f, verw: urlVerwijzingen(fs.readFileSync(path.join(ROOT, f), 'utf8')) })),
];

test('A4 elk lokaal mediabestand (src, poster, srcset, source, url()) bestaat en is niet leeg', () => {
  const fouten = alleBronnenMedia().flatMap(({ label, verw }) => mediaFouten(label, verw, false));
  assert.deepEqual(fouten, [], 'ontbrekende mediabestanden:' + meld(fouten));
});

test('A5 bestandsnamen in de bron zijn hoofdlettergelijk aan schijf', () => {
  const media = alleBronnenMedia().flatMap(({ label, verw }) => mediaFouten(label, verw, true)).filter((f) => f.includes('hoofdletters'));
  const lnk = PAGINAS.flatMap((n) => links(leesHtml(n)).filter((l) => l.href && !EXTERN.test(l.href) && !l.href.startsWith('#')).map((l) => ({ n, rel: schoonPad(l.href) })))
    .filter(({ rel }) => rel && fs.existsSync(path.join(ROOT, rel)) && !exactOpSchijf(rel))
    .map(({ n, rel }) => `${n}.html: link naar "${rel}" met andere hoofdletters`);
  const alle = [...media, ...lnk];
  assert.deepEqual(alle, [], 'hoofdletterfouten:' + meld(alle));
});

test('A6 fotopaden in het script van index.html en behandelingen.html bestaan', () => {
  const fouten = [];
  for (const n of ['index', 'behandelingen']) {
    const scripts = [...leesHtml(n).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].map((m) => m[1]).join('\n');
    for (const m of scripts.matchAll(/media\/fotos\/[^'"`\\\n]+?\.(?:jpe?g|png|webp)/gi)) {
      const rel = m[0];
      if (!fs.existsSync(path.join(ROOT, rel))) fouten.push(`${n}.html: ${rel} bestaat niet`);
      else if (!exactOpSchijf(rel)) fouten.push(`${n}.html: ${rel} heeft andere hoofdletters dan op schijf`);
    }
  }
  assert.deepEqual(fouten, [], 'fotopaden uit scripts:' + meld(fouten));
});

// ---------- B. browser ----------
const HOOGTE = { 1440: 900, 375: 812 };
const sets = {};
let omgeving, browser;

async function openen(url, breedte) {
  const page = await browser.newPage();
  await page.setViewport({ width: breedte, height: HOOGTE[breedte] });
  const eigen = new URL(url).origin;
  const fouten = { console: [], pagina: [], netwerk: [] };
  const extern = (s) => /https?:\/\/(?!127\.0\.0\.1)/i.test(s) && !s.includes(eigen);
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const t = msg.text();
    const bron = (msg.location() && msg.location().url) || '';
    if (t.includes('ERR_ABORTED')) return;
    if (bron !== '' && !bron.startsWith(eigen)) return;
    if (bron === '' && extern(t)) return;
    fouten.console.push(t.slice(0, 200));
  });
  page.on('pageerror', (e) => {
    const s = String(e && e.stack ? e.stack : e);
    if (extern(s)) return;
    fouten.pagina.push(String(e && e.message ? e.message : e).slice(0, 200));
  });
  page.on('response', (r) => { if (r.url().startsWith(eigen) && r.status() >= 400) fouten.netwerk.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', (r) => {
    const f = (r.failure() && r.failure().errorText) || '';
    if (r.url().startsWith(eigen) && !f.includes('ERR_ABORTED')) fouten.netwerk.push(`${f} ${r.url()}`);
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState === 'complete', { timeout: 1500 }).catch(() => {});
  await page.addStyleTag({ content: '*{transition:none!important;animation:none!important;scroll-behavior:auto!important}' });
  await scrollDoorPagina(page);
  await new Promise((r) => setTimeout(r, 150));
  return { page, fouten };
}

before(async () => {
  omgeving = await startOmgeving();
  browser = await startBrowser();
  const taken = PAGINAS.flatMap((naam) => [1440, 375].map((breedte) => ({ naam, breedte })));
  for (let i = 0; i < taken.length; i += 3) {
    await Promise.all(taken.slice(i, i + 3).map(async ({ naam, breedte }) => {
      try { sets[`${naam}-${breedte}`] = await openen(`${omgeving.url}/${naam}.html`, breedte); }
      catch (e) { sets[`${naam}-${breedte}`] = { fout: String(e.message || e) }; }
    }));
  }
});
after(async () => {
  try { if (browser) await browser.close(); } catch {}
  try { if (omgeving) await omgeving.stop(); } catch {}
});

const alle = () => PAGINAS.flatMap((n) => [1440, 375].map((b) => ({ n, b, set: sets[`${n}-${b}`] })));
const kapot = (set) => !set || set.fout;
const samen = (lijst, max = 5) => (lijst.length <= max ? lijst.join(' | ') : lijst.slice(0, max).join(' | ') + ` | ... (+${lijst.length - max} meer)`);

test('B7 geen foutmelding in de console', () => {
  const fouten = [];
  for (const { n, b, set } of alle()) {
    if (kapot(set)) { fouten.push(`${n} ${b}: pagina niet te openen: ${set && set.fout}`); continue; }
    const l = [...set.fouten.console, ...set.fouten.pagina];
    if (l.length) fouten.push(`${n} ${b}: ${l.length} fout(en): ${samen(l, 2)}`);
  }
  assert.deepEqual(fouten, [], 'console-fouten:' + meld(fouten));
});

test('B8 geen ontbrekend lokaal bestand tijdens het laden', () => {
  const fouten = [];
  for (const { n, b, set } of alle()) {
    if (kapot(set)) { fouten.push(`${n} ${b}: pagina niet te openen`); continue; }
    if (set.fouten.netwerk.length) fouten.push(`${n} ${b}: ${samen(set.fouten.netwerk)}`);
  }
  assert.deepEqual(fouten, [], 'netwerkfouten:' + meld(fouten));
});

test('B9 elke lokale foto laadt', async () => {
  const fouten = [];
  for (const { n, b, set } of alle()) {
    if (kapot(set)) { fouten.push(`${n} ${b}: pagina niet te openen`); continue; }
    const stuk = await set.page.evaluate(() => [...document.querySelectorAll('img')]
      .filter((i) => { const s = i.getAttribute('src') || ''; return s && !/^(?:https?:|\/\/|data:)/i.test(s); })
      .filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.getAttribute('src')));
    if (stuk.length) fouten.push(`${n} ${b}: ${stuk.length} foto('s) laden niet: ${samen(stuk, 3)}`);
  }
  assert.deepEqual(fouten, [], "foto's die niet laden:" + meld(fouten));
});

test("B10 elke lokale video is afspeelbaar, Cloudinary-video's komen van res.cloudinary.com", async () => {
  const fouten = [];
  for (const { n, b, set } of alle()) {
    if (kapot(set)) { fouten.push(`${n} ${b}: pagina niet te openen`); continue; }
    const res = await set.page.evaluate(async () => {
      const uit = [];
      for (const v of document.querySelectorAll('video')) {
        const bronnen = [v.getAttribute('src'), ...[...v.querySelectorAll('source')].map((s) => s.getAttribute('src'))].filter(Boolean);
        for (const s of bronnen) {
          if (/^https?:\/\//i.test(s)) { if (!s.startsWith('https://res.cloudinary.com/')) uit.push(`externe video niet van Cloudinary: ${s}`); continue; }
          if (/^data:/i.test(s)) continue;
          try {
            const r = await fetch(s, { headers: { Range: 'bytes=0-1' } });
            if (r.status !== 200 && r.status !== 206) uit.push(`${s}: status ${r.status}`);
          } catch (e) { uit.push(`${s}: ${e.message}`); }
        }
        if (v.error) uit.push(`video-fout code ${v.error.code} (${bronnen[0]})`);
      }
      return uit;
    });
    if (res.length) fouten.push(`${n} ${b}: ${samen(res, 3)}`);
  }
  assert.deepEqual(fouten, [], "video's:" + meld(fouten));
});

test('B11 geen horizontaal schuiven op 1440 en 375', async () => {
  const fouten = [];
  for (const { n, b, set } of alle()) {
    if (kapot(set)) { fouten.push(`${n} ${b}: pagina niet te openen`); continue; }
    const { scrollWidth, clientWidth } = await schuifbreedte(set.page);
    if (scrollWidth > clientWidth) fouten.push(`${n} ${b}: scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`);
  }
  assert.deepEqual(fouten, [], 'horizontaal schuiven:' + meld(fouten));
});

test('B12 menu werkt op 375 (hamburger opent, sluitknop sluit)', async () => {
  const fouten = [];
  for (const n of PAGINAS) {
    const set = sets[`${n}-375`];
    if (kapot(set)) { fouten.push(`${n}: pagina niet te openen`); continue; }
    const { page } = set;
    try {
      await page.bringToFront();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.click('#hamburger-btn', { delay: 10 });
      await new Promise((r) => setTimeout(r, 120));
      if (!(await isOpen(page, '#mobile-menu'))) { fouten.push(`${n}: #mobile-menu wordt niet zichtbaar na klik op #hamburger-btn`); continue; }
      await page.click('#mobile-close-btn', { delay: 10 });
      await new Promise((r) => setTimeout(r, 120));
      if (await isOpen(page, '#mobile-menu')) fouten.push(`${n}: #mobile-menu blijft zichtbaar na klik op #mobile-close-btn`);
    } catch (e) { fouten.push(`${n}: ${String(e.message).split('\n')[0]}`); }
  }
  assert.deepEqual(fouten, [], 'menu:' + meld(fouten));
});

test("B13 geen dubbele id's in een pagina", () => {
  const fouten = PAGINAS.flatMap((n) => {
    const tel = {};
    for (const id of idsVan(leesHtml(n))) tel[id] = (tel[id] || 0) + 1;
    return Object.entries(tel).filter(([, c]) => c > 1).map(([id, c]) => `${n}.html: id "${id}" komt ${c}x voor`);
  });
  assert.deepEqual(fouten, [], "dubbele id's:" + meld(fouten));
});
