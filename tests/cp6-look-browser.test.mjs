// cp6: de look zoals getoond, op de 7 overige pagina's (en de vergelijking van menu, balk, knoppen en footer over alle 9).
// Eén browser, één server; de pagina's worden hooguit 3 tegelijk geopend en hergebruikt door alle tests.
// Hangt aan zichtbare elementen en de vaste haken (#announcement-bar, #main-nav, #hamburger-btn, #mobile-menu,
// #footer, #calendly-inline, #articles-list, #cat-list); niet aan klassenamen.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PAGINAS, startBrowser,  schuifbreedte, isOpen } from './helpers.mjs';
import {
  startOmgeving, TOEGESTAAN_RGB, OPAK_ZWART, TOEGESTANE_FAMILIES, eersteFamilie,
  meetToestanden, meldToestandsFouten, scrollDoorPagina,
} from './look.mjs';

const REF = 'behandelingen';
const ZEVEN = ['afspraak', 'over', 'blog', 'contact', 'algemene-voorwaarden', 'cookiebeleid', 'privacybeleid'];
const ZONDER_OVER = ZEVEN.filter((p) => p !== 'over');
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

let omgeving, browser;
const breed = {};
const smal = {};
const menu = {};
const doorgescrold = new WeakSet();
async function scrollEenmaal(page) {
  if (doorgescrold.has(page)) return;
  await scrollDoorPagina(page);
  doorgescrold.add(page);
}

async function inGroepen(items, n, f) {
  for (let i = 0; i < items.length; i += n) await Promise.all(items.slice(i, i + n).map(f));
}

before(async () => {
  omgeving = await startOmgeving();
  browser = await startBrowser();
  const taken = [];
  for (const naam of PAGINAS) {
    taken.push({ naam, soort: 'breed' });
    taken.push({ naam, soort: 'smal' });
    if (ZEVEN.includes(naam)) taken.push({ naam, soort: 'menu' });
  }
  await inGroepen(taken, 3, async ({ naam, soort }) => {
    const url = `${omgeving.url}/${naam}.html`;
    const opties = soort === 'breed' ? { breedte: 1440, hoogte: 900 } : { breedte: 375, hoogte: 812 };
    const set = { ...(await openen(browser, url, opties)), url };
    ({ breed, smal, menu })[soort][naam] = set;
  });
});

after(async () => {
  try { if (browser) await browser.close(); } catch {}
  try { if (omgeving) await omgeving.stop(); } catch {}
});

