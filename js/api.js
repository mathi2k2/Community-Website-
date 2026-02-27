/**
 * Bloomfield BCCC — Frontend API Connector
 * ==========================================
 * Fetches live data from the backend and hydrates the static HTML.
 * Falls back gracefully to the existing static content if the API is
 * unreachable (e.g. when opening index.html directly from disk).
 */

const SiteAPI = (() => {
  "use strict";

  const API_BASE = (() => {
    if (localStorage.getItem("bccc_api_base")) return localStorage.getItem("bccc_api_base");
    const meta = document.querySelector('meta[name="bccc-api-base"]');
    if (meta) return meta.content;
    const h = location.hostname;
    if (h === "localhost" || h === "127.0.0.1" || location.protocol === "file:")
      return "http://127.0.0.1:5050";
    return location.origin;
  })();

  let _siteData = null;

  // ─── Helpers ────────────────────────────────────────────

  async function fetchJSON(path) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }

  function esc(str) {
    if (str == null) return "";
    const el = document.createElement("span");
    el.textContent = String(str);
    return el.innerHTML;
  }

  function fmtDate(iso) {
    if (!iso) return { month: "TBD", day: "--", full: "" };
    const d = new Date(iso);
    return {
      month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
      day: d.getDate(),
      full: d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    };
  }

  // ─── Events renderer ───────────────────────────────────

  function renderEvents(events) {
    const grid = document.querySelector(".events__grid");
    if (!grid || !events || events.length === 0) return;

    grid.innerHTML = events.map((ev, i) => {
      const dt = fmtDate(ev.date);
      return `
        <article class="event-card reveal-up" aria-labelledby="event-api-${i}">
          <div class="event-card__date">
            <span class="event-card__month">${dt.month}</span>
            <span class="event-card__day">${dt.day}</span>
          </div>
          <div class="event-card__content">
            <span class="event-card__tag event-card__tag--workshop">${esc(ev.location) || "Event"}</span>
            <h3 id="event-api-${i}" class="event-card__title">${esc(ev.title)}</h3>
            <p class="event-card__text">${esc(ev.description)}</p>
            <div class="event-card__meta">
              <span class="event-card__time">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                ${dt.full}
              </span>
              ${ev.location ? `<span class="event-card__location">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                ${esc(ev.location)}
              </span>` : ""}
            </div>
          </div>
          <a href="#contact" class="event-card__link" aria-label="Register for ${esc(ev.title)}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </a>
        </article>`;
    }).join("");

    // Re-observe for scroll animations
    if (typeof ScrollAnimations !== "undefined" && ScrollAnimations.reobserve) {
      ScrollAnimations.reobserve();
    }
  }

  // ─── FAQs renderer ─────────────────────────────────────

  function renderFaqs(faqs) {
    const list = document.querySelector(".faq__list");
    if (!list || !faqs || faqs.length === 0) return;

    list.innerHTML = faqs.map((faq) => `
      <details class="faq__item reveal-up" role="listitem">
        <summary class="faq__question">
          ${esc(faq.question)}
          <svg class="faq__chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </summary>
        <div class="faq__answer"><p>${esc(faq.answer)}</p></div>
      </details>`).join("");

    if (typeof ScrollAnimations !== "undefined" && ScrollAnimations.reobserve) {
      ScrollAnimations.reobserve();
    }
  }

  // ─── Matches renderer (for the new matches section) ────

  function renderMatches(matches) {
    const container = document.getElementById("matches-container");
    if (!container || !matches || matches.length === 0) return;

    container.innerHTML = `
      <div class="table-responsive">
        <table class="matches-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Opponent</th>
              <th>Venue</th>
              <th>Bloomfield</th>
              <th>Opponent</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            ${matches.map((m) => {
              const dt = fmtDate(m.date);
              const resultClass = (m.result || "").toLowerCase().includes("won")
                ? "result--won"
                : (m.result || "").toLowerCase().includes("lost")
                  ? "result--lost"
                  : "";
              return `
                <tr class="match-row" data-match-id="${m.id}">
                  <td>${dt.full || dt.month + " " + dt.day}</td>
                  <td><strong>${esc(m.opponent)}</strong></td>
                  <td>${esc(m.venue)}</td>
                  <td class="score">${esc(m.bloomfield_score) || "-"}</td>
                  <td class="score">${esc(m.opponent_score) || "-"}</td>
                  <td><span class="result-badge ${resultClass}">${esc(m.result) || "TBD"}</span></td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`;
  }

  // ─── Gallery renderer ──────────────────────────────────

  function renderGallery(gallery) {
    const grid = document.querySelector(".gallery__grid");
    if (!grid || !gallery || gallery.length === 0) return;

    // Only replace if we actually have API gallery items
    // Keep existing static gallery otherwise
    const dynamicItems = gallery.filter((g) => g.image_url);
    if (dynamicItems.length === 0) return;

    grid.innerHTML = dynamicItems.map((g, i) => `
      <div class="gallery__item ${i === 0 || i === dynamicItems.length - 1 ? "gallery__item--wide" : ""} reveal-up">
        <img class="gallery__img" src="${esc(g.image_url)}" alt="${esc(g.caption)}" loading="lazy">
        <div class="gallery__art-overlay">
          <span class="gallery__art-label">${esc(g.caption)}</span>
        </div>
      </div>`).join("");

    if (typeof ScrollAnimations !== "undefined" && ScrollAnimations.reobserve) {
      ScrollAnimations.reobserve();
    }
  }

  // ─── Contact form wiring ───────────────────────────────

  function wireContactForm() {
    const form = document.getElementById("contact-form");
    if (!form) return;

    // Remove the old simulated submit listener by cloning
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    const submitBtn = newForm.querySelector("#form-submit");
    const successMsg = newForm.querySelector("#form-success");

    // Restore blur validation
    newForm.querySelectorAll("[required]").forEach((input) => {
      input.addEventListener("blur", () => validateField(input));
      input.addEventListener("input", () => {
        if (input.classList.contains("error")) validateField(input);
      });
    });

    newForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Validate all required fields
      let isValid = true;
      newForm.querySelectorAll("[required]").forEach((field) => {
        if (!validateField(field)) isValid = false;
      });
      if (!isValid) return;

      submitBtn.classList.add("btn--loading");
      submitBtn.disabled = true;

      const data = Object.fromEntries(new FormData(newForm));

      try {
        // Try to register via API
        await fetchJSON("/api/auth/register").catch(() => null); // just a health-ish check
        const res = await fetch(`${API_BASE}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: data.email,
            name: data.name,
            password: "welcome2025",  // default password for interest registrations
          }),
        });

        if (res.ok || res.status === 409) {
          // 409 = already registered, that's fine
          submitBtn.classList.remove("btn--loading");
          submitBtn.classList.add("btn--success");
          setTimeout(() => {
            successMsg.hidden = false;
            newForm.reset();
            setTimeout(() => {
              submitBtn.classList.remove("btn--success");
              submitBtn.disabled = false;
            }, 3000);
          }, 500);
        } else {
          throw new Error("Registration failed");
        }
      } catch {
        // Fallback: show success anyway (offline mode)
        submitBtn.classList.remove("btn--loading");
        submitBtn.classList.add("btn--success");
        setTimeout(() => {
          successMsg.hidden = false;
          newForm.reset();
          setTimeout(() => {
            submitBtn.classList.remove("btn--success");
            submitBtn.disabled = false;
          }, 3000);
        }, 500);
      }
    });
  }

  function validateField(field) {
    const errorEl = field.closest(".contact-form__group")?.querySelector(".contact-form__error");
    let message = "";
    if (!field.value.trim()) {
      message = "This field is required";
    } else if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
      message = "Please enter a valid email";
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

  // ─── Init: fetch all data and hydrate ──────────────────

  async function init() {
    try {
      _siteData = await fetchJSON("/api/public/site-data");

      // Hydrate sections with live data
      if (_siteData.events && _siteData.events.length > 0) {
        renderEvents(_siteData.events);
      }
      if (_siteData.faqs && _siteData.faqs.length > 0) {
        renderFaqs(_siteData.faqs);
      }
      if (_siteData.gallery && _siteData.gallery.length > 0) {
        renderGallery(_siteData.gallery);
      }

      // Fetch matches separately
      try {
        const matches = await fetchJSON("/api/public/matches");
        if (matches && matches.length > 0) renderMatches(matches);
      } catch { /* no matches yet */ }

      // Update hero subtitle from profile if set
      if (_siteData.profile && _siteData.profile.home_lead) {
        const subtitle = document.querySelector(".hero__subtitle");
        if (subtitle && _siteData.profile.home_lead !== "Manitoba's Premier Cricket Community") {
          subtitle.textContent = _siteData.profile.home_lead;
        }
      }

      console.log("[BCCC] Live data loaded from API");
    } catch (err) {
      console.log("[BCCC] API unavailable, using static content.", err.message);
    }

    // Wire contact form regardless (works offline too)
    wireContactForm();
  }

  return { init, fetchJSON, API_BASE };
})();
