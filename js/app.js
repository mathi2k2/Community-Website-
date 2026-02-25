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
});