// ---------- Lettertypes (1440) ----------
const meetFamilies = (page, selector, minTekens = 0) => page.evaluate((selector, minTekens) => {
  const eigenTekst = (e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
  return [...document.querySelectorAll(selector)]
    .filter((e) => !e.closest('#calendly-inline'))
    .filter((e) => e.checkVisibility({ checkVisibilityCSS: true }) && e.getBoundingClientRect().width > 0)
    .filter((e) => minTekens === 0 || eigenTekst(e).length > minTekens)
    .map((e) => ({ label: `${e.tagName.toLowerCase()} "${(e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40)}"`, familie: getComputedStyle(e).fontFamily }));
}, selector, minTekens);

for (const naam of ZEVEN) {
  test(`8a. ${naam}: koppen (h1, h2, h3) in Playfair Display`, async () => {
    const lijst = await meetFamilies(breed[naam].page, 'h1, h2, h3');
    assert.ok(lijst.length > 0, `${naam}: geen zichtbare koppen gevonden`);
    const fout = lijst.filter((x) => eersteFamilie(x.familie) !== 'playfair display');
    assert.deepEqual(fout, [], `${naam}: koppen niet in Playfair Display:\n${fout.map((x) => `  ${x.label}: ${x.familie}`).join('\n')}`);
  });

  test(`8b. ${naam}: lopende tekst (body, p, li > 60 tekens) in DM Sans`, async () => {
    const lijst = [...await meetFamilies(breed[naam].page, 'body'), ...await meetFamilies(breed[naam].page, 'p, li', 60)];
    const fout = lijst.filter((x) => eersteFamilie(x.familie) !== 'dm sans');
    assert.deepEqual(fout, [], `${naam}: lopende tekst niet in DM Sans:\n${fout.map((x) => `  ${x.label}: ${x.familie}`).join('\n')}`);
  });

  test(`8c. ${naam}: geen derde lettertype`, async () => {
    const lijst = await meetFamilies(breed[naam].page, 'body *:not(script):not(style):not(noscript)', 1);
    const fout = lijst.filter((x) => !TOEGESTANE_FAMILIES.includes(eersteFamilie(x.familie)));
    const uniek = [...new Set(fout.map((x) => `${x.familie}  (bv. ${x.label})`))];
    assert.deepEqual(uniek, [], `${naam}: andere eerste familie dan Playfair Display of DM Sans:\n${uniek.join('\n')}`);
  });
}

// ---------- Kleuren zoals getoond (1440) ----------
for (const naam of ZEVEN) {
  test(`9. ${naam}: tekst- en vlakkleuren zijn merkkleuren (zonder #calendly-inline)`, async () => {
    const fout = await breed[naam].page.evaluate((toegestaan, opakZwart) => {
      const ok = new Set(toegestaan);
      const eigenTekst = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      const tel = new Map();
      const meld = (soort, css, e) => {
        const m = css.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?/);
        if (!m) { tel.set(`${soort} ${css}`, tel.get(`${soort} ${css}`) || { n: 0, bv: e }); tel.get(`${soort} ${css}`).n++; return; }
        const alfa = m[4] === undefined ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
        if (soort === 'achtergrond' && alfa === 0) return;
        const drietal = [m[1], m[2], m[3]].map((x) => Math.round(parseFloat(x))).join(',');
        const goed = ok.has(drietal) && !(drietal === opakZwart && alfa >= 1);
        if (goed) return;
        const sleutel = `${soort} ${css}`;
        const v = tel.get(sleutel) || { n: 0, bv: e };
        v.n++;
        tel.set(sleutel, v);
      };
      const NEGEER = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META', 'PATH', 'LINE', 'CIRCLE', 'RECT', 'POLYLINE', 'POLYGON', 'G', 'DEFS', 'SOURCE'];
      const els = [...document.querySelectorAll('body, body *')]
        .filter((e) => !NEGEER.includes(e.tagName.toUpperCase()))
        .filter((e) => !e.closest('#calendly-inline'))
        .filter((e) => e.checkVisibility({ checkVisibilityCSS: true }));
      for (const e of els) {
        const cs = getComputedStyle(e);
        if (eigenTekst(e) || /^(INPUT|TEXTAREA|SELECT)$/i.test(e.tagName) || (e.tagName.toUpperCase() !== 'SVG' && e.querySelector(':scope > svg')) || e.tagName.toUpperCase() === 'SVG') meld('tekst', cs.color, e);
        meld('achtergrond', cs.backgroundColor, e);
      }
      return [...tel].map(([k, v]) => `${k} (${v.n}x, bv. ${v.bv.tagName.toLowerCase()} "${(v.bv.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30)}")`);
    }, [...TOEGESTAAN_RGB], OPAK_ZWART);
    assert.deepEqual(fout, [], `${naam}: kleuren buiten de merkkleuren zoals getoond:\n${fout.join('\n')}`);
  });
}

