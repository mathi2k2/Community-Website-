/* ═══════════════════════════════════════════════════════
   INTERACTIVE COMPONENTS
   Preloader, form validation, hero particles, mouse glow,
   back-to-top, and other UI logic.
   ═══════════════════════════════════════════════════════ */

const Components = (() => {

  /* ═══════════ PRELOADER ═══════════ */

  function initPreloader() {
    const preloader = document.getElementById("preloader");
    if (!preloader) return;

    window.addEventListener("load", () => {
      // Small delay so the animation is visible
      setTimeout(() => {
        preloader.classList.add("preloader--hidden");
        // Remove from DOM after transition
        preloader.addEventListener("transitionend", () => {
          preloader.remove();
        }, { once: true });
      }, 600);
    });
  }

  /* ═══════════ HERO MOUSE GLOW ═══════════ */

  function initMouseGlow() {
    const hero = document.querySelector(".hero");
    const glow = document.getElementById("hero-mouse-glow");
    if (!hero || !glow) return;

    // Skip on touch devices
    if (window.matchMedia("(hover: none)").matches) return;
    // Skip if reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    hero.addEventListener("mousemove", (e) => {
      const rect = hero.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      glow.style.left = x + "px";
      glow.style.top = y + "px";
      glow.classList.add("active");
    });

    hero.addEventListener("mouseleave", () => {
      glow.classList.remove("active");
    });
  }

  /* ═══════════ CONTACT FORM ═══════════ */

  function initContactForm() {
    const form = document.getElementById("contact-form");
    if (!form) return;

    const submitBtn = document.getElementById("form-submit");
    const successMsg = document.getElementById("form-success");

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      // Validate
      if (!validateForm(form)) return;

      // Show loading state
      submitBtn.classList.add("btn--loading");
      submitBtn.disabled = true;

      // Simulate submission (replace with real API call)
      setTimeout(() => {
        submitBtn.classList.remove("btn--loading");
        submitBtn.classList.add("btn--success");

        // Show success message
        setTimeout(() => {
          successMsg.hidden = false;
          form.reset();

          // Reset button after delay
          setTimeout(() => {
            submitBtn.classList.remove("btn--success");
            submitBtn.disabled = false;
          }, 3000);
        }, 500);
      }, 1500);
    });

    // Real-time validation on blur
    const inputs = form.querySelectorAll("[required]");
    inputs.forEach((input) => {
      input.addEventListener("blur", () => validateField(input));
      input.addEventListener("input", () => {
        if (input.classList.contains("error")) {
          validateField(input);
        }
      });
    });
  }

  function validateForm(form) {
    const fields = form.querySelectorAll("[required]");
    let isValid = true;

    fields.forEach((field) => {
      if (!validateField(field)) {
        isValid = false;
      }
    });

    return isValid;
  }

  function validateField(field) {
    const errorEl = field
      .closest(".contact-form__group")
      ?.querySelector(".contact-form__error");
    let message = "";

    if (!field.value.trim()) {
      message = "This field is required";
    } else if (field.type === "email" && !isValidEmail(field.value)) {
      message = "Please enter a valid email address";
    }

    if (message) {
      field.classList.add("error");
      if (errorEl) errorEl.textContent = message;
      return false;
    }

    field.classList.remove("error");
    if (errorEl) errorEl.textContent = "";
    return true;
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /* ═══════════ HERO PARTICLES ═══════════ */

  function initParticles() {
    const container = document.getElementById("hero-particles");
    if (!container) return;

    // Respect reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const count = 20;

    for (let i = 0; i < count; i++) {
      const particle = document.createElement("div");
      particle.className = "hero__particle";
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.animationDuration = `${6 + Math.random() * 8}s`;
      particle.style.animationDelay = `${Math.random() * 6}s`;
      particle.style.width = `${2 + Math.random() * 3}px`;
      particle.style.height = particle.style.width;
      particle.style.opacity = `${0.2 + Math.random() * 0.4}`;
      container.appendChild(particle);
    }
  }

  /* ═══════════ BACK TO TOP ═══════════ */

  function initBackToTop() {
    const btn = document.getElementById("back-to-top");
    if (!btn) return;

    // Show/hide based on scroll position
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (window.scrollY > 600) {
            btn.classList.add("visible");
          } else {
            btn.classList.remove("visible");
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    // Scroll to top on click
    btn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ═══════════ FOOTER YEAR ═══════════ */

  function initFooterYear() {
    const el = document.getElementById("footer-year");
    if (el) {
      el.textContent = new Date().getFullYear();
    }
  }

  /* ═══════════ INIT ═══════════ */

  function init() {
    initPreloader();
    initMouseGlow();
    initContactForm();
    initParticles();
    initBackToTop();
    initFooterYear();
  }

  return { init };
})();
