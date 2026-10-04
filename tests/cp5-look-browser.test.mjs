// cp5: de look zoals getoond, in een echte browser (puppeteer, eigen server op een vrije poort).
// Per pagina (index en behandelingen): lettertypes, kleuren, hover/Tab/indrukken, 375 pixels, geen fouten.
// Hangt aan zichtbare elementen en de vaste haken (#main-nav, #hamburger-btn, #mobile-menu, #treatment-modal,
// [data-treatment], [aria-label="Sluiten"]); niet aan klassenamen.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startBrowser, openPagina, schuifbreedte, isOpen } from './helpers.mjs';
import {
  CP5_PAGINAS, paginasKeuze, startOmgeving, TOEGESTAAN_RGB, OPAK_ZWART, TOEGESTANE_FAMILIES, eersteFamilie,
  markeerBedienbaar, meetToestanden, meldToestandsFouten, scrollDoorPagina, markeerOpener,
} from './look.mjs';

const PAGINAS = paginasKeuze(CP5_PAGINAS);
const MODAL = '#treatment-modal';
const doorgescrold = new WeakSet();
async function scrollEenmaal(page) {
  if (doorgescrold.has(page)) return;
  await scrollDoorPagina(page);
  doorgescrold.add(page);
}
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

let omgeving, browser;
const breed = {};
const smal = {};
const menu = {};

before(async () => {
  omgeving = await startOmgeving();
  browser = await startBrowser();
  // Per pagina drie tabbladen: breed (1440), smal (375) en menu (375, alleen voor het openen van het menu:
  // het menu laat na sluiten, zonder overgangen, een onzichtbare laag achter die latere klikken opvangt).
  await Promise.all(PAGINAS.map(async (naam) => {
    const url = `${omgeving.url}/${naam}.html`;
    const [b1, s1, m1] = await Promise.all([
      openPagina(browser, url, { breedte: 1440, hoogte: 900 }),
      openPagina(browser, url, { breedte: 375, hoogte: 812 }),
      openPagina(browser, url, { breedte: 375, hoogte: 812 }),
    ]);
    breed[naam] = { ...b1, url };
    smal[naam] = { ...s1, url };
    menu[naam] = { ...m1, url };
  }));
});

after(async () => {
  try { if (browser) await browser.close(); } catch {}
  try { if (omgeving) await omgeving.stop(); } catch {}
});

async function wachtOpen(page, open) {
  const eind = Date.now() + 3000;
  while (Date.now() < eind) {
    if ((await isOpen(page, MODAL)) === open) return true;
    await wacht(50);
  }
  return false;
}

async function openVenster(page, naam) {
  await page.bringToFront();
  await page.evaluate(() => window.scrollTo(0, 0));
  const soort = await markeerOpener(page, 'basis');
  assert.ok(soort, `${naam}: [data-treatment="basis"] is niet focusbaar en bevat ook geen knop of link om het venster te openen`);
  await page.click('[data-open="1"]');
  assert.ok(await wachtOpen(page, true), `${naam}: het venster opent niet na een klik op de behandeling basis`);
}

async function sluitVenster(page) {
  await page.keyboard.press('Escape');
  await wachtOpen(page, false);
}