// ---------- Aanwijzen, Tab en indrukken ----------
// Markeert elke zichtbare knop, [role=button], submitknop, knop-achtige link en elke link in #main-nav en #footer
// (op blog ook kaarten en filterregels) met data-t. Alles binnen #calendly-inline en dichte vensters telt niet.
async function markeerSet(page, extraSelectors) {
  return page.evaluate((extra) => {
    window.__tn = window.__tn || 0;
    const set = new Set();
    document.querySelectorAll('button, [role="button"], input[type="submit"]').forEach((e) => set.add(e));
    document.querySelectorAll('a[href]').forEach((a) => {
      if (a.closest('#main-nav, #footer') || /(^|\s)(btn[\w-]*|[\w-]*button[\w-]*)(\s|$)/i.test(a.className)) set.add(a);
    });
    extra.forEach((s) => document.querySelectorAll(s).forEach((e) => set.add(e)));
    const uit = [];
    for (const e of set) {
      if (e.closest('#calendly-inline, #mobile-menu, #hamburger-btn') || e.disabled) continue;
      if (e.closest('[hidden], [inert]') || !e.checkVisibility({ checkVisibilityCSS: true })) continue;
      const r = e.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0 || getComputedStyle(e).pointerEvents === 'none') continue;
      const n = ++window.__tn;
      e.setAttribute('data-t', String(n));
      const t = (e.innerText || e.getAttribute('aria-label') || e.value || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      const href = e.getAttribute('href');
      uit.push({ n, label: `${e.tagName.toLowerCase()} "${t}"${href ? ` href=${href}` : ''}` });
    }
    return uit;
  }, extraSelectors);
}

const EXTRA = { blog: ['#articles-list article[data-cat]', '#cat-list li'], contact: ['form button[type="submit"], form [type="submit"]'] };

for (const naam of ZEVEN) {
  test(`10. ${naam} (1440): elke knop en link in menu en footer reageert op hover, Tab en indrukken`, async () => {
    const { page } = breed[naam];
    await page.bringToFront();
    await page.evaluate(() => window.scrollTo(0, 0));
    const elementen = await markeerSet(page, EXTRA[naam] || []);
    assert.ok(elementen.length > 0, `${naam}: geen bedienbare elementen gevonden`);
    const fouten = await meetToestanden(page, elementen);
    const melding = meldToestandsFouten(fouten, elementen.length);
    assert.equal(melding, null, `${naam}: ${melding}`);
  });

  test(`10. ${naam} (375): hamburger en elke link en knop in het open menu reageren op hover, Tab en indrukken`, async () => {
    const { page } = menu[naam];
    await page.bringToFront();
    await page.evaluate(() => window.scrollTo(0, 0));
    const hamburger = await page.evaluate(() => {
      const h = document.querySelector('#hamburger-btn');
      if (!h || !h.checkVisibility({ checkVisibilityCSS: true })) return [];
      window.__tn = window.__tn || 0;
      const n = ++window.__tn;
      h.setAttribute('data-t', String(n));
      return [{ n, label: 'button #hamburger-btn' }];
    });
    assert.ok(hamburger.length === 1, `${naam}: #hamburger-btn is niet zichtbaar op 375`);
    const eerst = await meetToestanden(page, hamburger);
    await page.click('#hamburger-btn');
    await wacht(150);
    assert.ok(await isOpen(page, '#mobile-menu'), `${naam}: het menu opent niet na een klik op #hamburger-btn`);
    const inMenu = await page.evaluate(() => {
      window.__tn = window.__tn || 0;
      const uit = [];
      document.querySelectorAll('#mobile-menu a[href], #mobile-menu button, #mobile-menu [role="button"]').forEach((e) => {
        if (!e.checkVisibility({ checkVisibilityCSS: true })) return;
        const r = e.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        const n = ++window.__tn;
        e.setAttribute('data-t', String(n));
        uit.push({ n, label: `${e.tagName.toLowerCase()} "${(e.innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40)}"${e.getAttribute('href') ? ` href=${e.getAttribute('href')}` : ''}` });
      });
      return uit;
    });
    assert.ok(inMenu.length > 0, `${naam}: geen links of knoppen in #mobile-menu`);
    const menuFouten = await meetToestanden(page, inMenu);
    const melding = meldToestandsFouten([...eerst, ...menuFouten], hamburger.length + inMenu.length);
    assert.equal(melding, null, `${naam}: ${melding}`);
  });
}

