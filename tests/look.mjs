// Gedeelde meetfuncties voor de look-tests (cp5 en cp6): kleurenlijst, bronscan, meting van toestanden.
// Bruikbaar voor alle 9 pagina's; de pagina's kies je in het testbestand (PAGINAS uit helpers.mjs of een deelverzameling).
// Omgevingsvariabelen om de MEETMETHODE te controleren tegen een referentie (bv. het prototype):
//   LOOK_PAGINAS  komma-lijst met paginanamen zonder .html (standaard: wat het testbestand opgeeft)
//   LOOK_URL      basis-url van een al draaiende server (standaard: eigen server op een vrije poort)
//   LOOK_ROOT     map waarin de html-bestanden staan voor de bronscan (standaard: de werkplek)
//   LOOK_CSS      lijst (met ;) css/js-bestanden voor de bronscan, relatief aan LOOK_ROOT of absoluut
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, startServer } from './helpers.mjs';

export const CP5_PAGINAS = ['index', 'behandelingen'];

export function paginasKeuze(standaard) {
  const e = process.env.LOOK_PAGINAS;
  return e ? e.split(',').map((s) => s.trim()).filter(Boolean) : standaard;
}

// ---------- Toegestane kleuren ----------
const rgbVanHex = (h) => {
  const x = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
};
export const MERKKLEUREN = {
  cream: '#FAF7F2', beige: '#E8DDD3', gold: '#C5A572', brown: '#3A2F2B', 'gold-dark': '#A8884E', 'brown-light': '#5C4D47',
};
// Besluit B13: de bestaande tinten van het goudverloop zijn op alle bestanden toegestaan.
export const GOUDTINTEN = { 'tint-1': '#D4B882', 'tint-2': '#EDD9A8', 'tint-3': '#F0E0B8' };
const ALLE = { ...MERKKLEUREN, ...GOUDTINTEN, wit: '#FFFFFF', zwart: '#000000' };
const TOEGESTAAN = new Set(Object.values(ALLE).map((h) => rgbVanHex(h).join(',')));
export const TOEGESTAAN_RGB = TOEGESTAAN;
export const OPAK_ZWART = '0,0,0';

// ---------- Kleuren in bron ----------
const URL_RE = /url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)/gi;
const HEX_RE = /(?<![\w&#])#([0-9a-fA-F]{3,8})(?![\w-])/g;
const FUNC_RE = /\b(rgba?|hsla?)\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi;

export function vindKleuren(tekst) {
  const schoon = tekst.replace(URL_RE, 'url()');
  const uit = [];
  for (const m of schoon.matchAll(HEX_RE)) uit.push(m[0]);
  for (const m of schoon.matchAll(FUNC_RE)) uit.push(m[0]);
  return uit;
}

export function kleurToegestaan(waarde) {
  const w = waarde.trim();
  if (w.startsWith('#')) {
    let h = w.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return false;
    return TOEGESTAAN.has(rgbVanHex('#' + h.slice(0, 6)).join(','));
  }
  const m = w.match(/^(rgba?|hsla?)\((.*)\)$/is);
  if (!m) return false;
  const inhoud = m[2];
  if (/var\(/i.test(inhoud)) return true; // kleur komt uit een variabele die zelf gescand wordt
  const delen = inhoud.split(/[\s,/]+/).filter(Boolean);
  if (m[1].toLowerCase().startsWith('rgb')) {
    const n = delen.slice(0, 3).map((d) => (d.endsWith('%') ? Math.round(parseFloat(d) * 2.55) : Math.round(parseFloat(d))));
    if (n.length < 3 || n.some(Number.isNaN)) return false;
    return TOEGESTAAN.has(n.join(','));
  }
  const l = parseFloat(delen[2]);
  return l === 100 || l === 0; // hsla(0,0%,100%,a) = wit; l = 0 = zwart
}

export function foutKleuren(tekst) {
  const tel = new Map();
  for (const k of vindKleuren(tekst)) if (!kleurToegestaan(k)) tel.set(k, (tel.get(k) || 0) + 1);
  return tel;
}

// ---------- Bronnen inlezen ----------
const zonderCommentaar = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ');
const zonderHtmlCommentaar = (s) => s.replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length));

export function binnensteBlokken(css) {
  return [...zonderCommentaar(css).matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]);
}

