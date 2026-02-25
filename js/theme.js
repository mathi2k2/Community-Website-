/* ═══════════════════════════════════════════════════════
   THEME MANAGER
   Handles dark/light mode with system preference detection
   and localStorage persistence.
   ═══════════════════════════════════════════════════════ */

const ThemeManager = (() => {
  const STORAGE_KEY = "bloomfield-theme";
  const root = document.documentElement;
  const toggle = document.getElementById("theme-toggle");

  /**
   * Determine initial theme:
   * 1. Check localStorage for saved preference
   * 2. Fall back to OS/browser preference
   * 3. Default to "light"
   */
  function getPreferredTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;

    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }

  function setTheme(theme) {
    root.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);

    // Update meta theme-color for mobile browser chrome
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", theme === "dark" ? "#0d0f14" : "#ffffff");
    }

    // Update aria label
    if (toggle) {
      toggle.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      );
    }
  }

  function toggleTheme() {
    const current = root.getAttribute("data-theme");
    setTheme(current === "dark" ? "light" : "dark");
  }

  function init() {
    // Apply theme immediately (prevents flash)
    setTheme(getPreferredTheme());

    // Toggle button click
    if (toggle) {
      toggle.addEventListener("click", toggleTheme);
    }

    // Listen for OS preference changes
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => {
        // Only auto-switch if user hasn't manually set a preference
        if (!localStorage.getItem(STORAGE_KEY)) {
          setTheme(e.matches ? "dark" : "light");
        }
      });
  }

  return { init };
})();

// Initialize immediately
ThemeManager.init();