// ---------- Smal scherm ----------
for (const naam of ZEVEN) {
  test(`11. ${naam}: geen horizontaal schuiven op 375 en niets buiten beeld`, async () => {
    const { page } = smal[naam];
    await scrollEenmaal(page);
    const b = await schuifbreedte(page);
    assert.ok(b.scrollWidth <= b.clientWidth, `${naam}: scrollWidth ${b.scrollWidth} > clientWidth ${b.clientWidth}`);
    const fout = await page.evaluate(() => {
      const vensterBreedte = document.documentElement.clientWidth;
      const uit = [];
      const clipt = (e) => {
        for (let p = e.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
          if (getComputedStyle(p).overflowX !== 'visible') {
            const r = p.getBoundingClientRect();
            if (r.left >= -1 && r.right <= vensterBreedte + 1) return true;
          }
        }
        return false;
      };
      for (const e of document.querySelectorAll('body *')) {
        if (e.closest('#calendly-inline, #mobile-menu, svg')) continue;
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META'].includes(e.tagName)) continue;
        if (!e.checkVisibility({ checkVisibilityCSS: true })) continue;
        const r = e.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        if (r.right > 376 || r.left < -1) {
          if (clipt(e)) continue;
          uit.push(`${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''} "${(e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30)}" links ${Math.round(r.left)} rechts ${Math.round(r.right)}`);
        }
      }
      return uit.slice(0, 25);
    });
    assert.deepEqual(fout, [], `${naam}: elementen buiten 0-375:\n${fout.join('\n')}`);
  });
}

// ---------- Gelijke onderdelen over alle 9 pagina's ----------
const ONDERDELEN_1440 = [
  { naam: '#announcement-bar', kies: '#announcement-bar', props: ['background-color', 'color', 'font-family', 'font-size'], hoogte: 1 },
  { naam: '#main-nav', kies: '#main-nav', props: ['background-color'], hoogte: 1 },
  { naam: 'eerste menulink', kies: 'LINK', props: ['color', 'font-family', 'font-size', 'letter-spacing', 'text-transform'] },
  { naam: 'menuknop (afspraak)', kies: 'KNOP', props: ['background-color', 'background-image', 'color', 'border-radius', 'padding', 'font-family', 'font-size'] },
  { naam: '#footer', kies: '#footer', props: ['background-color', 'color', 'font-family'], hoogte: 2 },
  { naam: 'eerste footerlink', kies: 'FOOTLINK', props: ['color', 'font-size'] },
];
const ONDERDELEN_375 = [
  { naam: '#announcement-bar', kies: '#announcement-bar', props: ['background-color', 'color', 'font-family', 'font-size'], hoogte: 1 },
  { naam: '#main-nav', kies: '#main-nav', props: ['background-color'], hoogte: 1 },
  { naam: '#hamburger-btn', kies: '#hamburger-btn', props: ['background-color', 'color', 'border-radius', 'width', 'height'] },
];