// ---------- Lettertypes (1440) ----------
const meetFamilies = (page, selector, minTekens = 0) => page.evaluate((selector, minTekens) => {
  const eigenTekst = (e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
  return [...document.querySelectorAll(selector)]
    .filter((e) => e.checkVisibility({ checkVisibilityCSS: true }) && e.getBoundingClientRect().width > 0)
    .filter((e) => minTekens === 0 || eigenTekst(e).length > minTekens)
    .map((e) => ({ label: `${e.tagName.toLowerCase()} "${(e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40)}"`, familie: getComputedStyle(e).fontFamily }));
}, selector, minTekens);

for (const naam of PAGINAS) {
  test(`6. ${naam}: koppen (h1, h2, h3) in Playfair Display`, async () => {
    const lijst = await meetFamilies(breed[naam].page, 'h1, h2, h3');
    assert.ok(lijst.length > 0, `${naam}: geen zichtbare koppen gevonden`);
    const fout = lijst.filter((x) => eersteFamilie(x.familie) !== 'playfair display');
    assert.deepEqual(fout, [], `${naam}: koppen niet in Playfair Display:\n${fout.map((x) => `  ${x.label}: ${x.familie}`).join('\n')}`);
  });

  test(`7. ${naam}: lopende tekst (body, p, li > 60 tekens) in DM Sans`, async () => {
    const lijst = [...await meetFamilies(breed[naam].page, 'body'), ...await meetFamilies(breed[naam].page, 'p, li', 60)];
    const fout = lijst.filter((x) => eersteFamilie(x.familie) !== 'dm sans');
    assert.deepEqual(fout, [], `${naam}: lopende tekst niet in DM Sans:\n${fout.map((x) => `  ${x.label}: ${x.familie}`).join('\n')}`);
  });

  test(`8. ${naam}: geen derde lettertype`, async () => {
    const lijst = await meetFamilies(breed[naam].page, 'body *:not(script):not(style):not(noscript)', 1);
    const fout = lijst.filter((x) => !TOEGESTANE_FAMILIES.includes(eersteFamilie(x.familie)));
    const uniek = [...new Set(fout.map((x) => `${x.familie}  (bv. ${x.label})`))];
    assert.deepEqual(uniek, [], `${naam}: andere eerste familie dan Playfair Display of DM Sans:\n${uniek.join('\n')}`);
  });
}

// ---------- Kleuren zoals getoond (1440) ----------
for (const naam of PAGINAS) {
  test(`9. ${naam}: tekst- en vlakkleuren zijn merkkleuren`, async () => {
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
      const els = [...document.querySelectorAll('body, body *')].filter((e) => !['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META', 'PATH', 'LINE', 'CIRCLE', 'RECT', 'POLYLINE', 'POLYGON', 'G', 'DEFS', 'SOURCE'].includes(e.tagName.toUpperCase()) || false)
        .filter((e) => e.checkVisibility({ checkVisibilityCSS: true }));
      for (const e of els) {
        const cs = getComputedStyle(e);
        // Tekstkleur telt waar ze zichtbaar is: eigen tekst, een svg met currentColor erin, of een invoerveld.
        if (eigenTekst(e) || /^(INPUT|TEXTAREA|SELECT)$/i.test(e.tagName) || (e.tagName.toUpperCase() !== 'SVG' && e.querySelector(':scope > svg')) || e.tagName.toUpperCase() === 'SVG') meld('tekst', cs.color, e);
        meld('achtergrond', cs.backgroundColor, e);
      }
      return [...tel].map(([k, v]) => `${k} (${v.n}x, bv. ${v.bv.tagName.toLowerCase()} "${(v.bv.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30)}")`);
    }, [...TOEGESTAAN_RGB], OPAK_ZWART);
    assert.deepEqual(fout, [], `${naam}: kleuren buiten de merkkleuren zoals getoond:\n${fout.join('\n')}`);
  });
}

