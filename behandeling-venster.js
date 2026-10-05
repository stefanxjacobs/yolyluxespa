/* behandeling-venster.js: het gedeelde venster voor de behandelingen.
 *
 * Eén bron voor de gegevens: de kaart op de pagina. Het venster heeft geen eigen
 * lijst met namen, prijzen of teksten; het leest alles uit het element
 * [data-treatment] waarop geklikt is. Wijzig je de kaart, dan wijzigt het venster mee.
 *
 * Wat de kaart moet bevatten (haken, geen klassenamen):
 *   [data-treatment="<id>"]         de kaart zelf (met tabindex="0" voor het toetsenbord)
 *   [data-veld="prijs"]             "€55" of "Prijs op aanvraag"
 *   [data-veld="naam"]              de naam van de behandeling
 *   [data-veld="zin"]               één of meer alinea's beschrijving
 *   [data-veld="lijstkop"] + <li>   optioneel: kop van de lijst en de punten
 *   [data-veld="extra-kop"]         optioneel: "Ideaal voor", "Resultaat"
 *   [data-veld="extra"]             optioneel: de regel onder de lijst
 *   [data-veld="duur"]              optioneel: "± 60 min"
 *   <img>                           de foto
 *   button[data-open-venster]       optioneel: een knop in de kaart die het venster opent (dan hoeft de kaart geen tabindex)
 *
 * Wat de pagina moet bevatten: #treatment-modal met de onderdelen
 * #modal-img, #modal-price, #modal-duur, #modal-title-el, #modal-desc,
 * #modal-list-label, #modal-benefits, #modal-extra-label, #modal-extra
 * en een sluitknop met aria-label="Sluiten".
 */
(function () {
  'use strict';

  var modal = document.getElementById('treatment-modal');
  if (!modal) return;

  var deel = function (id) { return document.getElementById(id); };
  var img = deel('modal-img');
  var prijs = deel('modal-price');
  var duur = deel('modal-duur');
  var titel = deel('modal-title-el');
  var zinnen = deel('modal-desc');
  var lijstkop = deel('modal-list-label');
  var lijst = deel('modal-benefits');
  var extraKop = deel('modal-extra-label');
  var extra = deel('modal-extra');
  var sluitknop = modal.querySelector('[aria-label="Sluiten"]');
  var opener = null;

  function schoon(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

  function velden(kaart, naam) {
    return Array.prototype.map.call(
      kaart.querySelectorAll('[data-veld="' + naam + '"]'),
      function (el) { return schoon(el.textContent); }
    ).filter(Boolean);
  }

  function zet(el, tekst) {
    if (!el) return;
    el.textContent = tekst || '';
    el.hidden = !tekst;
  }

  function vul(el, tag, teksten) {
    if (!el) return;
    el.textContent = '';
    teksten.forEach(function (t) {
      var kind = document.createElement(tag);
      kind.textContent = t;
      el.appendChild(kind);
    });
    el.hidden = teksten.length === 0;
  }

  function openVenster(kaart, terug) {
    var naam = velden(kaart, 'naam')[0] || '';
    var foto = kaart.querySelector('img');
    var punten = Array.prototype.map.call(kaart.querySelectorAll('li'), function (li) { return schoon(li.textContent); });

    if (img) {
      if (foto) { img.src = foto.getAttribute('src'); img.alt = foto.getAttribute('alt') || naam; }
      else { img.removeAttribute('src'); img.alt = ''; }
    }
    zet(prijs, velden(kaart, 'prijs')[0]);
    zet(duur, velden(kaart, 'duur')[0]);
    zet(titel, naam);
    vul(zinnen, 'p', velden(kaart, 'zin'));
    zet(lijstkop, punten.length ? velden(kaart, 'lijstkop')[0] : '');
    vul(lijst, 'li', punten);
    zet(extraKop, velden(kaart, 'extra-kop')[0]);
    zet(extra, velden(kaart, 'extra')[0]);

    opener = terug || kaart; // waar de focus na sluiten naartoe gaat
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (sluitknop) sluitknop.focus();
  }

  function sluitVenster() {
    if (!modal.classList.contains('open')) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
    if (opener && document.contains(opener)) opener.focus();
    opener = null;
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-treatment]'), function (kaart) {
    kaart.addEventListener('click', function (e) {
      // Links en knoppen op de kaart (bv. "Afspraak maken") doen hun eigen werk.
      // Uitzondering: een knop met data-open-venster (de foto in een behandelrij) opent het venster.
      var bediening = e.target.closest('a, button');
      if (bediening && !bediening.hasAttribute('data-open-venster')) return;
      // Heeft de kaart zo'n knop (behandelrij), dan opent verder alleen de naam het venster, niet de hele rij.
      if (!bediening && kaart.querySelector('[data-open-venster]') && !e.target.closest('[data-veld="naam"]')) return;
      openVenster(kaart, bediening);
    });
    kaart.addEventListener('keydown', function (e) {
      if (e.target !== kaart) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openVenster(kaart);
      }
    });
  });

  if (sluitknop) sluitknop.addEventListener('click', sluitVenster);
  modal.addEventListener('click', function (e) { if (e.target === modal) sluitVenster(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') sluitVenster(); });
})();