async function meetOnderdelen(page, onderdelen) {
  await page.bringToFront();
  await page.evaluate(() => window.scrollTo(0, 600));
  await wacht(300);
  // laat de opacity-overgang van #main-nav::before afronden (hooguit 3 s; daarna meet de test wat er te zien is)
  await page.waitForFunction(() => {
    const n = document.querySelector('#main-nav');
    return !n || parseFloat(getComputedStyle(n, '::before').opacity) >= 0.99 || !/^rgba\(\d+, \d+, \d+, 0\)$|^transparent$/.test(getComputedStyle(n).backgroundColor);
  }, { timeout: 3000 }).catch(() => {});
  return page.evaluate((onderdelen) => {
    const zichtbaar = (e) => e.checkVisibility({ checkVisibilityCSS: true }) && e.getBoundingClientRect().width > 0;
    const actief = (a) => /active|current|actief/i.test(a.className) || a.hasAttribute('aria-current');
    const vind = (kies) => {
      if (kies === 'LINK') return [...document.querySelectorAll('#main-nav a[href]')].filter(zichtbaar).find((a) => a.textContent.trim() && !actief(a) && !/afspraak\.html/.test(a.getAttribute('href')));
      if (kies === 'KNOP') return [...document.querySelectorAll('#main-nav a[href]')].filter(zichtbaar).filter((a) => /afspraak\.html/.test(a.getAttribute('href'))).pop();
      if (kies === 'FOOTLINK') return [...document.querySelectorAll('#footer a[href]')].filter(zichtbaar)[0];
      return document.querySelector(kies);
    };
    const uit = {};
    for (const o of onderdelen) {
      const e = vind(o.kies);
      if (!e) { uit[o.naam] = null; continue; }
      const cs = getComputedStyle(e);
      const w = {};
      for (const p of o.props) w[p] = cs.getPropertyValue(p);
      if (e.id === 'main-nav' && o.props.includes('background-color') && /^rgba\(\d+, \d+, \d+, 0\)$|^transparent$/.test(w['background-color'])) {
        // ZICHTBARE achtergrond: die van ::before, maar alleen als die laag het hele menu dekt en (bijna) volledig zichtbaar is
        const b = getComputedStyle(e, '::before');
        const r = e.getBoundingClientRect();
        const dekt = b.content !== 'none' && b.display !== 'none' && b.visibility !== 'hidden' && (b.position === 'absolute' || b.position === 'fixed') &&
          Math.abs(parseFloat(b.width) - r.width) <= 1 && Math.abs(parseFloat(b.height) - r.height) <= 1;
        w['background-color'] = dekt && parseFloat(b.opacity) >= 0.99 ? b.backgroundColor : 'geen achtergrond';
      }
      w.__hoogte = e.getBoundingClientRect().height;
      uit[o.naam] = w;
    }
    return uit;
  }, onderdelen);
}

async function vergelijkPaginas(sets, onderdelen) {
  const metingen = {};
  for (const p of PAGINAS) metingen[p] = await meetOnderdelen(sets[p].page, onderdelen);
  const fouten = [];
  for (const o of onderdelen) {
    const ref = metingen[REF][o.naam];
    for (const p of PAGINAS) {
      if (p === REF) continue;
      const w = metingen[p][o.naam];
      if (!w || !ref) { fouten.push(`${p}: ${o.naam} niet gevonden${!ref ? ` (ook niet op ${REF})` : ''}`); continue; }
      for (const prop of o.props) {
        if (w[prop] !== ref[prop]) fouten.push(`${p}: ${o.naam} ${prop}: "${w[prop]}" tegenover ${REF} "${ref[prop]}"`);
      }
      if (o.hoogte !== undefined && Math.abs(w.__hoogte - ref.__hoogte) > o.hoogte) {
        fouten.push(`${p}: ${o.naam} hoogte: ${w.__hoogte} tegenover ${REF} ${ref.__hoogte}`);
      }
    }
  }
  return fouten;
}

test('12a. menu, balk, knop en footer zien er op alle 9 pagina\'s hetzelfde uit (1440, na scrollen)', async () => {
  const fouten = await vergelijkPaginas(breed, ONDERDELEN_1440);
  assert.deepEqual(fouten, [], `verschillen met ${REF}:\n${fouten.join('\n')}`);
});

test('12b. balk, menu en hamburgerknop zien er op alle 9 pagina\'s hetzelfde uit (375)', async () => {
  const fouten = await vergelijkPaginas(smal, ONDERDELEN_375);
  assert.deepEqual(fouten, [], `verschillen met ${REF}:\n${fouten.join('\n')}`);
});

// ---------- Geen fouten (laatste) ----------
for (const naam of ZONDER_OVER) {
  test(`13. ${naam}: geen console- of paginafouten op 1440 en 375`, () => {
    for (const [soort, set] of [['1440', breed[naam]], ['375', smal[naam]], ['375 menu', menu[naam]]]) {
      assert.deepEqual(set.fouten.console, [], `${naam} (${soort}): console-fouten`);
      assert.deepEqual(set.fouten.pagina, [], `${naam} (${soort}): paginafouten`);
    }
  });
}
