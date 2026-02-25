/* ═══════════════════════════════════════════════════════
   SCROLL ANIMATIONS
   Uses IntersectionObserver for performant scroll-triggered
   reveal animations. Respects prefers-reduced-motion.
   ═══════════════════════════════════════════════════════ */

const ScrollAnimations = (() => {
  const REVEAL_CLASS = "revealed";
  let observer = null;

  /**
   * Check if user prefers reduced motion.
   * If so, reveal everything immediately — no animations.
   */
  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /**
   * Create the IntersectionObserver with a threshold
   * that triggers when ~15% of the element is visible.
   */
  function createObserver() {
    return new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(REVEAL_CLASS);
            // Stop observing once revealed (one-time animation)
            observer.unobserve(entry.target);
          }
        });
      },
      {
        root: null,
        rootMargin: "0px 0px -60px 0px",
        threshold: 0.15,
      }
    );
  }

  /**
   * Animate hero stat counters when they scroll into view.
   */
  function initCounters() {
    const counters = document.querySelectorAll("[data-count]");
    if (!counters.length) return;

    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );

    counters.forEach((el) => counterObserver.observe(el));
  }

  /**
   * Smoothly count from 0 to the target number.
   * Uses easeOutQuart for a satisfying deceleration.
   */
  function animateCounter(el) {
    const target = parseInt(el.getAttribute("data-count"), 10);
    const duration = 2000; // ms
    const start = performance.now();

    function easeOutQuart(t) {
      return 1 - Math.pow(1 - t, 4);
    }

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutQuart(progress);
      const current = Math.round(eased * target);

      el.textContent = current;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = target;
      }
    }

    requestAnimationFrame(update);
  }

  /* ── Initialize ── */

  function init() {
    const elements = document.querySelectorAll(".reveal-up");

    if (prefersReducedMotion()) {
      // Immediately show all elements — skip animations
      elements.forEach((el) => el.classList.add(REVEAL_CLASS));
      // Still set counter values
      document.querySelectorAll("[data-count]").forEach((el) => {
        el.textContent = el.getAttribute("data-count");
      });
      return;
    }

    observer = createObserver();
    elements.forEach((el) => observer.observe(el));

    // Counters
    initCounters();
  }

  return { init };
})();
