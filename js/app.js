/* ═══════════════════════════════════════════════════════
   APP CONTROLLER
   Main entry point — orchestrates all modules.
   ═══════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", () => {
  // Theme is already initialized (runs immediately in theme.js)

  // Initialize all modules
  Navigation.init();
  ScrollAnimations.init();
  Components.init();

  // Load live data from backend API (falls back to static content)
  if (typeof SiteAPI !== "undefined") {
    SiteAPI.init();
  }
});