// Declaraties uit een html-pagina: <style>-inhoud (binnenste blokken), style="…" en svg-kleurattributen.
export function htmlDeclaraties(html) {
  const h = zonderHtmlCommentaar(html);
  const uit = [];
  for (const m of h.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) uit.push(...binnensteBlokken(m[1]));
  for (const m of h.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) uit.push(m[1] ?? m[2]);
  for (const m of h.matchAll(/\s(fill|stroke|stop-color|flood-color)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const v = (m[2] ?? m[3]).trim();
    uit.push(`${m[1]}: ${v}`);
  }
  return uit;
}

export function classAttributen(html) {
  return [...zonderHtmlCommentaar(html).matchAll(/\sclass\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)].map((m) => m[1] ?? m[2]);
}

function bestandsLijst() {
  const root = process.env.LOOK_ROOT ? path.resolve(process.env.LOOK_ROOT) : ROOT;
  if (process.env.LOOK_CSS) {
    return process.env.LOOK_CSS.split(';').map((p) => p.trim()).filter(Boolean).map((p) => path.resolve(root, p));
  }
  // Alle css en js in de root van de werkplek (theme.css wordt vanzelf meegenomen zodra het bestaat).
  return fs.readdirSync(ROOT).filter((f) => /\.(css|js)$/i.test(f)).sort().map((f) => path.join(ROOT, f));
}

// Geeft { naam, soort: 'html'|'css'|'js', tekst, declaraties } per bestand.
export function leesBronnen(paginas) {
  const root = process.env.LOOK_ROOT ? path.resolve(process.env.LOOK_ROOT) : ROOT;
  const uit = [];
  for (const p of paginas) {
    const f = path.join(root, `${p}.html`);
    const tekst = fs.readFileSync(f, 'utf8');
    uit.push({ naam: `${p}.html`, soort: 'html', tekst, declaraties: htmlDeclaraties(tekst) });
  }
  for (const f of bestandsLijst()) {
    if (!fs.existsSync(f)) continue;
    const tekst = fs.readFileSync(f, 'utf8');
    const naam = path.basename(f);
    if (/\.css$/i.test(f)) uit.push({ naam, soort: 'css', tekst, declaraties: binnensteBlokken(tekst) });
    else uit.push({ naam, soort: 'js', tekst, declaraties: [tekst] });
  }
  return uit;
}

// ---------- Lettertypes in bron ----------
export const TOEGESTANE_FAMILIES = ['playfair display', 'dm sans'];

export function eersteFamilie(waarde) {
  const eerste = waarde.split(',')[0].trim().replace(/!important/i, '').trim().replace(/^["']|["']$/g, '');
  return eerste.toLowerCase();
}

export function familiesInBron(bronnen) {
  const props = new Map();
  for (const b of bronnen) for (const d of b.declaraties) {
    if (b.soort === 'js') continue;
    for (const m of d.matchAll(/(?:^|[;\s{])(--[\w-]+)\s*:\s*([^;}]+)/g)) props.set(m[1], m[2].trim());
  }
  const los = (v, diepte = 0) => {
    const m = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/);
    if (!m || diepte > 4) return v;
    return los(props.get(m[1]) ?? m[2] ?? v, diepte + 1);
  };
  const uit = [];
  for (const b of bronnen) {
    if (b.soort === 'js') continue;
    for (const d of b.declaraties) {
      for (const m of d.matchAll(/(?:^|[;\s{])font-family\s*:\s*([^;}]+)/gi)) {
        const waarde = los(m[1].trim());
        uit.push({ bestand: b.naam, waarde: waarde.trim(), familie: eersteFamilie(waarde) });
      }
    }
  }
  return uit;
}

// ---------- Omgeving voor de browsertests ----------
export async function startOmgeving() {
  if (process.env.LOOK_URL) return { url: process.env.LOOK_URL.replace(/\/$/, ''), stop: async () => {} };
  return startServer();
}

// ---------- Meting in de pagina ----------
const EIGENSCHAPPEN = [
  'color', 'background-color', 'background-image', 'background-position',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'outline-style', 'outline-width', 'outline-color', 'outline-offset',
  'box-shadow', 'text-decoration-line', 'text-decoration-color', 'transform', 'opacity', 'filter',
];

// Als true telt de standaard-focusrand van de browser (outline-style: auto) ook als zichtbare ring.
// Staat bewust op false: de site moet zelf een ring of gloed tekenen (design.md: eigen focus-visible-staat).
export const STANDAARD_RING_TELT = false;

// Kies de elementen die de bezoeker kan bedienen en geef ze een attribuut data-t. Geeft [{n, label}] terug.
export async function markeerBedienbaar(page, rootSel = 'body') {
  return page.evaluate((rootSel) => {
    const root = document.querySelector(rootSel);
    if (!root) return [];
    window.__tn = window.__tn || 0;
    const sluit = rootSel === 'body' ? ['#treatment-modal', '#mobile-menu'] : [];
    const set = new Set();
    root.querySelectorAll('a[href], button, [role="button"], input[type="submit"], summary, [tabindex]:not([tabindex="-1"])').forEach((e) => set.add(e));
    const zichtbaar = (e) => {
      if (e.disabled || e.closest('[hidden], [inert]')) return false;
      if (sluit.some((s) => e.closest(s))) return false;
      if (!e.checkVisibility({ checkVisibilityCSS: true })) return false;
      const r = e.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      return getComputedStyle(e).pointerEvents !== 'none';
    };
    const uit = [];
    for (const e of set) {
      if (!zichtbaar(e)) continue;
      const n = ++window.__tn;
      e.setAttribute('data-t', String(n));
      const tekst = (e.innerText || e.getAttribute('aria-label') || e.querySelector('img')?.alt || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      const href = e.getAttribute('href');
      uit.push({ n, label: `${e.tagName.toLowerCase()} "${tekst}"${href ? ` href=${href}` : ''}` });
    }
    return uit;
  }, rootSel);
}

function snapshotInPagina(n, props) {
  const el = document.querySelector(`[data-t="${n}"]`);
  const uit = {};
  if (!el) return uit;
  const lees = (cs, voorvoegsel) => { for (const p of props) uit[`${voorvoegsel}|${p}`] = cs.getPropertyValue(p); };
  lees(getComputedStyle(el), 'el');
  lees(getComputedStyle(el, '::before'), '::before');
  lees(getComputedStyle(el, '::after'), '::after');
  [...el.querySelectorAll('*')].slice(0, 20).forEach((d, i) => lees(getComputedStyle(d), `nk${i}`));
  return uit;
}

function verschil(a, b) {
  return Object.keys(a).filter((k) => a[k] !== b[k]);
}

function ringZichtbaar(sleutels, focus) {
  for (const k of sleutels) {
    const [voor, prop] = k.split('|');
    if (prop === 'box-shadow' && focus[k] && focus[k] !== 'none') return true;
    if (prop.startsWith('outline-')) {
      const stijl = focus[`${voor}|outline-style`];
      const breed = parseFloat(focus[`${voor}|outline-width`]);
      if (stijl === 'none' || !(breed > 0)) continue;
      if (stijl === 'auto' && !STANDAARD_RING_TELT) continue;
      return true;
    }
  }
  return false;
}

// Meet hover, focus-visible en active voor de gemarkeerde elementen. Geeft [{label, ontbreekt:[...]}] (alleen de foute).
export async function meetToestanden(page, elementen) {
  const cdp = await page.createCDPSession();
  try {
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
    const snap = (n) => page.evaluate(snapshotInPagina, n, EIGENSCHAPPEN);
    const fouten = [];
    for (const { n, label } of elementen) {
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `[data-t="${n}"]` });
      if (!nodeId) { fouten.push({ label, ontbreekt: ['element niet terug te vinden'] }); continue; }
      const staat = async (lijst) => { await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: lijst }); return snap(n); };
      const rust = await snap(n);
      const hover = await staat(['hover']);
      const focus = await staat(['focus', 'focus-visible']);
      const hover2 = await staat(['hover']);
      const actief = await staat(['hover', 'active']);
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
      const ontbreekt = [];
      if (verschil(rust, hover).length === 0) ontbreekt.push('aanwijzen (hover)');
      const dFocus = verschil(rust, focus);
      if (dFocus.length === 0) ontbreekt.push('Tab (focus-visible): geen verschil');
      else if (!ringZichtbaar(dFocus, focus)) ontbreekt.push('Tab (focus-visible): wel verschil maar geen eigen ring of gloed (outline of box-shadow)');
      if (verschil(hover2, actief).length === 0) ontbreekt.push('indrukken (active)');
      if (ontbreekt.length) fouten.push({ label, ontbreekt });
    }
    return fouten;
  } finally {
    await cdp.detach().catch(() => {});
  }
}

