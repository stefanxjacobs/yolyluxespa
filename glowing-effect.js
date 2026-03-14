/**
 * Glowing Gold Border — Vanilla JS
 * Mouse-tracking spotlight border effect for .glow-border elements.
 * Adapted from the GlowingEffect React component by Aceternity UI.
 */
(function () {
  'use strict';

  const PROXIMITY = 80;       // px from element edge to activate glow
  const INACTIVE_ZONE = 0.6;  // fraction of smallest dimension = dead zone at center
  const MOVEMENT_EASE = 0.12; // lerp factor for smooth angle follow

  let elements = [];
  let rafId = null;
  let lastMouse = { x: 0, y: 0 };
  let currentAngles = new WeakMap(); // per-element smoothed angle

  const GLOW_SELECTOR = [
    '.treatment-card',
    '.article-card',
    '.blog-card',
    '.testimonial-card',
    '.gallery-item',
    '.featured-article',
    '.featured-img-wrap',
    '.asymmetric-img-wrap',
    '.experience-img-wrap',
    '.glow-border',
  ].join(',');

  function getElements() {
    elements = Array.from(document.querySelectorAll(GLOW_SELECTOR));
    // Init angle state
    elements.forEach(el => {
      if (!currentAngles.has(el)) currentAngles.set(el, 0);
    });
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function shortestAngleDiff(from, to) {
    let diff = ((to - from + 180) % 360) - 180;
    if (diff < -180) diff += 360;
    return diff;
  }

  function update() {
    const mx = lastMouse.x;
    const my = lastMouse.y;

    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;

      // Inactive zone: dead zone at center of element
      const inactiveRadius = 0.5 * Math.min(rect.width, rect.height) * INACTIVE_ZONE;
      const distFromCenter = Math.hypot(mx - cx, my - cy);

      if (distFromCenter < inactiveRadius) {
        el.style.setProperty('--glow-active', '0');
        return;
      }

      // Proximity check
      const inProximity =
        mx > rect.left  - PROXIMITY &&
        mx < rect.right  + PROXIMITY &&
        my > rect.top    - PROXIMITY &&
        my < rect.bottom + PROXIMITY;

      if (!inProximity) {
        el.style.setProperty('--glow-active', '0');
        return;
      }

      el.style.setProperty('--glow-active', '1');

      // Target angle: atan2 from center to mouse, +90 to start at top
      const targetAngle = (Math.atan2(my - cy, mx - cx) * 180 / Math.PI) + 90;

      // Smooth lerp toward target angle (shortest path)
      let current = currentAngles.get(el) || 0;
      const diff = shortestAngleDiff(current, targetAngle);
      current = current + diff * MOVEMENT_EASE;
      currentAngles.set(el, current);

      el.style.setProperty('--glow-angle', current + 'deg');
    });

    rafId = null;
  }

  function scheduleUpdate() {
    if (!rafId) rafId = requestAnimationFrame(update);
  }

  function onPointerMove(e) {
    lastMouse.x = e.clientX;
    lastMouse.y = e.clientY;
    scheduleUpdate();
  }

  function onScroll() {
    // Re-run with last known mouse position (elements have shifted)
    scheduleUpdate();
  }

  function init() {
    getElements();

    if (elements.length === 0) return;

    document.body.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    // Re-collect elements if DOM changes (e.g. modal opens)
    const observer = new MutationObserver(getElements);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
