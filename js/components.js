/* ═══════════════════════════════════════════════════════
   INTERACTIVE COMPONENTS
   Form validation, hero particles, and other UI logic.
   ═══════════════════════════════════════════════════════ */

const Components = (() => {
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

  /* ═══════════ FOOTER YEAR ═══════════ */

  function initFooterYear() {
    const el = document.getElementById("footer-year");
    if (el) {
      el.textContent = new Date().getFullYear();
    }
  }

  /* ═══════════ INIT ═══════════ */

  function init() {
    initContactForm();
    initParticles();
    initFooterYear();
  }

  return { init };
})();