// ---------- Aanwijzen, Tab en indrukken ----------
for (const naam of PAGINAS) {
  test(`10-12. ${naam} (1440): elke link, knop en klikbare behandeling reageert op hover, Tab en indrukken`, async () => {
    const { page } = breed[naam];
    await page.evaluate(() => window.scrollTo(0, 0));
    const elementen = await markeerBedienbaar(page, 'body');
    assert.ok(elementen.length > 0, `${naam}: geen bedienbare elementen gevonden`);
    // Elke zichtbare behandeling moet met toetsenbord en muis te bedienen zijn (zelf focusbaar of met opener erin).
    const zonderOpener = await page.evaluate(() => {
      const focusbaar = 'a[href], button, [role="button"], [tabindex]:not([tabindex="-1"])';
      return [...document.querySelectorAll('[data-treatment]')]
        .filter((t) => t.checkVisibility({ checkVisibilityCSS: true }))
        .filter((t) => !t.matches(focusbaar) && !t.querySelector(focusbaar))
        .map((t) => t.getAttribute('data-treatment'));
    });
    const fouten = await meetToestanden(page, elementen);
    for (const id of zonderOpener) fouten.push({ label: `[data-treatment="${id}"]`, ontbreekt: ['niet bedienbaar: niet focusbaar en geen knop of link erin'] });
    const melding = meldToestandsFouten(fouten, elementen.length);
    assert.equal(melding, null, `${naam}: ${melding}`);
  });

  test(`10-12. ${naam} (375): hamburger en elke link en knop in het open menu reageren op hover, Tab en indrukken`, async () => {
    const { page } = menu[naam];
    await page.evaluate(() => window.scrollTo(0, 0));
    const hamburger = await markeerBedienbaar(page, '#main-nav');
    const hamburgerEl = await page.evaluate(() => {
      const h = document.querySelector('#hamburger-btn');
      return !!h && h.checkVisibility({ checkVisibilityCSS: true });
    });
    assert.ok(hamburgerEl, `${naam}: #hamburger-btn is niet zichtbaar op 375`);
    const eerst = await meetToestanden(page, hamburger);
    await page.bringToFront();
    await page.click('#hamburger-btn');
    await wacht(100);
    assert.ok(await isOpen(page, '#mobile-menu'), `${naam}: het menu opent niet na een klik op #hamburger-btn`);
    const inMenu = await markeerBedienbaar(page, '#mobile-menu');
    assert.ok(inMenu.length > 0, `${naam}: geen links of knoppen in #mobile-menu`);
    const menuFouten = await meetToestanden(page, inMenu);
    const melding = meldToestandsFouten([...eerst, ...menuFouten], hamburger.length + inMenu.length);
    // (menu blijft open op dit eigen tabblad; zie before())
    assert.equal(melding, null, `${naam}: ${melding}`);
  });

  test(`10-12. ${naam} (1440): in het open venster reageren de sluitknop en Afspraak maken`, async () => {
    const { page } = breed[naam];
    await openVenster(page, naam);
    try {
      await page.evaluate((MODAL) => {
        window.__tn = window.__tn || 0;
        const m = document.querySelector(MODAL);
        const sluit = m.querySelector('[aria-label="Sluiten"]');
        const afspraak = [...m.querySelectorAll('a, button')].filter((e) => /afspraak maken/i.test(e.textContent)).filter((e) => e.checkVisibility({ checkVisibilityCSS: true }));
        window.__venster = [sluit, ...afspraak].filter(Boolean).map((e) => {
          const n = ++window.__tn;
          e.setAttribute('data-t', String(n));
          return { n, label: `${e.tagName.toLowerCase()} "${(e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40)}"${e.getAttribute('href') ? ` href=${e.getAttribute('href')}` : ''}` };
        });
      }, MODAL);
      const lijst = await page.evaluate(() => window.__venster);
      assert.ok(lijst.length >= 2, `${naam}: in het venster ontbreekt de sluitknop of de knop Afspraak maken (gevonden: ${lijst.length})`);
      const fouten = await meetToestanden(page, lijst);
      const melding = meldToestandsFouten(fouten, lijst.length);
      assert.equal(melding, null, `${naam}: ${melding}`);
    } finally {
      await sluitVenster(page);
    }
  });

  test(`13. ${naam}: echte Tab-toets geeft de eerste link in #main-nav een zichtbare focusstaat`, async () => {
    const { page } = breed[naam];
    await page.bringToFront();
    await page.evaluate(() => { window.scrollTo(0, 0); document.activeElement && document.activeElement.blur(); });
    let gevonden = null;
    for (let i = 0; i < 40 && !gevonden; i++) {
      await page.keyboard.press('Tab');
      gevonden = await page.evaluate(() => {
        const a = document.activeElement;
        if (!a || !a.closest('#main-nav') || !a.matches('a')) return null;
        const cs = getComputedStyle(a);
        return { focusVisible: a.matches(':focus-visible'), outline: cs.outlineStyle, schaduw: cs.boxShadow, tekst: a.textContent.trim().slice(0, 30) };
      });
    }
    assert.ok(gevonden, `${naam}: met Tab kom je niet bij een link in #main-nav`);
    assert.ok(gevonden.focusVisible, `${naam}: link "${gevonden.tekst}" heeft geen :focus-visible na Tab`);
    assert.ok(gevonden.outline !== 'none' || gevonden.schaduw !== 'none', `${naam}: link "${gevonden.tekst}" toont geen ring of gloed bij focus (outline ${gevonden.outline}, box-shadow ${gevonden.schaduw})`);
  });
}

