/**
 * YolyLuxeSpa — Luxury Scroll Reveal Engine
 *
 * Elementen met .reveal, .reveal-left, .reveal-right,
 * .reveal-scale, .reveal-fade of .reveal-line worden
 * zichtbaar zodra ze het scherm in scrollen.
 *
 * Geen fallback-timeout — elementen blijven verborgen
 * totdat ze écht in beeld zijn.
 */
(function () {
  'use strict';

  const SELECTOR =
    '.reveal, .reveal-left, .reveal-right, .reveal-scale, .reveal-fade, .reveal-line';

  /* ── Auto-stagger voor grid-containers ─────────────────── */
  /* Voeg class .stagger-group toe aan een wrapper:
     de directe .reveal-kinderen krijgen automatisch
     berekende delays (0, 0.12, 0.24, 0.36 …) */
  function applyAutoStagger() {
    document.querySelectorAll('.stagger-group').forEach(function (group) {
      var children = group.querySelectorAll(
        ':scope > .reveal, :scope > .reveal-left, :scope > .reveal-right, :scope > .reveal-scale'
      );
      children.forEach(function (el, i) {
        /* Niet overschrijven als handmatige delay-klasse aanwezig is */
        var hasManual =
          el.classList.contains('reveal-d1') ||
          el.classList.contains('reveal-d2') ||
          el.classList.contains('reveal-d3') ||
          el.classList.contains('reveal-d4') ||
          el.classList.contains('reveal-d5') ||
          el.classList.contains('reveal-d6');
        if (!hasManual) {
          el.style.transitionDelay = (i * 0.12).toFixed(2) + 's';
        }
      });
    });
  }

  /* ── IntersectionObserver ───────────────────────────────── */
  function initReveal() {
    /* Toegankelijkheid: reduceer-beweging voorkeur → alles meteen zichtbaar */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll(SELECTOR).forEach(function (el) {
        el.classList.add('visible');
      });
      return;
    }

    applyAutoStagger();

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        /* Element moet 12% in beeld zijn én 3% van schermrand verwijderd */
        threshold: 0.12,
        rootMargin: '-3% 0px -3% 0px'
      }
    );

    document.querySelectorAll(SELECTOR).forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ── Initialisatie ──────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReveal);
  } else {
    initReveal();
  }
})();
