/**
 * Bloomfield BCCC — Admin Portal JavaScript
 * ===========================================
 * Single-file SPA for managing club content.
 */

(() => {
  "use strict";

  // ─── API Base Resolution ─────────────────────────────────
  const API_BASE = (() => {
    if (localStorage.getItem("bccc_api_base")) return localStorage.getItem("bccc_api_base");
    const meta = document.querySelector('meta[name="bccc-api-base"]');
    if (meta) return meta.content;
    const h = location.hostname;
    if (h === "localhost" || h === "127.0.0.1" || location.protocol === "file:")
      return "http://127.0.0.1:5050";
    return location.origin;
  })();

  let token = localStorage.getItem("bccc_admin_token") || "";
  let currentSection = "dashboard";

  // ─── DOM refs ────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const loginOverlay = $("#login-overlay");
  const loginForm = $("#login-form");
  const loginError = $("#login-error");
  const app = $("#app");
  const contentArea = $("#content-area");
  const pageTitle = $("#page-title");
  const sidebarToggle = $("#sidebar-toggle");
  const sidebar = $("#sidebar");
  const logoutBtn = $("#logout-btn");

  // ─── Toast ───────────────────────────────────────────────
  let toastContainer;
  function toast(msg, type = "success") {
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.className = "toast-container";
      document.body.appendChild(toastContainer);
    }
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = msg;
    toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  // ─── API helpers ─────────────────────────────────────────
  async function api(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (opts.body && typeof opts.body === "object" && !(opts.body instanceof Blob)) {
      headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
    if (res.status === 401) {
      token = "";
      localStorage.removeItem("bccc_admin_token");
      showLogin();
      throw new Error("Session expired");
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  // ─── Auth ────────────────────────────────────────────────
  function showLogin() {
    loginOverlay.hidden = false;
    app.hidden = true;
  }

  function showApp() {
    loginOverlay.hidden = true;
    app.hidden = false;
    navigate(currentSection);
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.textContent = "";
    const email = $("#login-email").value.trim();
    const password = $("#login-password").value;
    try {
      const data = await api("/api/auth/login", { method: "POST", body: { email, password } });
      if (data.user.role !== "admin") throw new Error("Not an admin account");
      token = data.token;
      localStorage.setItem("bccc_admin_token", token);
      showApp();
    } catch (err) {
      loginError.textContent = err.message;
    }
  });

  logoutBtn.addEventListener("click", () => {
    token = "";
    localStorage.removeItem("bccc_admin_token");
    showLogin();
  });

  // ─── Sidebar nav ─────────────────────────────────────────
  sidebar.querySelectorAll(".sidebar-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(link.dataset.section);
      sidebar.classList.remove("open");
    });
  });

  sidebarToggle.addEventListener("click", () => sidebar.classList.toggle("open"));

  function navigate(section) {
    currentSection = section;
    sidebar.querySelectorAll(".sidebar-link").forEach((l) =>
      l.classList.toggle("active", l.dataset.section === section)
    );
    const titles = {
      dashboard: "Dashboard", profile: "Site Profile", events: "Events",
      gallery: "Gallery", faqs: "FAQs", programs: "Cricket Programs",
      players: "Players", tickets: "Tickets", payments: "Payment Settings",
    };
    pageTitle.textContent = titles[section] || section;
    renderSection(section);
  }

  // ─── Section Router ──────────────────────────────────────
  async function renderSection(section) {
    contentArea.innerHTML = '<p style="color:var(--text-dim)">Loading...</p>';
    try {
      switch (section) {
        case "dashboard": return await renderDashboard();
        case "profile":   return await renderProfile();
        case "events":    return await renderEvents();
        case "gallery":   return await renderGallery();
        case "faqs":      return await renderFaqs();
        case "programs":  return await renderPrograms();
        case "players":   return await renderPlayers();
        case "tickets":   return await renderTickets();
        case "payments":  return await renderPayments();
      }
    } catch (err) {
      contentArea.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
    }
  }

  // ═══ Dashboard ═══════════════════════════════════════════
  async function renderDashboard() {
    const [events, players, tickets, gallery, faqs] = await Promise.all([
      api("/api/admin/events"),
      api("/api/public/players"),
      api("/api/admin/tickets"),
      api("/api/admin/gallery"),
      api("/api/admin/faqs"),
    ]);
    const pendingTickets = tickets.filter((t) => t.status === "pending_transfer").length;

    contentArea.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><span class="stat-value">${events.length}</span><span class="stat-label">Events</span></div>
        <div class="stat-card gold"><span class="stat-value">${players.length}</span><span class="stat-label">Players</span></div>
        <div class="stat-card"><span class="stat-value">${gallery.length}</span><span class="stat-label">Gallery Items</span></div>
        <div class="stat-card"><span class="stat-value">${faqs.length}</span><span class="stat-label">FAQs</span></div>
        <div class="stat-card"><span class="stat-value">${tickets.length}</span><span class="stat-label">Total Tickets</span></div>
        <div class="stat-card red"><span class="stat-value">${pendingTickets}</span><span class="stat-label">Pending Transfers</span></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Recent Tickets</span></div>
        ${tickets.length === 0
          ? '<div class="empty-state"><p>No tickets yet</p></div>'
          : `<div class="table-wrap"><table>
              <thead><tr><th>Buyer</th><th>Event</th><th>Qty</th><th>Method</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>${tickets.slice(0, 10).map((t) => `
                <tr>
                  <td>${esc(t.buyer_name)}</td>
                  <td>${esc(t.event_title || t.event_id)}</td>
                  <td>${t.quantity}</td>
                  <td>${t.payment_method}</td>
                  <td>${statusBadge(t.status)}</td>
                  <td>${fmtDate(t.created_at)}</td>
                </tr>`).join("")}
              </tbody></table></div>`
        }
      </div>`;
  }

  // ═══ Site Profile ════════════════════════════════════════
  async function renderProfile() {
    const p = await api("/api/admin/profile");
    contentArea.innerHTML = `
      <div class="card">
        <form id="profile-form">
          <div class="form-group">
            <label>Home Lead Text</label>
            <input class="form-input" name="home_lead" value="${esc(p.home_lead)}">
          </div>
          <div class="form-group">
            <label>About Title</label>
            <input class="form-input" name="about_title" value="${esc(p.about_title)}">
          </div>
          <div class="form-group">
            <label>About Description</label>
            <textarea class="form-textarea" name="about_description" rows="4">${esc(p.about_description)}</textarea>
          </div>
          <button type="submit" class="btn btn-primary">Save Profile</button>
        </form>
      </div>`;

    $("#profile-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await api("/api/admin/profile", { method: "PUT", body: Object.fromEntries(fd) });
      toast("Profile saved");
    });
  }

  // ═══ Events ══════════════════════════════════════════════
  async function renderEvents() {
    const events = await api("/api/admin/events");
    contentArea.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">All Events (${events.length})</span>
          <button class="btn btn-primary btn-sm" id="add-event-btn">+ Add Event</button>
        </div>
        ${events.length === 0
          ? '<div class="empty-state"><p>No events. Create one!</p></div>'
          : `<div class="table-wrap"><table>
              <thead><tr><th>Title</th><th>Date</th><th>Location</th><th>Actions</th></tr></thead>
              <tbody>${events.map((ev) => `
                <tr>
                  <td>${esc(ev.title)}</td>
                  <td>${fmtDate(ev.date)}</td>
                  <td>${esc(ev.location)}</td>
                  <td>
                    <button class="btn btn-ghost btn-sm edit-event" data-id="${ev.id}">Edit</button>
                    <button class="btn btn-danger btn-sm del-event" data-id="${ev.id}">Delete</button>
                  </td>
                </tr>`).join("")}
              </tbody></table></div>`
        }
      </div>`;

    $("#add-event-btn").addEventListener("click", () => showEventModal());
    contentArea.querySelectorAll(".edit-event").forEach((btn) =>
      btn.addEventListener("click", () => showEventModal(events.find((e) => e.id === btn.dataset.id)))
    );
    contentArea.querySelectorAll(".del-event").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this event?")) return;
        await api(`/api/admin/events/${btn.dataset.id}`, { method: "DELETE" });
        toast("Event deleted");
        renderEvents();
      })
    );
  }

  function showEventModal(ev = null) {
    const isEdit = !!ev;
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-title">${isEdit ? "Edit" : "Create"} Event</div>
        <form id="event-modal-form">
          <div class="form-group"><label>Title</label><input class="form-input" name="title" value="${esc(ev?.title || "")}" required></div>
          <div class="form-row">
            <div class="form-group"><label>Date</label><input class="form-input" name="date" type="date" value="${(ev?.date || "").slice(0, 10)}" required></div>
            <div class="form-group"><label>Location</label><input class="form-input" name="location" value="${esc(ev?.location || "")}"></div>
          </div>
          <div class="form-group"><label>Description</label><textarea class="form-textarea" name="description" rows="3">${esc(ev?.description || "")}</textarea></div>
          <div class="form-group"><label>Image URL</label><input class="form-input" name="image_url" value="${esc(ev?.image_url || "")}"></div>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" id="event-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? "Update" : "Create"}</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector("#event-cancel").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector("#event-modal-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      if (isEdit) {
        await api(`/api/admin/events/${ev.id}`, { method: "PUT", body: fd });
        toast("Event updated");
      } else {
        await api("/api/admin/events", { method: "POST", body: fd });
        toast("Event created");
      }
      overlay.remove();
      renderEvents();
    });
  }

  // ═══ Gallery ═════════════════════════════════════════════
  async function renderGallery() {
    const items = await api("/api/admin/gallery");
    contentArea.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Gallery (${items.length})</span>
          <button class="btn btn-primary btn-sm" id="add-gallery-btn">+ Add Image</button>
        </div>
        ${items.length === 0
          ? '<div class="empty-state"><p>No gallery items yet</p></div>'
          : `<div class="table-wrap"><table>
              <thead><tr><th>Caption</th><th>Image URL</th><th>Order</th><th>Actions</th></tr></thead>
              <tbody>${items.map((g) => `
                <tr>
                  <td>${esc(g.caption)}</td>
                  <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${esc(g.image_url)}</td>
                  <td>${g.sort_order}</td>
                  <td><button class="btn btn-danger btn-sm del-gallery" data-id="${g.id}">Delete</button></td>
                </tr>`).join("")}
              </tbody></table></div>`
        }
      </div>`;

    $("#add-gallery-btn").addEventListener("click", () => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal">
          <div class="modal-title">Add Gallery Image</div>
          <form id="gallery-form">
            <div class="form-group"><label>Image URL</label><input class="form-input" name="image_url" required></div>
            <div class="form-row">
              <div class="form-group"><label>Caption</label><input class="form-input" name="caption"></div>
              <div class="form-group"><label>Sort Order</label><input class="form-input" name="sort_order" type="number" value="0"></div>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
              <button type="submit" class="btn btn-primary">Add</button>
            </div>
          </form>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
      overlay.querySelector("#gallery-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        await api("/api/admin/gallery", { method: "POST", body: Object.fromEntries(new FormData(e.target)) });
        toast("Gallery item added");
        overlay.remove();
        renderGallery();
      });
    });

    contentArea.querySelectorAll(".del-gallery").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this gallery item?")) return;
        await api(`/api/admin/gallery/${btn.dataset.id}`, { method: "DELETE" });
        toast("Gallery item deleted");
        renderGallery();
      })
    );
  }

  // ═══ FAQs ════════════════════════════════════════════════
  async function renderFaqs() {
    const faqs = await api("/api/admin/faqs");
    contentArea.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">FAQs (${faqs.length})</span>
          <button class="btn btn-primary btn-sm" id="add-faq-btn">+ Add FAQ</button>
        </div>
        ${faqs.length === 0
          ? '<div class="empty-state"><p>No FAQs yet</p></div>'
          : `<div class="table-wrap"><table>
              <thead><tr><th>Question</th><th>Order</th><th>Actions</th></tr></thead>
              <tbody>${faqs.map((f) => `
                <tr>
                  <td>${esc(f.question)}</td>
                  <td>${f.sort_order}</td>
                  <td>
                    <button class="btn btn-ghost btn-sm edit-faq" data-id="${f.id}">Edit</button>
                    <button class="btn btn-danger btn-sm del-faq" data-id="${f.id}">Delete</button>
                  </td>
                </tr>`).join("")}
              </tbody></table></div>`
        }
      </div>`;

    $("#add-faq-btn").addEventListener("click", () => showFaqModal());
    contentArea.querySelectorAll(".edit-faq").forEach((btn) =>
      btn.addEventListener("click", () => showFaqModal(faqs.find((f) => f.id === btn.dataset.id)))
    );
    contentArea.querySelectorAll(".del-faq").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this FAQ?")) return;
        await api(`/api/admin/faqs/${btn.dataset.id}`, { method: "DELETE" });
        toast("FAQ deleted");
        renderFaqs();
      })
    );
  }

  function showFaqModal(faq = null) {
    const isEdit = !!faq;
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-title">${isEdit ? "Edit" : "Create"} FAQ</div>
        <form id="faq-form">
          <div class="form-group"><label>Question</label><input class="form-input" name="question" value="${esc(faq?.question || "")}" required></div>
          <div class="form-group"><label>Answer</label><textarea class="form-textarea" name="answer" rows="4" required>${esc(faq?.answer || "")}</textarea></div>
          <div class="form-group"><label>Sort Order</label><input class="form-input" name="sort_order" type="number" value="${faq?.sort_order || 0}"></div>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? "Update" : "Create"}</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector("#faq-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      if (isEdit) {
        await api(`/api/admin/faqs/${faq.id}`, { method: "PUT", body: fd });
        toast("FAQ updated");
      } else {
        await api("/api/admin/faqs", { method: "POST", body: fd });
        toast("FAQ created");
      }
      overlay.remove();
      renderFaqs();
    });
  }

  // ═══ Cricket Programs ════════════════════════════════════
  async function renderPrograms() {
    const progs = await api("/api/admin/cricket-programs");
    contentArea.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Programs (${progs.length})</span>
          <button class="btn btn-primary btn-sm" id="add-prog-btn">+ Add Program</button>
        </div>
        ${progs.length === 0
          ? '<div class="empty-state"><p>No programs yet</p></div>'
          : `<div class="table-wrap"><table>
              <thead><tr><th>Title</th><th>Level</th><th>Schedule</th><th>Actions</th></tr></thead>
              <tbody>${progs.map((p) => `
                <tr>
                  <td>${esc(p.title)}</td>
                  <td><span class="badge badge-blue">${p.level}</span></td>
                  <td>${esc(p.schedule)}</td>
                  <td>
                    <button class="btn btn-ghost btn-sm edit-prog" data-id="${p.id}">Edit</button>
                    <button class="btn btn-danger btn-sm del-prog" data-id="${p.id}">Delete</button>
                  </td>
                </tr>`).join("")}
              </tbody></table></div>`
        }
      </div>`;

    $("#add-prog-btn").addEventListener("click", () => showProgModal());
    contentArea.querySelectorAll(".edit-prog").forEach((btn) =>
      btn.addEventListener("click", () => showProgModal(progs.find((p) => p.id === btn.dataset.id)))
    );
    contentArea.querySelectorAll(".del-prog").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this program?")) return;
        await api(`/api/admin/cricket-programs/${btn.dataset.id}`, { method: "DELETE" });
        toast("Program deleted");
        renderPrograms();
      })
    );
  }

  function showProgModal(prog = null) {
    const isEdit = !!prog;
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-title">${isEdit ? "Edit" : "Create"} Program</div>
        <form id="prog-form">
          <div class="form-group"><label>Title</label><input class="form-input" name="title" value="${esc(prog?.title || "")}" required></div>
          <div class="form-group"><label>Description</label><textarea class="form-textarea" name="description" rows="3">${esc(prog?.description || "")}</textarea></div>
          <div class="form-row">
            <div class="form-group"><label>Schedule</label><input class="form-input" name="schedule" value="${esc(prog?.schedule || "")}"></div>
            <div class="form-group">
              <label>Level</label>
              <select class="form-select" name="level">
                <option value="all" ${prog?.level==="all"?"selected":""}>All Levels</option>
                <option value="beginner" ${prog?.level==="beginner"?"selected":""}>Beginner</option>
                <option value="intermediate" ${prog?.level==="intermediate"?"selected":""}>Intermediate</option>
                <option value="advanced" ${prog?.level==="advanced"?"selected":""}>Advanced</option>
              </select>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? "Update" : "Create"}</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector("#prog-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      if (isEdit) {
        await api(`/api/admin/cricket-programs/${prog.id}`, { method: "PUT", body: fd });
        toast("Program updated");
      } else {
        await api("/api/admin/cricket-programs", { method: "POST", body: fd });
        toast("Program created");
      }
      overlay.remove();
      renderPrograms();
    });
  }

  // ═══ Players ═════════════════════════════════════════════
  async function renderPlayers() {
    const players = await api("/api/public/players");
    contentArea.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Players (${players.length})</span>
          <button class="btn btn-primary btn-sm" id="add-player-btn">+ Add Player</button>
        </div>
        ${players.length === 0
          ? '<div class="empty-state"><p>No players yet</p></div>'
          : `<div class="table-wrap"><table>
              <thead><tr><th>Name</th><th>Role</th><th>Batting</th><th>Bowling</th><th>Actions</th></tr></thead>
              <tbody>${players.map((p) => `
                <tr>
                  <td>${esc(p.name)}</td>
                  <td><span class="badge badge-gold">${p.role}</span></td>
                  <td>${p.batting_style}</td>
                  <td>${p.bowling_style || "-"}</td>
                  <td>
                    <button class="btn btn-ghost btn-sm edit-player" data-id="${p.id}">Edit</button>
                    <button class="btn btn-danger btn-sm del-player" data-id="${p.id}">Delete</button>
                  </td>
                </tr>`).join("")}
              </tbody></table></div>`
        }
      </div>`;

    $("#add-player-btn").addEventListener("click", () => showPlayerModal());
    contentArea.querySelectorAll(".edit-player").forEach((btn) =>
      btn.addEventListener("click", () => showPlayerModal(players.find((p) => p.id === btn.dataset.id)))
    );
    contentArea.querySelectorAll(".del-player").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this player?")) return;
        await api(`/api/admin/players/${btn.dataset.id}`, { method: "DELETE" });
        toast("Player deleted");
        renderPlayers();
      })
    );
  }

  function showPlayerModal(player = null) {
    const isEdit = !!player;
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-title">${isEdit ? "Edit" : "Add"} Player</div>
        <form id="player-form">
          <div class="form-group"><label>Name</label><input class="form-input" name="name" value="${esc(player?.name || "")}" required></div>
          <div class="form-row">
            <div class="form-group">
              <label>Role</label>
              <select class="form-select" name="role">
                <option value="all-rounder" ${player?.role==="all-rounder"?"selected":""}>All-Rounder</option>
                <option value="batsman" ${player?.role==="batsman"?"selected":""}>Batsman</option>
                <option value="bowler" ${player?.role==="bowler"?"selected":""}>Bowler</option>
                <option value="wicketkeeper" ${player?.role==="wicketkeeper"?"selected":""}>Wicketkeeper</option>
              </select>
            </div>
            <div class="form-group">
              <label>Batting Style</label>
              <select class="form-select" name="batting_style">
                <option value="right-hand" ${player?.batting_style==="right-hand"?"selected":""}>Right Hand</option>
                <option value="left-hand" ${player?.batting_style==="left-hand"?"selected":""}>Left Hand</option>
              </select>
            </div>
          </div>
          <div class="form-group"><label>Bowling Style</label><input class="form-input" name="bowling_style" value="${esc(player?.bowling_style || "")}"></div>
          <div class="form-group"><label>Image URL</label><input class="form-input" name="image_url" value="${esc(player?.image_url || "")}"></div>
          <div class="form-group"><label>Bio</label><textarea class="form-textarea" name="bio" rows="2">${esc(player?.bio || "")}</textarea></div>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? "Update" : "Add"}</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector("#player-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      if (isEdit) {
        await api(`/api/admin/players/${player.id}`, { method: "PUT", body: fd });
        toast("Player updated");
      } else {
        await api("/api/admin/players", { method: "POST", body: fd });
        toast("Player added");
      }
      overlay.remove();
      renderPlayers();
    });
  }

  // ═══ Tickets ═════════════════════════════════════════════
  async function renderTickets() {
    const tickets = await api("/api/admin/tickets");
    contentArea.innerHTML = `
      <div class="card">
        <div class="card-header"><span class="card-title">Tickets (${tickets.length})</span></div>
        ${tickets.length === 0
          ? '<div class="empty-state"><p>No tickets yet</p></div>'
          : `<div class="table-wrap"><table>
              <thead><tr><th>Buyer</th><th>Email</th><th>Event</th><th>Qty</th><th>Method</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>${tickets.map((t) => `
                <tr>
                  <td>${esc(t.buyer_name)}</td>
                  <td>${esc(t.buyer_email)}</td>
                  <td>${esc(t.event_title || t.event_id)}</td>
                  <td>${t.quantity}</td>
                  <td>${t.payment_method}</td>
                  <td>${statusBadge(t.status)}</td>
                  <td>
                    ${t.status === "pending_transfer" ? `<button class="btn btn-gold btn-sm mark-paid" data-id="${t.id}">Mark Paid</button>` : ""}
                    ${t.status === "paid" ? `<button class="btn btn-primary btn-sm send-ticket" data-id="${t.id}">Send</button>` : ""}
                  </td>
                </tr>`).join("")}
              </tbody></table></div>`
        }
      </div>`;

    contentArea.querySelectorAll(".mark-paid").forEach((btn) =>
      btn.addEventListener("click", async () => {
        await api(`/api/admin/tickets/${btn.dataset.id}/mark-paid`, { method: "POST" });
        toast("Ticket marked as paid");
        renderTickets();
      })
    );
    contentArea.querySelectorAll(".send-ticket").forEach((btn) =>
      btn.addEventListener("click", async () => {
        await api(`/api/admin/tickets/${btn.dataset.id}/send`, { method: "POST" });
        toast("Ticket sent");
        renderTickets();
      })
    );
  }

  // ═══ Payments ════════════════════════════════════════════
  async function renderPayments() {
    const ps = await api("/api/admin/payments");
    contentArea.innerHTML = `
      <div class="card">
        <form id="payments-form">
          <div class="form-row">
            <div class="form-group"><label>Card URL</label><input class="form-input" name="card_url" value="${esc(ps.card_url)}"></div>
            <div class="form-group"><label>PayPal URL</label><input class="form-input" name="paypal_url" value="${esc(ps.paypal_url)}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>E-Transfer Email</label><input class="form-input" name="etransfer_email" value="${esc(ps.etransfer_email)}"></div>
            <div class="form-group"><label>Ticket Handler Email</label><input class="form-input" name="ticket_handler_email" value="${esc(ps.ticket_handler_email)}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Stripe Publishable Key</label><input class="form-input" name="stripe_publishable_key" value="${esc(ps.stripe_publishable_key)}"></div>
            <div class="form-group"><label>Stripe Secret Key</label><input class="form-input" name="stripe_secret_key" type="password" value="${esc(ps.stripe_secret_key)}"></div>
          </div>
          <button type="submit" class="btn btn-primary">Save Settings</button>
        </form>
      </div>`;

    $("#payments-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      await api("/api/admin/payments", { method: "PUT", body: Object.fromEntries(new FormData(e.target)) });
      toast("Payment settings saved");
    });
  }

  // ─── Utilities ───────────────────────────────────────────
  function esc(str) {
    if (str == null) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function fmtDate(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
  }

  function statusBadge(status) {
    const map = {
      pending_transfer: "badge-gold", pending_checkout: "badge-gold",
      paid: "badge-green", sent: "badge-blue", active: "badge-green", withdrawn: "badge-gray",
    };
    return `<span class="badge ${map[status] || "badge-gray"}">${status.replace(/_/g, " ")}</span>`;
  }

  // ─── Init ────────────────────────────────────────────────
  if (token) {
    api("/api/auth/me").then(() => showApp()).catch(() => showLogin());
  } else {
    showLogin();
  }
})();