// ---------- Smal scherm (375 x 812) ----------
for (const naam of PAGINAS) {
  test(`14. ${naam}: geen horizontaal schuiven op 375`, async () => {
    const { page } = smal[naam];
    await scrollEenmaal(page);
    const b = await schuifbreedte(page);
    assert.ok(b.scrollWidth <= b.clientWidth, `${naam}: scrollWidth ${b.scrollWidth} > clientWidth ${b.clientWidth}`);
  });

  test(`15. ${naam}: niets steekt buiten beeld op 375`, async () => {
    const { page } = smal[naam];
    await scrollEenmaal(page);
    const fout = await page.evaluate(() => {
      const vensterBreedte = document.documentElement.clientWidth;
      const uit = [];
      const clipt = (e) => {
        for (let p = e.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o !== 'visible') {
            const r = p.getBoundingClientRect();
            if (r.left >= -1 && r.right <= vensterBreedte + 1) return true;
          }
        }
        return false;
      };
      for (const e of document.querySelectorAll('body *')) {
        if (e.closest('#tekstband, #mobile-menu, #treatment-modal, svg')) continue;
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META'].includes(e.tagName)) continue;
        if (!e.checkVisibility({ checkVisibilityCSS: true })) continue;
        const r = e.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        if (r.right > vensterBreedte + 1 || r.left < -1) {
          if (clipt(e)) continue;
          uit.push(`${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''} "${(e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30)}" links ${Math.round(r.left)} rechts ${Math.round(r.right)}`);
        }
      }
      return uit.slice(0, 25);
    });
    assert.deepEqual(fout, [], `${naam}: elementen buiten 0-375:\n${fout.join('\n')}`);
  });

  test(`16. ${naam}: het venster past op 375 en de sluitknop is bereikbaar`, async () => {
    const { page } = smal[naam];
    await openVenster(page, naam);
    try {
      const m = await page.evaluate((MODAL) => {
        const modal = document.querySelector(MODAL);
        const sluit = modal.querySelector('[aria-label="Sluiten"]');
        const paneel = [...modal.children].find((c) => c.contains(sluit)) || sluit.parentElement;
        const p = paneel.getBoundingClientRect();
        const s = sluit.getBoundingClientRect();
        const top = document.elementFromPoint(s.left + s.width / 2, s.top + s.height / 2);
        return {
          paneelLinks: p.left, paneelRechts: p.right, venster: document.documentElement.clientWidth,
          sluitZichtbaar: s.width > 0 && s.height > 0 && s.top >= 0 && s.bottom <= innerHeight && s.left >= 0 && s.right <= document.documentElement.clientWidth,
          sluitBovenaan: !!top && (sluit === top || sluit.contains(top)),
        };
      }, MODAL);
      assert.ok(m.paneelLinks >= -0.5 && m.paneelRechts <= m.venster + 0.5, `${naam}: paneel valt buiten 0-${m.venster} (links ${m.paneelLinks}, rechts ${m.paneelRechts})`);
      assert.ok(m.sluitZichtbaar, `${naam}: sluitknop niet volledig zichtbaar in beeld`);
      assert.ok(m.sluitBovenaan, `${naam}: sluitknop is niet het bovenste element op zijn middelpunt`);
    } finally {
      await sluitVenster(page);
    }
  });
}

// ---------- Geen fouten (laatste: verzamelt alles wat tijdens de run gebeurde) ----------
for (const naam of PAGINAS) {
  test(`17. ${naam}: geen console- of paginafouten op 1440 en 375`, () => {
    for (const [soort, set] of [['1440', breed[naam]], ['375', smal[naam]], ['375 menu', menu[naam]]]) {
      assert.deepEqual(set.fouten.console, [], `${naam} (${soort}): console-fouten`);
      assert.deepEqual(set.fouten.pagina, [], `${naam} (${soort}): paginafouten`);
    }
  });
}