export function meldToestandsFouten(fouten, aantal) {
  if (!fouten.length) return null;
  return `${fouten.length} van ${aantal} bedienbare elementen missen een toestand:\n` +
    fouten.map((f) => `  - ${f.label}: ${f.ontbreekt.join('; ')}`).join('\n');
}

// Scroll stap voor stap door de hele pagina zodat scroll-reveal klaar is.
export async function scrollDoorPagina(page) {
  const hoogte = await page.evaluate(() => document.documentElement.scrollHeight);
  const venster = page.viewport().height;
  for (let y = 0; y < hoogte; y += Math.round(venster * 0.6)) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await new Promise((r) => setTimeout(r, 40));
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await new Promise((r) => setTimeout(r, 60));
  await page.evaluate(() => window.scrollTo(0, 0));
}

// Zoek het element dat het venster van een behandeling opent en markeer het met data-open.
export async function markeerOpener(page, id) {
  return page.evaluate((id) => {
    document.querySelectorAll('[data-open]').forEach((e) => e.removeAttribute('data-open'));
    const t = document.querySelector(`[data-treatment="${id}"]`);
    if (!t) return null;
    const focusbaar = 'a[href], button, [role="button"], [tabindex]:not([tabindex="-1"])';
    const opener = t.matches(focusbaar) ? t : t.querySelector(focusbaar);
    if (!opener) return null;
    opener.setAttribute('data-open', '1');
    return opener.tagName.toLowerCase();
  }, id);
}
