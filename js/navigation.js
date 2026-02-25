/* ═══════════════════════════════════════════════════════
   NAVIGATION
   Handles mobile menu, scroll behavior, active link
   tracking, and header styling on scroll.
   ═══════════════════════════════════════════════════════ */

const Navigation = (() => {
  const header = document.querySelector(".site-header");
  const hamburger = document.getElementById("nav-hamburger");
  const navLinks = document.getElementById("nav-links");
  const links = navLinks ? navLinks.querySelectorAll(".nav__link") : [];
  const sections = document.querySelectorAll("section[id]");

  let isMenuOpen = false;

  /* ── Mobile Menu Toggle ── */

  function openMenu() {
    isMenuOpen = true;
    navLinks.classList.add("nav__links--open");
    hamburger.setAttribute("aria-expanded", "true");
    hamburger.setAttribute("aria-label", "Close menu");
    document.body.style.overflow = "hidden";
  }

  function closeMenu() {
    isMenuOpen = false;
    navLinks.classList.remove("nav__links--open");
    hamburger.setAttribute("aria-expanded", "false");
    hamburger.setAttribute("aria-label", "Open menu");
    document.body.style.overflow = "";
  }

  function toggleMenu() {
    isMenuOpen ? closeMenu() : openMenu();
  }

  /* ── Header Scroll Effect ── */

  function handleScroll() {
    if (!header) return;

    if (window.scrollY > 50) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  }

  /* ── Active Link Tracking ── */

  function updateActiveLink() {
    const scrollPos = window.scrollY + window.innerHeight / 3;

    sections.forEach((section) => {
      const top = section.offsetTop - 100;
      const bottom = top + section.offsetHeight;
      const id = section.getAttribute("id");

      links.forEach((link) => {
        if (link.getAttribute("href") === `#${id}`) {
          if (scrollPos >= top && scrollPos < bottom) {
            link.classList.add("nav__link--active");
          } else {
            link.classList.remove("nav__link--active");
          }
        }
      });
    });
  }

  /* ── Smooth Scroll for Nav Links ── */

  function handleNavClick(e) {
    const href = e.currentTarget.getAttribute("href");
    if (!href || !href.startsWith("#")) return;

    e.preventDefault();
    const target = document.querySelector(href);
    if (!target) return;

    // Close mobile menu if open
    if (isMenuOpen) closeMenu();

    // Smooth scroll to section
    const offset = header ? header.offsetHeight : 0;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;

    window.scrollTo({
      top,
      behavior: "smooth",
    });

    // Update URL hash without jumping
    history.pushState(null, null, href);
  }

  /* ── Keyboard: Escape closes menu ── */

  function handleKeydown(e) {
    if (e.key === "Escape" && isMenuOpen) {
      closeMenu();
      hamburger.focus();
    }
  }

  /* ── Initialize ── */

  function init() {
    // Hamburger
    if (hamburger) {
      hamburger.addEventListener("click", toggleMenu);
    }

    // Nav link clicks
    links.forEach((link) => {
      link.addEventListener("click", handleNavClick);
    });

    // Also handle footer and hero CTA links
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      if (!link.classList.contains("nav__link")) {
        link.addEventListener("click", handleNavClick);
      }
    });

    // Scroll events (throttled via passive listener + rAF)
    let ticking = false;
    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          requestAnimationFrame(() => {
            handleScroll();
            updateActiveLink();
            ticking = false;
          });
          ticking = true;
        }
      },
      { passive: true }
    );

    // Keyboard
    document.addEventListener("keydown", handleKeydown);

    // Initial state
    handleScroll();
  }

  return { init };
})();
