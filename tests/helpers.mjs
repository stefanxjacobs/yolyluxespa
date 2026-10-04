// Gedeelde hulpfuncties voor de tests (cp1-cp7). Geen DOM-bibliotheek, geen nieuwe npm-pakketten.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SESSIE = process.env.YOLY_SESSIE || 'C:/Users/Stefa/Downloads/Claude/loops/yoly-prijzen-redesign';
export const PAGINAS = ['index', 'behandelingen', 'over', 'blog', 'contact', 'afspraak', 'algemene-voorwaarden', 'cookiebeleid', 'privacybeleid'];

export function leesHtml(naam) {
  return fs.readFileSync(path.join(ROOT, `${naam}.html`), 'utf8');
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'param']);
const ATTR = '(?:"[^"]*"|\'[^\']*\'|[^>"\'])*';
const TAG_BRON = `<(\\/?)([a-zA-Z][\\w:-]*)(${ATTR})>`;

// Vervang commentaar en de inhoud van script/style door spaties van dezelfde lengte, zodat posities kloppen.
function maskeer(html) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return html
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(new RegExp(`(<script\\b${ATTR}>)([\\s\\S]*?)(<\\/script\\s*>)`, 'gi'), (m, a, b, c) => a + blank(b) + c)
    .replace(new RegExp(`(<style\\b${ATTR}>)([\\s\\S]*?)(<\\/style\\s*>)`, 'gi'), (m, a, b, c) => a + blank(b) + c);
}

function attribuut(attrTekst, naam) {
  const esc = naam.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
  const re = new RegExp(`(?:^|\\s)${esc}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const m = attrTekst.match(re);
  return m ? (m[1] ?? m[2] ?? m[3]) : null;
}

// Einde (index na de sluittag) van het element dat net geopend is; `vanaf` staat direct na de openingstag.
function elementEinde(masked, naam, vanaf) {
  const re = new RegExp(TAG_BRON, 'g');
  re.lastIndex = vanaf;
  const lc = naam.toLowerCase();
  let diepte = 1;
  let m;
  while ((m = re.exec(masked))) {
    if (m[2].toLowerCase() !== lc) continue;
    if (m[1] === '/') diepte--;
    else if (!/\/\s*$/.test(m[3])) diepte++;
    if (diepte === 0) return re.lastIndex;
  }
  return masked.length;
}

export function blokken(html, attr) {
  const masked = maskeer(html);
  const re = new RegExp(TAG_BRON, 'g');
  const uit = [];
  let m;
  while ((m = re.exec(masked))) {
    if (m[1] === '/') continue;
    const naam = m[2];
    if (VOID.has(naam.toLowerCase())) continue;
    const waarde = attribuut(m[3], attr);
    if (waarde === null) continue;
    const einde = /\/\s*$/.test(m[3]) ? re.lastIndex : elementEinde(masked, naam, re.lastIndex);
    uit.push({ waarde, html: html.slice(m.index, einde), start: m.index });
  }
  return uit;
}

export function blok(html, attr, waarde) {
  const b = blokken(html, attr).find((x) => x.waarde === waarde);
  return b ? b.html : null;
}

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', euro: '€', plusmn: '±', ndash: '–', mdash: '—',
  rarr: '→', euml: 'ë', eacute: 'é', egrave: 'è', iuml: 'ï', ouml: 'ö', uuml: 'ü', hellip: '…', copy: '©',
  Euml: 'Ë', Eacute: 'É', ecirc: 'ê', agrave: 'à', aacute: 'á', ccedil: 'ç', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
};

function decodeer(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => (n in ENTITIES ? ENTITIES[n] : m));
}

// Normaliseer tekst zonder tags: nbsp -> spatie, witruimte samenvoegen, spatie vóór . , : ; ? ! weg.
export function normaliseer(s) {
  return s
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,:;?!])/g, '$1')
    .trim();
}

export function tekst(fragment) {
  const zonder = fragment
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(new RegExp(`<script\\b${ATTR}>[\\s\\S]*?<\\/script\\s*>`, 'gi'), ' ')
    .replace(new RegExp(`<style\\b${ATTR}>[\\s\\S]*?<\\/style\\s*>`, 'gi'), ' ')
    .replace(new RegExp(`<\\/?[a-zA-Z!]${ATTR}>`, 'g'), ' ');
  return normaliseer(decodeer(zonder));
}

// Zoek patroon in het gemaskeerde fragment; geef de bijbehorende stukken uit het origineel.
function stukken(fragment, re) {
  const masked = maskeer(fragment);
  const uit = [];
  let m;
  while ((m = re.exec(masked))) uit.push(fragment.slice(m.index, m.index + m[0].length));
  return uit;
}

export function koppen(fragment) {
  return stukken(fragment, new RegExp(`<h([1-4])\\b${ATTR}>[\\s\\S]*?<\\/h\\1\\s*>`, 'gi')).map(tekst);
}

export function lijstpunten(fragment) {
  return stukken(fragment, new RegExp(`<li\\b${ATTR}>[\\s\\S]*?<\\/li\\s*>`, 'gi')).map(tekst);
}

export function links(fragment) {
  return stukken(fragment, new RegExp(`<a\\b${ATTR}>[\\s\\S]*?<\\/a\\s*>`, 'gi')).map((s) => {
    const open = s.match(new RegExp(`^<a\\b(${ATTR})>`, 'i'));
    return { href: attribuut(open[1], 'href'), tekst: tekst(s) };
  });
}

export function bedragen(fragment) {
  return [...tekst(fragment).matchAll(/€\s*(\d+)/g)].map((m) => Number(m[1]));
}

export function duur(fragment) {
  const m = tekst(fragment).match(/(\d+)(?:\s*[–-]\s*(\d+))?\s*min\b/);
  if (!m) return null;
  return m[2] ? `${m[1]}-${m[2]}` : m[1];
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

export async function startServer() {
  const server = http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(req.url.split('?')[0]); } catch { p = '/'; }
    if (p === '/') p = '/index.html';
    const bestand = path.join(ROOT, p);
    if (!bestand.startsWith(ROOT)) { res.writeHead(403); res.end('403'); return; }
    fs.readFile(bestand, (err, data) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404 Not Found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(bestand).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise((ok, fout) => { server.once('error', fout); server.listen(0, '127.0.0.1', ok); });
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    stop: () => new Promise((ok) => { server.closeAllConnections?.(); server.close(() => ok()); }),
  };
}

export async function startBrowser() {
  const puppeteer = createRequire(import.meta.url)('puppeteer');
  return puppeteer.launch({ headless: true });
}

export async function openPagina(browser, url, { breedte = 1440, hoogte = 900, stil = true } = {}) {
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
  page.on('response', (r) => {
    if (r.url().startsWith(eigen) && r.status() >= 400) fouten.netwerk.push(`${r.status()} ${r.url()}`);
  });
  page.on('requestfailed', (r) => {
    const f = (r.failure() && r.failure().errorText) || '';
    if (r.url().startsWith(eigen) && !f.includes('ERR_ABORTED')) fouten.netwerk.push(`${f} ${r.url()}`);
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 }).catch(() => {});
  if (stil) {
    await page.addStyleTag({ content: '*{transition:none!important;animation:none!important;scroll-behavior:auto!important}' });
  }
  return { page, fouten };
}

export async function schuifbreedte(page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

export async function isOpen(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) >= 0.99 && cs.pointerEvents !== 'none';
  }, selector);
}
