import { api, setSessionToken } from "./api.js";
import { icon, terpMark, wordmark } from "./icons.js";
import { createDropdown } from "./dropdown.js";
import { renderRsvpModal, renderGroupModal, renderEventModal } from "./modals.js";
import {
  dayNum,
  monthAbbr,
  timeOf,
  timeRange,
  longToday,
  greeting,
  formatMembers,
  googleCalendarUrl,
  downloadICS,
  escapeHtml,
  escapeAttr,
  CATEGORIES,
  DISCOVER_CATEGORIES,
  EVENT_CATEGORIES,
  ORG_CATEGORIES,
  EVENT_SORT_OPTIONS,
  sortEvents,
  filterEvents,
} from "./format.js";

const SPLASH_MIN_MS = 1800;
const SPLASH_FADE_MS = 450;

const MOBILE_TABS = [
  { to: "/", icon: "home", label: "Home" },
  { to: "/discover", icon: "compass", label: "Discover" },
  { to: "/calendar", icon: "calendar", label: "Calendar" },
  { to: "/groups", icon: "users", label: "Groups" },
  { to: "/profile", icon: "user", label: "Profile" },
];

const GROUP_CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  ...ORG_CATEGORIES.map((c) => ({ value: c, label: c })),
];

const GROUP_SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "members", label: "Most members" },
  { value: "az", label: "Name (A–Z)" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending review", dotColor: "#d99b00" },
  { value: "approved", label: "Approved", dotColor: "#147943" },
  { value: "rejected", label: "Rejected", dotColor: "#e21833" },
];

const ADMIN_EVENT_CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  ...EVENT_CATEGORIES.map((c) => ({ value: c, label: c })),
];

const DISCOVER_CATEGORY_DROPDOWN_OPTIONS = DISCOVER_CATEGORIES.map((c) => ({
  value: c,
  label: c === "For you" ? "All categories" : c,
  ...(c === "Free food" ? { dotColor: "#e21833" } : {}),
}));

// ============================================================================
// Application State
// ============================================================================
const state = {
  // Auth
  status: "loading", // "loading" | "authenticated" | "anonymous"
  user: null,
  authConfig: { googleClientId: null, allowedDomain: "umd.edu" },
  minElapsed: false,
  splashGone: false,
  returnTo: "/",

  // Data
  events: [],
  organizations: [],
  myOrganizations: [],
  pendingCount: 0,
  loading: true,
  loadError: "",
  search: "",

  // Per-page UI state
  home: { activeCategory: "For you", sortBy: "soonest" },
  discover: { activeCategory: "For you", sortBy: "soonest" },
  calendar: { tab: "going", sortBy: "soonest" },
  groups: { tab: "all", query: "", categoryFilter: "all", sortBy: "featured" },
  admin: {
    data: null,
    loading: true,
    error: "",
    tab: "pending",
    statusFilter: "all",
    eventCatFilter: "all",
    busyId: null,
  },
};

const rootEl = document.getElementById("root");
let appContainerEl = null;
let splashEl = null;
let shellMounted = false;
let currentRoute = null;
let toastTimer = null;
let activeDropdowns = [];
let loginResizeCleanup = null;

function cleanupPageDropdowns() {
  activeDropdowns.forEach((dd) => dd.destroy?.());
  activeDropdowns = [];
}

function registerDropdown(dd) {
  activeDropdowns.push(dd);
  return dd;
}

// ============================================================================
// Derived State Helpers
// ============================================================================
function isAdminUser(u = state.user) {
  return Boolean(u?.isAdmin || u?.role === "admin");
}

function getSavedSet() {
  return new Set(state.user?.savedEvents || []);
}

function getRsvpMap() {
  return new Map((state.user?.rsvps || []).map((r) => [r.eventId, r.passCode]));
}

function getFollowSet() {
  return new Set(state.user?.followedOrgs || []);
}

function getPostableOrgs() {
  if (isAdminUser()) return state.organizations;
  return state.myOrganizations.filter((o) => o.status === "approved");
}

// ============================================================================
// Router Helpers
// ============================================================================
function getPathname() {
  const p = window.location.pathname || "/";
  const validRoutes = ["/", "/login", "/discover", "/calendar", "/groups", "/profile", "/admin"];
  if (validRoutes.includes(p)) return p;
  return "/";
}

function navigate(to, { replace = false, from = null } = {}) {
  if (from) state.returnTo = from;
  const target = to.startsWith("/") ? to : `/${to}`;
  if (window.location.pathname !== target) {
    if (replace) {
      window.history.replaceState({}, "", target);
    } else {
      window.history.pushState({}, "", target);
    }
  }
  window.scrollTo(0, 0);
  syncApp();
}

window.addEventListener("popstate", () => {
  window.scrollTo(0, 0);
  syncApp();
});

// ============================================================================
// Toast & Error Helpers
// ============================================================================
function notify(message) {
  const toastHost = document.getElementById("toast-root");
  if (!toastHost) return;
  window.clearTimeout(toastTimer);
  if (!message) {
    toastHost.innerHTML = "";
    return;
  }
  toastHost.innerHTML = `
    <div class="toast" role="status">
      ${icon("check", 17)}
      ${escapeHtml(message)}
    </div>
  `;
  toastTimer = window.setTimeout(() => {
    if (toastHost) toastHost.innerHTML = "";
  }, 2600);
}

function handleAuthError(err) {
  if (err?.status === 401) {
    setSessionToken(null);
    state.user = null;
    state.status = "anonymous";
    shellMounted = false;
    currentRoute = null;
    syncApp();
    return true;
  }
  return false;
}

function fail(err) {
  if (!handleAuthError(err)) {
    notify(err?.message || "Something went wrong");
  }
}

// ============================================================================
// API Data Loading & Mutations
// ============================================================================
async function loadAppData() {
  state.loading = true;
  state.loadError = "";
  refreshCurrentPage();
  try {
    const [ev, orgs] = await Promise.all([api.get("/events"), api.get("/organizations")]);
    state.events = ev.events || [];
    state.organizations = orgs.organizations || [];
    state.myOrganizations = orgs.myOrganizations || [];
    state.pendingCount = orgs.pendingCount || 0;
  } catch (err) {
    if (!handleAuthError(err)) {
      state.loadError = err?.message || "Failed to load data";
    }
  } finally {
    state.loading = false;
    updateShellChrome();
    refreshCurrentPage();
  }
}

async function loadAdminOverview() {
  if (!isAdminUser()) return;
  state.admin.loading = true;
  state.admin.error = "";
  if (currentRoute === "/admin") renderAdminBody();
  try {
    const res = await api.get("/admin/overview");
    state.admin.data = res;
  } catch (err) {
    if (!handleAuthError(err)) {
      state.admin.error = err?.message || "Failed to load admin overview";
    }
  } finally {
    state.admin.loading = false;
    if (currentRoute === "/admin") renderAdminPage();
  }
}

async function toggleSave(eventId) {
  const savedSet = getSavedSet();
  const isSaved = savedSet.has(eventId);
  const prevSaved = [...(state.user.savedEvents || [])];

  state.user = {
    ...state.user,
    savedEvents: isSaved ? prevSaved.filter((x) => x !== eventId) : [...prevSaved, eventId],
  };
  refreshCurrentPage();

  try {
    const res = isSaved
      ? await api.del(`/events/${eventId}/save`)
      : await api.put(`/events/${eventId}/save`);
    state.user = res.user;
    refreshCurrentPage();
  } catch (err) {
    state.user = { ...state.user, savedEvents: prevSaved };
    refreshCurrentPage();
    fail(err);
  }
}

function openRsvp(event) {
  const modalRoot = document.getElementById("modal-root");
  if (!modalRoot || !event) return;
  const rsvpMap = getRsvpMap();
  renderRsvpModal(modalRoot, {
    event,
    passCode: rsvpMap.get(event.id) || null,
    userName: state.user?.name || "UMD Student",
    onConfirm: async () => {
      try {
        const res = await api.post(`/events/${event.id}/rsvp`);
        state.user = res.user;
        if (res.event) {
          state.events = state.events.map((e) => (e.id === res.event.id ? res.event : e));
        }
        refreshCurrentPage();
        return { passCode: res.passCode };
      } catch (err) {
        if (handleAuthError(err)) return {};
        throw err;
      }
    },
  });
}

async function cancelRsvp(event) {
  try {
    const res = await api.del(`/events/${event.id}/rsvp`);
    state.user = res.user;
    state.events = state.events.map((e) =>
      e.id === event.id ? { ...e, attendees: Math.max(0, (e.attendees || 1) - 1) } : e,
    );
    notify("RSVP cancelled");
    refreshCurrentPage();
  } catch (err) {
    fail(err);
  }
}

async function toggleFollow(org) {
  const following = getFollowSet().has(org.id);
  try {
    const res = following
      ? await api.del(`/organizations/${org.id}/follow`)
      : await api.put(`/organizations/${org.id}/follow`);
    state.user = res.user;
    state.organizations = state.organizations.map((o) =>
      o.id === org.id ? { ...o, members: Math.max(0, o.members + (following ? -1 : 1)) } : o,
    );
    notify(following ? `Left ${org.name}` : `Joined ${org.name}`);
    refreshCurrentPage();
  } catch (err) {
    fail(err);
  }
}

function openGroupModal(initialGroup = null) {
  const modalRoot = document.getElementById("modal-root");
  if (!modalRoot) return;
  renderGroupModal(modalRoot, {
    initialGroup,
    onSubmit: async (payload) => {
      try {
        if (initialGroup) {
          await api.put(`/organizations/${initialGroup.id}`, payload);
          notify("Group updated");
        } else {
          const res = await api.post("/organizations", payload);
          if (res.user) state.user = res.user;
          notify("Group submitted for Admin approval (jahnavi5@umd.edu)");
        }
        await loadAppData();
        if (currentRoute === "/admin") await loadAdminOverview();
      } catch (err) {
        if (handleAuthError(err)) return;
        throw err;
      }
    },
  });
}

async function deleteGroup(org) {
  if (!window.confirm(`Delete "${org.name}" and all of its events?`)) return;
  try {
    const res = await api.del(`/organizations/${org.id}`);
    if (res.user) state.user = res.user;
    notify(`Deleted ${org.name}`);
    await loadAppData();
    if (currentRoute === "/admin") await loadAdminOverview();
  } catch (err) {
    fail(err);
  }
}

function openEventModal(initialEvent = null, defaultOrgId = "") {
  const modalRoot = document.getElementById("modal-root");
  if (!modalRoot) return;
  const postableOrgs = getPostableOrgs();
  if (!initialEvent && postableOrgs.length === 0) {
    const hasPending = state.myOrganizations.some((o) => o.status === "pending");
    if (hasPending) {
      notify(
        "Your group is awaiting approval from Admin (jahnavi5@umd.edu) before posting events.",
      );
    } else {
      notify("Create a student group first (and get it approved) to publish events.");
      openGroupModal(null);
    }
    return;
  }
  renderEventModal(modalRoot, {
    initialEvent,
    availableOrgs: postableOrgs,
    defaultOrgId,
    isAdmin: isAdminUser(),
    onSubmit: async (payload) => {
      try {
        if (initialEvent) {
          await api.put(`/events/${initialEvent.id}`, payload);
          notify("Event updated");
        } else {
          await api.post("/events", payload);
          notify("Event published to TerpLink");
        }
        await loadAppData();
        if (currentRoute === "/admin") await loadAdminOverview();
      } catch (err) {
        if (handleAuthError(err)) return;
        throw err;
      }
    },
  });
}

async function deleteEvent(event) {
  if (!window.confirm(`Delete the event "${event.title}"?`)) return;
  try {
    const res = await api.del(`/events/${event.id}`);
    if (res.user) state.user = res.user;
    notify(`Deleted "${event.title}"`);
    await loadAppData();
    if (currentRoute === "/admin") await loadAdminOverview();
  } catch (err) {
    fail(err);
  }
}

async function logout() {
  try {
    await api.post("/auth/logout");
  } catch {
    /* ignore */
  } finally {
    setSessionToken(null);
    window.google?.accounts?.id?.disableAutoSelect?.();
    state.user = null;
    state.status = "anonymous";
    shellMounted = false;
    currentRoute = null;
    navigate("/login", { replace: true });
  }
}

async function logoutEverywhere(btnEl) {
  if (btnEl) btnEl.disabled = true;
  try {
    await api.post("/auth/logout-all");
  } catch (err) {
    handleAuthError(err);
  } finally {
    await logout();
  }
}

// ============================================================================
// Splash Screen
// ============================================================================
function ensureSplash() {
  if (state.splashGone) {
    if (splashEl) {
      splashEl.remove();
      splashEl = null;
    }
    return;
  }
  const ready = state.minElapsed && state.status !== "loading";
  if (!splashEl) {
    splashEl = document.createElement("div");
    splashEl.className = `splash ${ready ? "leaving" : ""}`;
    splashEl.setAttribute("role", "status");
    splashEl.setAttribute("aria-label", "Loading TerpLink");
    splashEl.innerHTML = `
      <div class="splash-ring" aria-hidden="true"></div>
      <div class="splash-center">
        ${terpMark("splash-mark")}
        <div class="splash-word">
          TERP<span>LINK</span>
        </div>
        <p>Campus life, all in one place.</p>
      </div>
      <div class="splash-bottom">
        <div class="splash-loader" aria-hidden="true">
          <i></i>
        </div>
        <p>UNIVERSITY OF MARYLAND</p>
      </div>
    `;
    rootEl.appendChild(splashEl);
  } else {
    splashEl.classList.toggle("leaving", ready);
  }
}

// ============================================================================
// Login Screen
// ============================================================================
function renderLoginScreen() {
  if (loginResizeCleanup) {
    loginResizeCleanup();
    loginResizeCleanup = null;
  }
  cleanupPageDropdowns();
  shellMounted = false;
  currentRoute = "/login";

  const domain = state.authConfig.allowedDomain || "umd.edu";
  appContainerEl.innerHTML = `
    <div class="login-screen">
      <section class="login-hero">
        <img src="/images/featured-maryland-day.jpg" alt="Crowd enjoying a live outdoor concert" />
        <div class="login-shade"></div>
        <div class="brand login-brand">
          ${terpMark()}
          ${wordmark()}
        </div>
        <div class="login-hero-copy">
          <div class="live-pill">
            <i></i> FOR UMD STUDENTS
          </div>
          <h1>
            One campus.<br />A thousand ways to explore.
          </h1>
        </div>
      </section>

      <section class="login-sheet">
        <p class="eyebrow">WELCOME, TERPS</p>
        <h2>Sign in to TerpLink</h2>
        <p class="login-sub">Discover campus events, RSVP in one tap and keep your schedule in sync.</p>

        <div class="google-slot" id="google-login-slot"></div>

        <p class="login-status" id="login-status-text" hidden>Signing you in…</p>
        <div class="login-error" id="login-error-box" role="alert" hidden></div>

        <p class="login-note">
          ${icon("shield", 15)}
          <span>
            Only <b>@${escapeHtml(domain)}</b> (and <b>@terpmail.${escapeHtml(domain)}</b>) Google accounts can sign in.
          </span>
        </p>
      </section>
    </div>
  `;

  const slotEl = appContainerEl.querySelector("#google-login-slot");
  const statusEl = appContainerEl.querySelector("#login-status-text");
  const errorEl = appContainerEl.querySelector("#login-error-box");

  function setLoginError(msg) {
    if (!errorEl) return;
    if (msg) {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    } else {
      errorEl.textContent = "";
      errorEl.hidden = true;
    }
  }

  function setLoginBusy(busy) {
    slotEl?.classList.toggle("busy", busy);
    if (statusEl) statusEl.hidden = !busy;
  }

  if (!state.authConfig.googleClientId) {
    slotEl.innerHTML = `
      <div class="login-error" role="alert">
        Google OAuth is not configured on the server. Set <code>GOOGLE_CLIENT_ID</code> in
        <code>server/.env</code> and restart the server.
      </div>
    `;
    return;
  }

  const calcWidth = () => Math.max(240, Math.min(400, window.innerWidth - 48));
  let lastWidth = 0;

  async function onGoogleCredential(response) {
    if (!response?.credential) {
      setLoginError("Google sign-in was cancelled or failed. Please try again.");
      return;
    }
    setLoginError("");
    setLoginBusy(true);
    try {
      const { user: u, token } = await api.post("/auth/google", {
        credential: response.credential,
      });
      if (token) setSessionToken(token);
      state.user = u;
      state.status = "authenticated";
      const to =
        typeof state.returnTo === "string" &&
        state.returnTo.startsWith("/") &&
        !state.returnTo.startsWith("//") &&
        state.returnTo !== "/login"
          ? state.returnTo
          : "/";
      state.returnTo = "/";
      navigate(to, { replace: true });
      loadAppData();
    } catch (err) {
      setLoginError(err?.message || "Google sign-in failed. Please try again.");
      window.google?.accounts?.id?.disableAutoSelect?.();
    } finally {
      setLoginBusy(false);
    }
  }

  function mountGoogleButton(force = false) {
    if (!document.body.contains(slotEl)) return;
    if (!window.google?.accounts?.id) {
      window.setTimeout(() => mountGoogleButton(force), 80);
      return;
    }
    const w = calcWidth();
    if (!force && w === lastWidth) return;
    lastWidth = w;

    window.google.accounts.id.initialize({
      client_id: state.authConfig.googleClientId,
      callback: onGoogleCredential,
      context: "signin",
      ux_mode: "popup",
    });

    slotEl.innerHTML = "";
    window.google.accounts.id.renderButton(slotEl, {
      theme: "filled_black",
      shape: "pill",
      size: "large",
      text: "continue_with",
      logo_alignment: "center",
      width: String(w),
    });
  }

  mountGoogleButton(true);

  const onResize = () => mountGoogleButton(false);
  window.addEventListener("resize", onResize);
  loginResizeCleanup = () => window.removeEventListener("resize", onResize);
}

// ============================================================================
// App Shell (Topbar, Mobile Nav, Toast, Modals)
// ============================================================================
function ensureShellMounted() {
  if (shellMounted && appContainerEl.querySelector(".app-shell")) {
    updateShellChrome();
    return;
  }
  if (loginResizeCleanup) {
    loginResizeCleanup();
    loginResizeCleanup = null;
  }

  shellMounted = true;
  appContainerEl.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <a class="brand" href="/" id="shell-brand-link" aria-label="TerpLink home">
          ${terpMark()}
          ${wordmark()}
        </a>
        <nav class="desktop-nav" id="shell-desktop-nav" aria-label="Main navigation"></nav>
        <div class="header-actions">
          <label class="desktop-search">
            ${icon("search", 18)}
            <input
              id="shell-desktop-search"
              value="${escapeAttr(state.search)}"
              maxlength="80"
              placeholder="Search events & groups"
              aria-label="Search events and groups"
            />
          </label>
          <button
            class="icon-button notification"
            id="shell-bell-btn"
            aria-label="Notifications"
          >
            ${icon("bell")}
            <i></i>
          </button>
          <button class="avatar" id="shell-avatar-btn" aria-label="Open profile"></button>
        </div>
      </header>

      <div id="page-outlet"></div>

      <nav class="mobile-nav" id="shell-mobile-nav" aria-label="Mobile navigation"></nav>

      <div id="toast-root"></div>
      <div id="modal-root"></div>
    </div>
  `;

  appContainerEl.querySelector("#shell-brand-link").addEventListener("click", (e) => {
    e.preventDefault();
    navigate("/");
  });

  appContainerEl.querySelector("#shell-desktop-nav").addEventListener("click", (e) => {
    const a = e.target.closest("a[data-route]");
    if (!a) return;
    e.preventDefault();
    navigate(a.dataset.route);
  });

  appContainerEl.querySelector("#shell-mobile-nav").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-route]");
    if (!btn) return;
    navigate(btn.dataset.route);
  });

  const desktopSearchInput = appContainerEl.querySelector("#shell-desktop-search");
  desktopSearchInput.addEventListener("input", (e) => {
    state.search = e.target.value;
    const p = getPathname();
    if (p !== "/" && p !== "/discover") {
      navigate("/discover");
      // Keep focus in the header search input
      desktopSearchInput.focus();
    } else {
      syncSearchInputs(desktopSearchInput);
      if (p === "/") updateHomeFeedResults();
      else if (p === "/discover") updateDiscoverResults();
    }
  });

  appContainerEl.querySelector("#shell-bell-btn").addEventListener("click", () => {
    if (state.pendingCount > 0 && isAdminUser()) {
      navigate("/admin");
    } else {
      notify("You’re all caught up");
    }
  });

  appContainerEl.querySelector("#shell-avatar-btn").addEventListener("click", () => {
    navigate("/profile");
  });

  // Delegated click handler on #page-outlet for EventCard buttons
  appContainerEl.querySelector("#page-outlet").addEventListener("click", (e) => {
    const saveBtn = e.target.closest('[data-action="toggle-save"]');
    if (saveBtn) {
      toggleSave(saveBtn.dataset.eventId);
      return;
    }
    const rsvpBtn = e.target.closest('[data-action="rsvp-event"]');
    if (rsvpBtn) {
      const ev = state.events.find((x) => x.id === rsvpBtn.dataset.eventId);
      if (ev) openRsvp(ev);
      return;
    }
    const editBtn = e.target.closest('[data-action="edit-event"]');
    if (editBtn) {
      const ev =
        state.events.find((x) => x.id === editBtn.dataset.eventId) ||
        state.admin.data?.events?.find((x) => x.id === editBtn.dataset.eventId);
      if (ev) openEventModal(ev);
    }
  });

  updateShellChrome();
}

function syncSearchInputs(sourceInput = null) {
  const desktopInput = document.getElementById("shell-desktop-search");
  if (desktopInput && desktopInput !== sourceInput && desktopInput.value !== state.search) {
    desktopInput.value = state.search;
  }
  const homeMobileInput = document.getElementById("home-mobile-search");
  if (homeMobileInput && homeMobileInput !== sourceInput && homeMobileInput.value !== state.search) {
    homeMobileInput.value = state.search;
  }
  const discoverInput = document.getElementById("discover-search-input");
  if (discoverInput && discoverInput !== sourceInput && discoverInput.value !== state.search) {
    discoverInput.value = state.search;
  }
}

function updateShellChrome() {
  if (!shellMounted || !state.user) return;
  const pathname = getPathname();
  const isActive = (to) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  const desktopNav = document.getElementById("shell-desktop-nav");
  if (desktopNav) {
    desktopNav.innerHTML = `
      <a href="/" data-route="/" class="${pathname === "/" ? "active" : ""}">Discover</a>
      <a href="/groups" data-route="/groups" class="${pathname.startsWith("/groups") ? "active" : ""}">Organizations</a>
      <a href="/calendar" data-route="/calendar" class="${pathname.startsWith("/calendar") ? "active" : ""}">My calendar</a>
      ${
        isAdminUser()
          ? `<a href="/admin" data-route="/admin" class="${pathname.startsWith("/admin") ? "active" : ""}">Admin${
              state.pendingCount > 0 ? ` (${state.pendingCount})` : ""
            }</a>`
          : ""
      }
    `;
  }

  const avatarBtn = document.getElementById("shell-avatar-btn");
  if (avatarBtn) {
    avatarBtn.innerHTML = state.user.picture
      ? `<img src="${escapeAttr(state.user.picture)}" alt="" referrerpolicy="no-referrer" />`
      : escapeHtml(state.user.initials || "T");
  }

  const mobileNav = document.getElementById("shell-mobile-nav");
  if (mobileNav) {
    mobileNav.innerHTML = MOBILE_TABS.map((tab) => {
      const active = isActive(tab.to);
      return `
        <button
          data-route="${tab.to}"
          class="${active ? "active" : ""}"
          ${active ? 'aria-current="page"' : ""}
        >
          ${icon(tab.icon)}
          <span>${escapeHtml(tab.label)}</span>
        </button>
      `;
    }).join("");
  }

  syncSearchInputs();
}

// ============================================================================
// Shared EventCard HTML Renderer
// ============================================================================
function renderEventCardHtml(event, { saved, going }) {
  return `
    <article class="event-card">
      <div class="card-image">
        <img src="${escapeAttr(event.image)}" alt="" loading="lazy" />
        <div class="date-tile">
          <strong>${dayNum(event.startsAt)}</strong>
          <span>${monthAbbr(event.startsAt)}</span>
        </div>
        <button
          class="save-button ${saved ? "saved" : ""}"
          data-action="toggle-save"
          data-event-id="${escapeAttr(event.id)}"
          aria-label="${saved ? "Remove from saved" : "Save event"}"
        >
          ${icon("bookmark", 19, saved)}
        </button>
        ${
          event.note && event.note.toLowerCase().includes("free")
            ? `<span class="card-badge">${escapeHtml(event.note)}</span>`
            : ""
        }
      </div>
      <div class="card-body">
        <p class="card-org">${escapeHtml(event.org)}</p>
        <h3>${escapeHtml(event.title)}</h3>
        <div class="detail">
          ${icon("clock", 16)} ${timeOf(event.startsAt)}
        </div>
        <div class="detail">
          ${icon("pin", 16)} ${escapeHtml(event.location)}
        </div>
        <div class="card-footer">
          <div class="attendees">
            <span class="mini-avatar">J</span>
            <span class="mini-avatar">K</span>
            <span class="mini-avatar">S</span>
            <span>
              ${event.attendees} going${event.capacity ? ` · ${event.capacity} cap` : ""}
            </span>
          </div>
          <div class="card-footer-actions">
            ${
              event.canManage
                ? `
              <button
                type="button"
                class="card-manage-btn"
                data-action="edit-event"
                data-event-id="${escapeAttr(event.id)}"
                aria-label="Edit ${escapeAttr(event.title)}"
                title="Edit event"
              >
                ${icon("edit", 14)} Edit
              </button>
            `
                : ""
            }
            <button
              data-action="rsvp-event"
              data-event-id="${escapeAttr(event.id)}"
              class="${going ? "is-going" : ""}"
            >
              ${going ? `Going ${icon("check", 16)}` : `RSVP ${icon("arrow", 16)}`}
            </button>
          </div>
        </div>
      </div>
    </article>
  `;
}

// ============================================================================
// Page 1: Home (/)
// ============================================================================
function getHomeFeaturedAndFeed() {
  const featured = state.events.find((e) => e.featured) || state.events[0] || null;
  const feed = featured ? state.events.filter((e) => e.id !== featured.id) : state.events;
  return { featured, feed };
}

function updateHomeFeedResults() {
  const container = document.getElementById("home-feed-container");
  if (!container) return;
  const { feed } = getHomeFeaturedAndFeed();
  const visibleEvents = sortEvents(
    filterEvents(feed, state.home.activeCategory, state.search),
    state.home.sortBy,
  );
  const savedSet = getSavedSet();
  const rsvpMap = getRsvpMap();

  if (state.loading) {
    container.innerHTML = `
      <div class="event-grid">
        <div class="event-card skeleton-card"></div>
        <div class="event-card skeleton-card"></div>
        <div class="event-card skeleton-card"></div>
      </div>
    `;
  } else if (visibleEvents.length) {
    container.innerHTML = `
      <div class="event-grid">
        ${visibleEvents
          .map((event) =>
            renderEventCardHtml(event, {
              saved: savedSet.has(event.id),
              going: rsvpMap.has(event.id),
            }),
          )
          .join("")}
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="empty-state">
        ${icon("search", 28)}
        <h3>No events found</h3>
        <p>Try another search or category.</p>
      </div>
    `;
  }
}

function renderHomePage() {
  cleanupPageDropdowns();
  const outlet = document.getElementById("page-outlet");
  if (!outlet) return;

  const { featured } = getHomeFeaturedAndFeed();
  const headlineLines = (
    featured?.featuredHeadline || "One campus.\nA thousand ways to explore."
  ).split("\n");

  outlet.innerHTML = `
    <main id="feed">
      <section class="welcome-row">
        <div>
          <p class="eyebrow">${escapeHtml(longToday())}</p>
          <h1>${escapeHtml(greeting())}, ${escapeHtml(state.user.givenName)}.</h1>
          <p>There’s a lot happening around campus today.</p>
        </div>
        <div class="week-glance" id="calendar">
          <div>
            <strong>${state.events.length}</strong>
            <span>campus events</span>
          </div>
          <button id="home-view-calendar-btn">
            View calendar ${icon("arrow", 17)}
          </button>
        </div>
      </section>

      <label class="mobile-search">
        ${icon("search", 19)}
        <input
          id="home-mobile-search"
          value="${escapeAttr(state.search)}"
          maxlength="80"
          placeholder="Search events & organizations"
          aria-label="Search events and organizations"
        />
      </label>

      ${
        state.loadError
          ? `
        <div class="empty-state">
          ${icon("close", 28)}
          <h3>Couldn’t load events</h3>
          <p>${escapeHtml(state.loadError)}</p>
          <button class="text-button retry" id="home-retry-btn">
            Try again ${icon("arrow", 17)}
          </button>
        </div>
      `
          : ""
      }

      ${
        featured
          ? `
        <section class="featured">
          <img src="${escapeAttr(featured.image)}" alt="${escapeAttr(featured.title)}" />
          <div class="featured-shade"></div>
          <div class="featured-date">
            <b>${dayNum(featured.startsAt)}</b>
            <span>${monthAbbr(featured.startsAt)}</span>
          </div>
          <div class="featured-copy">
            <div class="live-pill">
              <i></i> ${escapeHtml(featured.featuredLabel || "FEATURED ON CAMPUS")}
            </div>
            <p>${escapeHtml(featured.title)}</p>
            <h2>
              ${headlineLines
                .map((line, i) => `<span>${i > 0 ? "<br />" : ""}${escapeHtml(line)}</span>`)
                .join("")}
            </h2>
            <div class="featured-meta">
              <span>${icon("clock", 17)} ${timeRange(featured.startsAt, featured.endsAt)}</span>
              <span>${icon("pin", 17)} ${escapeHtml(featured.location)}</span>
            </div>
            <button id="home-explore-featured-btn">
              Explore event ${icon("arrow", 18)}
            </button>
          </div>
        </section>
      `
          : state.loading
            ? `<section class="featured skeleton" aria-busy="true"></section>`
            : ""
      }

      <section class="feed-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">PICKED FOR YOU</p>
            <h2>Find your next thing</h2>
          </div>
          <div class="section-heading-actions">
            <span id="home-sort-dd-slot"></span>
            <button class="text-button" id="home-see-all-btn">
              See all ${icon("arrow", 17)}
            </button>
          </div>
        </div>
        <div class="category-scroll" id="home-category-scroll">
          ${CATEGORIES.map(
            (cat) => `
            <button
              data-category="${escapeAttr(cat)}"
              class="${state.home.activeCategory === cat ? "active" : ""}"
            >
              ${cat === "Free food" ? '<span class="tiny-dot"></span>' : ""}
              ${escapeHtml(cat)}
            </button>
          `,
          ).join("")}
        </div>

        <div id="home-feed-container"></div>
      </section>

      <section class="org-section" id="organizations">
        <div class="org-copy">
          <p class="eyebrow">MAKE CAMPUS YOURS</p>
          <h2>Find your people.</h2>
          <p>
            Explore ${
              state.organizations.length ? `${state.organizations.length} active` : "student"
            } organizations built around the things you care about, or start your own.
          </p>
          <button id="home-explore-orgs-btn">
            Explore organizations ${icon("arrow", 18)}
          </button>
        </div>
        <div class="org-list" id="home-org-list">
          ${state.organizations
            .slice(0, 3)
            .map(
              (org) => `
            <div class="org-item" role="link" tabindex="0">
              <span class="org-logo ${escapeAttr(org.color)}">${escapeHtml(org.letter)}</span>
              <div>
                <b>${escapeHtml(org.name)}</b>
                <span>${escapeHtml(org.category)} · ${formatMembers(org.members)} members</span>
              </div>
              ${icon("chevron")}
            </div>
          `,
            )
            .join("")}
        </div>
      </section>
    </main>
  `;

  const sortDd = registerDropdown(
    createDropdown({
      variant: "pill",
      align: "right",
      value: state.home.sortBy,
      onChange: (val) => {
        state.home.sortBy = val;
        updateHomeFeedResults();
      },
      options: EVENT_SORT_OPTIONS,
      ariaLabel: "Sort feed events",
    }),
  );
  outlet.querySelector("#home-sort-dd-slot").appendChild(sortDd);

  outlet.querySelector("#home-view-calendar-btn").addEventListener("click", () => {
    navigate("/calendar");
  });

  const mobileSearch = outlet.querySelector("#home-mobile-search");
  mobileSearch.addEventListener("input", (e) => {
    state.search = e.target.value;
    syncSearchInputs(mobileSearch);
    updateHomeFeedResults();
  });

  const retryBtn = outlet.querySelector("#home-retry-btn");
  if (retryBtn) retryBtn.addEventListener("click", loadAppData);

  const featuredBtn = outlet.querySelector("#home-explore-featured-btn");
  if (featuredBtn && featured) {
    featuredBtn.addEventListener("click", () => openRsvp(featured));
  }

  outlet.querySelector("#home-see-all-btn").addEventListener("click", () => {
    navigate("/discover");
  });

  const catScroll = outlet.querySelector("#home-category-scroll");
  catScroll.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-category]");
    if (!btn) return;
    state.home.activeCategory = btn.dataset.category;
    catScroll.querySelectorAll("button[data-category]").forEach((b) => {
      b.classList.toggle("active", b.dataset.category === state.home.activeCategory);
    });
    updateHomeFeedResults();
  });

  outlet.querySelector("#home-explore-orgs-btn").addEventListener("click", () => {
    navigate("/groups");
  });

  const orgList = outlet.querySelector("#home-org-list");
  orgList.addEventListener("click", (e) => {
    if (e.target.closest(".org-item")) navigate("/groups");
  });
  orgList.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.closest(".org-item")) navigate("/groups");
  });

  updateHomeFeedResults();
}

// ============================================================================
// Page 2: Discover (/discover)
// ============================================================================
function updateDiscoverResults() {
  const countEl = document.getElementById("discover-result-count");
  const container = document.getElementById("discover-results-container");
  const clearBtn = document.getElementById("discover-clear-search");
  if (!container || !countEl) return;

  if (clearBtn) clearBtn.hidden = !state.search;

  const visible = sortEvents(
    filterEvents(state.events, state.discover.activeCategory, state.search),
    state.discover.sortBy,
  );
  const savedSet = getSavedSet();
  const rsvpMap = getRsvpMap();

  countEl.textContent = state.loading
    ? "Loading events…"
    : `${visible.length} ${visible.length === 1 ? "event" : "events"}`;

  if (visible.length) {
    container.innerHTML = `
      <div class="event-grid event-list">
        ${visible
          .map((event) =>
            renderEventCardHtml(event, {
              saved: savedSet.has(event.id),
              going: rsvpMap.has(event.id),
            }),
          )
          .join("")}
      </div>
    `;
  } else if (!state.loading) {
    container.innerHTML = `
      <div class="empty-state">
        ${icon("search", 28)}
        <h3>No events found</h3>
        <p>Try another search or category.</p>
      </div>
    `;
  } else {
    container.innerHTML = "";
  }
}

function renderDiscoverPage() {
  cleanupPageDropdowns();
  const outlet = document.getElementById("page-outlet");
  if (!outlet) return;

  outlet.innerHTML = `
    <main class="page">
      <section class="page-heading page-heading-row">
        <div>
          <p class="eyebrow">EXPLORE CAMPUS</p>
          <h1>Discover events</h1>
          <p>Search every upcoming event across UMD’s student organizations.</p>
        </div>
        <button class="action-pill dark" id="discover-create-event-btn">
          ${icon("plus", 16)} Create event
        </button>
      </section>

      <div class="filter-toolbar">
        <label class="mobile-search search-field">
          ${icon("search", 19)}
          <input
            id="discover-search-input"
            value="${escapeAttr(state.search)}"
            maxlength="80"
            placeholder="Search events & organizations"
            aria-label="Search events and organizations"
          />
          <button
            type="button"
            class="clear-search"
            id="discover-clear-search"
            aria-label="Clear search"
            ${state.search ? "" : "hidden"}
          >
            ${icon("close", 16)}
          </button>
        </label>

        <div class="filter-dropdowns" id="discover-filter-dropdowns"></div>
      </div>

      <div class="category-scroll" id="discover-category-scroll">
        ${DISCOVER_CATEGORIES.map(
          (cat) => `
          <button
            data-category="${escapeAttr(cat)}"
            class="${state.discover.activeCategory === cat ? "active" : ""}"
          >
            ${cat === "Free food" ? '<span class="tiny-dot"></span>' : ""}
            ${escapeHtml(cat === "For you" ? "All events" : cat)}
          </button>
        `,
        ).join("")}
      </div>

      <p class="result-count" id="discover-result-count"></p>

      <div id="discover-results-container"></div>
    </main>
  `;

  outlet.querySelector("#discover-create-event-btn").addEventListener("click", () => {
    openEventModal(null);
  });

  const searchInput = outlet.querySelector("#discover-search-input");
  const clearBtn = outlet.querySelector("#discover-clear-search");

  searchInput.addEventListener("input", (e) => {
    state.search = e.target.value;
    syncSearchInputs(searchInput);
    updateDiscoverResults();
  });

  clearBtn.addEventListener("click", (e) => {
    e.preventDefault();
    state.search = "";
    searchInput.value = "";
    syncSearchInputs(searchInput);
    updateDiscoverResults();
    searchInput.focus();
  });

  const catScroll = outlet.querySelector("#discover-category-scroll");
  function syncCategoryPills() {
    catScroll.querySelectorAll("button[data-category]").forEach((b) => {
      b.classList.toggle("active", b.dataset.category === state.discover.activeCategory);
    });
  }

  const filterDropdowns = outlet.querySelector("#discover-filter-dropdowns");
  const catDd = registerDropdown(
    createDropdown({
      variant: "pill",
      value: state.discover.activeCategory,
      onChange: (val) => {
        state.discover.activeCategory = val;
        syncCategoryPills();
        updateDiscoverResults();
      },
      options: DISCOVER_CATEGORY_DROPDOWN_OPTIONS,
      ariaLabel: "Filter by category",
    }),
  );
  const sortDd = registerDropdown(
    createDropdown({
      variant: "pill",
      align: "right",
      value: state.discover.sortBy,
      onChange: (val) => {
        state.discover.sortBy = val;
        updateDiscoverResults();
      },
      options: EVENT_SORT_OPTIONS,
      ariaLabel: "Sort events",
    }),
  );
  filterDropdowns.appendChild(catDd);
  filterDropdowns.appendChild(sortDd);

  catScroll.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-category]");
    if (!btn) return;
    state.discover.activeCategory = btn.dataset.category;
    catDd.setValue(state.discover.activeCategory);
    syncCategoryPills();
    updateDiscoverResults();
  });

  updateDiscoverResults();
}

// ============================================================================
// Page 3: Calendar (/calendar)
// ============================================================================
function renderCalendarPage() {
  cleanupPageDropdowns();
  const outlet = document.getElementById("page-outlet");
  if (!outlet) return;

  const savedSet = getSavedSet();
  const rsvpMap = getRsvpMap();
  const going = sortEvents(
    state.events.filter((e) => rsvpMap.has(e.id)),
    state.calendar.sortBy,
  );
  const saved = sortEvents(
    state.events.filter((e) => savedSet.has(e.id)),
    state.calendar.sortBy,
  );
  const tab = state.calendar.tab;
  const list = tab === "going" ? going : saved;

  outlet.innerHTML = `
    <main class="page">
      <section class="page-heading page-heading-row">
        <div>
          <p class="eyebrow">MY SCHEDULE</p>
          <h1>Your calendar</h1>
          <p>Everything you’ve RSVP’d to and saved, in one place.</p>
        </div>
        <span id="calendar-sort-slot"></span>
      </section>

      <div class="segmented" role="tablist">
        <button
          role="tab"
          data-tab="going"
          aria-selected="${tab === "going"}"
          class="${tab === "going" ? "active" : ""}"
        >
          Going <em>${going.length}</em>
        </button>
        <button
          role="tab"
          data-tab="saved"
          aria-selected="${tab === "saved"}"
          class="${tab === "saved" ? "active" : ""}"
        >
          Saved <em>${saved.length}</em>
        </button>
      </div>

      ${
        state.loading
          ? `<p class="result-count">Loading…</p>`
          : list.length
            ? `
          <div class="schedule-list" id="calendar-schedule-list">
            ${list
              .map(
                (event) => `
              <article class="schedule-item" data-event-id="${escapeAttr(event.id)}">
                <div class="schedule-main">
                  <div class="date-tile static">
                    <strong>${dayNum(event.startsAt)}</strong>
                    <span>${monthAbbr(event.startsAt)}</span>
                  </div>
                  <div class="schedule-info">
                    <p class="card-org">${escapeHtml(event.org)}</p>
                    <b>${escapeHtml(event.title)}</b>
                    <div class="detail">
                      ${icon("clock", 15)} ${timeOf(event.startsAt)}
                    </div>
                    <div class="detail">
                      ${icon("pin", 15)} ${escapeHtml(event.location)}
                    </div>
                  </div>
                  <img src="${escapeAttr(event.image)}" alt="" />
                </div>
                <div class="schedule-actions">
                  ${
                    tab === "going"
                      ? `
                    <button class="chip-button dark" data-cal-action="pass" data-id="${escapeAttr(event.id)}">
                      ${icon("ticket", 15)} View pass
                    </button>
                    <a class="chip-button" href="${escapeAttr(googleCalendarUrl(event))}" target="_blank" rel="noopener noreferrer">
                      ${icon("plus", 15)} Google Calendar
                    </a>
                    <button class="chip-button" data-cal-action="ics" data-id="${escapeAttr(event.id)}">
                      ${icon("calendar", 15)} Apple / .ics
                    </button>
                    <button class="chip-button danger" data-cal-action="cancel" data-id="${escapeAttr(event.id)}">
                      Cancel
                    </button>
                  `
                      : `
                    <button class="chip-button dark" data-cal-action="pass" data-id="${escapeAttr(event.id)}">
                      ${rsvpMap.has(event.id) ? "Going" : "RSVP"} ${icon("arrow", 15)}
                    </button>
                    <button class="chip-button" data-cal-action="unsave" data-id="${escapeAttr(event.id)}">
                      ${icon("bookmark", 15)} Remove
                    </button>
                  `
                  }
                </div>
              </article>
            `,
              )
              .join("")}
          </div>
        `
            : `
          <div class="empty-state">
            ${icon(tab === "going" ? "ticket" : "bookmark", 28)}
            <h3>${tab === "going" ? "No RSVPs yet" : "Nothing saved yet"}</h3>
            <p>${
              tab === "going"
                ? "RSVP to an event and your pass will appear here."
                : "Tap the bookmark on any event to save it."
            }</p>
            <button class="text-button retry" id="calendar-discover-btn">
              Discover events ${icon("arrow", 17)}
            </button>
          </div>
        `
      }
    </main>
  `;

  const sortDd = registerDropdown(
    createDropdown({
      variant: "pill",
      align: "right",
      value: state.calendar.sortBy,
      onChange: (val) => {
        state.calendar.sortBy = val;
        renderCalendarPage();
      },
      options: EVENT_SORT_OPTIONS,
      ariaLabel: "Sort calendar events",
    }),
  );
  outlet.querySelector("#calendar-sort-slot").appendChild(sortDd);

  outlet.querySelector(".segmented").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    state.calendar.tab = btn.dataset.tab;
    renderCalendarPage();
  });

  const discoverBtn = outlet.querySelector("#calendar-discover-btn");
  if (discoverBtn) {
    discoverBtn.addEventListener("click", () => navigate("/discover"));
  }

  const scheduleList = outlet.querySelector("#calendar-schedule-list");
  if (scheduleList) {
    scheduleList.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-cal-action]");
      if (!btn) return;
      const ev = state.events.find((x) => x.id === btn.dataset.id);
      if (!ev) return;
      const action = btn.dataset.calAction;
      if (action === "pass") openRsvp(ev);
      else if (action === "ics") downloadICS(ev);
      else if (action === "cancel") cancelRsvp(ev);
      else if (action === "unsave") toggleSave(ev.id);
    });
  }
}

// ============================================================================
// Page 4: Groups (/groups)
// ============================================================================
function renderStatusBadgeHtml(status) {
  if (status === "pending") {
    return `<span class="status-badge pending">Pending Admin approval (jahnavi5@umd.edu)</span>`;
  }
  if (status === "rejected") {
    return `<span class="status-badge rejected">Rejected</span>`;
  }
  return `<span class="status-badge approved">Approved</span>`;
}

function updateGroupsDirectoryList() {
  const container = document.getElementById("groups-directory-container");
  const clearBtn = document.getElementById("groups-clear-search");
  if (!container) return;

  const { query, categoryFilter, sortBy } = state.groups;
  if (clearBtn) clearBtn.hidden = !query;

  if (state.loading) {
    container.innerHTML = `<p class="result-count">Loading…</p>`;
    return;
  }

  const q = query.trim().toLowerCase();
  let visibleOrgs = state.organizations.filter((o) => {
    const catMatch = categoryFilter === "all" || o.category === categoryFilter;
    const textMatch = `${o.name} ${o.category} ${o.description || ""}`.toLowerCase().includes(q);
    return catMatch && textMatch;
  });

  if (sortBy === "members") {
    visibleOrgs = [...visibleOrgs].sort((a, b) => (b.members || 0) - (a.members || 0));
  } else if (sortBy === "az") {
    visibleOrgs = [...visibleOrgs].sort((a, b) => a.name.localeCompare(b.name));
  }

  const followSet = getFollowSet();

  if (visibleOrgs.length) {
    container.innerHTML = `
      <div class="group-list">
        ${visibleOrgs
          .map((org) => {
            const following = followSet.has(org.id);
            return `
              <article class="group-card" data-org-id="${escapeAttr(org.id)}">
                <span class="org-logo ${escapeAttr(org.color)}">${escapeHtml(org.letter)}</span>
                <div class="group-info">
                  <b>${escapeHtml(org.name)}</b>
                  <span>${escapeHtml(org.category)} · ${formatMembers(org.members)} members</span>
                  ${org.description ? `<p>${escapeHtml(org.description)}</p>` : ""}
                  ${
                    org.canManage
                      ? `
                    <div class="group-owner-bar">
                      <button type="button" class="chip-button dark" data-group-action="post-event" data-org-id="${escapeAttr(org.id)}">
                        ${icon("plus", 14)} Post event
                      </button>
                      <button type="button" class="chip-button" data-group-action="edit-org" data-org-id="${escapeAttr(org.id)}">
                        ${icon("edit", 14)} Edit
                      </button>
                      <button type="button" class="chip-button danger" data-group-action="delete-org" data-org-id="${escapeAttr(org.id)}">
                        ${icon("trash", 14)} Delete
                      </button>
                    </div>
                  `
                      : ""
                  }
                </div>
                <button
                  class="follow-button ${following ? "following" : ""}"
                  data-group-action="toggle-follow"
                  data-org-id="${escapeAttr(org.id)}"
                  aria-pressed="${following}"
                >
                  ${
                    following
                      ? `${icon("check", 15)} Joined`
                      : `${icon("plus", 15)} Join`
                  }
                </button>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="empty-state">
        ${icon("users", 28)}
        <h3>No organizations found</h3>
        <p>Try a different search or start a new student group.</p>
      </div>
    `;
  }
}

function renderGroupsPage() {
  cleanupPageDropdowns();
  const outlet = document.getElementById("page-outlet");
  if (!outlet) return;

  const myManagedEvents = state.events.filter(
    (e) =>
      e.canManage &&
      (e.createdBy === state.user.id ||
        state.myOrganizations.some((o) => o.id === e.organizationId)),
  );
  const tab = state.groups.tab;

  outlet.innerHTML = `
    <main class="page">
      <section class="page-heading page-heading-row">
        <div>
          <p class="eyebrow">MAKE CAMPUS YOURS</p>
          <h1>Find your people.</h1>
          <p>Join an approved student organization, or create your own group and publish campus events.</p>
        </div>
        <div class="heading-actions">
          <button class="action-pill" id="groups-create-group-btn">
            ${icon("plus", 16)} Create group
          </button>
          <button class="action-pill dark" id="groups-create-event-btn">
            ${icon("calendar", 16)} Create event
          </button>
        </div>
      </section>

      <div class="segmented" role="tablist">
        <button
          role="tab"
          data-tab="all"
          aria-selected="${tab === "all"}"
          class="${tab === "all" ? "active" : ""}"
        >
          Campus Directory <em>${state.organizations.length}</em>
        </button>
        <button
          role="tab"
          data-tab="mine"
          aria-selected="${tab === "mine"}"
          class="${tab === "mine" ? "active" : ""}"
        >
          My Groups & Events <em>${state.myOrganizations.length + myManagedEvents.length}</em>
        </button>
      </div>

      ${
        tab === "all"
          ? `
        <div class="filter-toolbar">
          <label class="mobile-search search-field">
            ${icon("search", 19)}
            <input
              id="groups-search-input"
              value="${escapeAttr(state.groups.query)}"
              maxlength="80"
              placeholder="Search organizations"
              aria-label="Search organizations"
            />
            <button
              type="button"
              class="clear-search"
              id="groups-clear-search"
              aria-label="Clear search"
              ${state.groups.query ? "" : "hidden"}
            >
              ${icon("close", 16)}
            </button>
          </label>
          <div class="filter-dropdowns" id="groups-filter-dropdowns"></div>
        </div>
        <div id="groups-directory-container"></div>
      `
          : `
        <div class="manage-sections" id="groups-mine-container">
          <section>
            <div class="sub-heading">
              <h2>My created groups (${state.myOrganizations.length})</h2>
              <button class="text-button" data-group-action="new-group">
                ${icon("plus", 16)} New group
              </button>
            </div>
            ${
              state.myOrganizations.length
                ? `
              <div class="group-list">
                ${state.myOrganizations
                  .map(
                    (org) => `
                  <article class="group-card manage-group-card">
                    <span class="org-logo ${escapeAttr(org.color)}">${escapeHtml(org.letter)}</span>
                    <div class="group-info">
                      <div class="group-title-row">
                        <b>${escapeHtml(org.name)}</b>
                        ${renderStatusBadgeHtml(org.status)}
                      </div>
                      <span>${escapeHtml(org.category)} · ${formatMembers(org.members)} members</span>
                      ${org.description ? `<p>${escapeHtml(org.description)}</p>` : ""}
                      ${
                        org.status === "rejected" && org.rejectionReason
                          ? `<p class="reject-reason">Reason: ${escapeHtml(org.rejectionReason)}</p>`
                          : ""
                      }
                      <div class="group-owner-bar">
                        ${
                          org.status === "approved"
                            ? `
                          <button type="button" class="chip-button dark" data-group-action="post-event" data-org-id="${escapeAttr(org.id)}">
                            ${icon("plus", 14)} Create event
                          </button>
                        `
                            : ""
                        }
                        <button type="button" class="chip-button" data-group-action="edit-org" data-org-id="${escapeAttr(org.id)}">
                          ${icon("edit", 14)} ${org.status === "rejected" ? "Edit & resubmit" : "Edit group"}
                        </button>
                        <button type="button" class="chip-button danger" data-group-action="delete-org" data-org-id="${escapeAttr(org.id)}">
                          ${icon("trash", 14)} Delete
                        </button>
                      </div>
                    </div>
                  </article>
                `,
                  )
                  .join("")}
              </div>
            `
                : `
              <div class="empty-state compact">
                ${icon("users", 26)}
                <h3>You haven’t created a group yet</h3>
                <p>Request a new student organization. Once approved by jahnavi5@umd.edu, you can publish events.</p>
                <button class="text-button retry" data-group-action="new-group">
                  Create your first group ${icon("arrow", 16)}
                </button>
              </div>
            `
            }
          </section>

          <section>
            <div class="sub-heading">
              <h2>My published events (${myManagedEvents.length})</h2>
              <button class="text-button" data-group-action="new-event">
                ${icon("plus", 16)} New event
              </button>
            </div>
            ${
              myManagedEvents.length
                ? `
              <div class="schedule-list">
                ${myManagedEvents
                  .map(
                    (event) => `
                  <article class="schedule-item">
                    <div class="schedule-main">
                      <div class="date-tile static">
                        <strong>${dayNum(event.startsAt)}</strong>
                        <span>${monthAbbr(event.startsAt)}</span>
                      </div>
                      <div class="schedule-info">
                        <p class="card-org">${escapeHtml(event.org)}</p>
                        <b>${escapeHtml(event.title)}</b>
                        <div class="detail">
                          ${icon("clock", 15)} ${timeOf(event.startsAt)} · ${event.attendees} going${
                            event.capacity ? ` / ${event.capacity}` : ""
                          }
                        </div>
                        <div class="detail">
                          ${icon("pin", 15)} ${escapeHtml(event.location)}
                        </div>
                      </div>
                      <img src="${escapeAttr(event.image)}" alt="" />
                    </div>
                    <div class="schedule-actions">
                      <button class="chip-button dark" data-group-action="edit-event" data-event-id="${escapeAttr(event.id)}">
                        ${icon("edit", 14)} Edit event
                      </button>
                      <button class="chip-button danger" data-group-action="delete-event" data-event-id="${escapeAttr(event.id)}">
                        ${icon("trash", 14)} Delete event
                      </button>
                    </div>
                  </article>
                `,
                  )
                  .join("")}
              </div>
            `
                : `
              <div class="empty-state compact">
                ${icon("calendar", 26)}
                <h3>No published events yet</h3>
                <p>Once your organization is approved, publish events here to reach all UMD students.</p>
              </div>
            `
            }
          </section>
        </div>
      `
      }
    </main>
  `;

  outlet.querySelector("#groups-create-group-btn").addEventListener("click", () => {
    openGroupModal(null);
  });
  outlet.querySelector("#groups-create-event-btn").addEventListener("click", () => {
    openEventModal(null);
  });

  outlet.querySelector(".segmented").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    state.groups.tab = btn.dataset.tab;
    renderGroupsPage();
  });

  if (tab === "all") {
    const searchInput = outlet.querySelector("#groups-search-input");
    const clearBtn = outlet.querySelector("#groups-clear-search");

    searchInput.addEventListener("input", (e) => {
      state.groups.query = e.target.value;
      updateGroupsDirectoryList();
    });

    clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      state.groups.query = "";
      searchInput.value = "";
      updateGroupsDirectoryList();
      searchInput.focus();
    });

    const ddSlot = outlet.querySelector("#groups-filter-dropdowns");
    const catDd = registerDropdown(
      createDropdown({
        variant: "pill",
        value: state.groups.categoryFilter,
        onChange: (val) => {
          state.groups.categoryFilter = val;
          updateGroupsDirectoryList();
        },
        options: GROUP_CATEGORY_OPTIONS,
        ariaLabel: "Filter organizations by category",
      }),
    );
    const sortDd = registerDropdown(
      createDropdown({
        variant: "pill",
        align: "right",
        value: state.groups.sortBy,
        onChange: (val) => {
          state.groups.sortBy = val;
          updateGroupsDirectoryList();
        },
        options: GROUP_SORT_OPTIONS,
        ariaLabel: "Sort organizations",
      }),
    );
    ddSlot.appendChild(catDd);
    ddSlot.appendChild(sortDd);

    updateGroupsDirectoryList();
  }

  // Delegated actions for both tabs
  outlet.querySelector("main").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-group-action]");
    if (!btn) return;
    const action = btn.dataset.groupAction;
    const findOrg = (id) =>
      state.organizations.find((o) => o.id === id) ||
      state.myOrganizations.find((o) => o.id === id);

    if (action === "toggle-follow") {
      const org = findOrg(btn.dataset.orgId);
      if (org) toggleFollow(org);
    } else if (action === "post-event") {
      openEventModal(null, btn.dataset.orgId);
    } else if (action === "edit-org") {
      const org = findOrg(btn.dataset.orgId);
      if (org) openGroupModal(org);
    } else if (action === "delete-org") {
      const org = findOrg(btn.dataset.orgId);
      if (org) deleteGroup(org);
    } else if (action === "new-group") {
      openGroupModal(null);
    } else if (action === "new-event") {
      openEventModal(null);
    } else if (action === "edit-event") {
      const ev = state.events.find((x) => x.id === btn.dataset.eventId);
      if (ev) openEventModal(ev);
    } else if (action === "delete-event") {
      const ev = state.events.find((x) => x.id === btn.dataset.eventId);
      if (ev) deleteEvent(ev);
    }
  });
}

// ============================================================================
// Page 5: Profile (/profile)
// ============================================================================
function renderProfilePage() {
  cleanupPageDropdowns();
  const outlet = document.getElementById("page-outlet");
  if (!outlet) return;

  const isAdmin = isAdminUser();
  const u = state.user;

  outlet.innerHTML = `
    <main class="page">
      <section class="profile-card">
        <div class="profile-avatar" aria-hidden="true">
          ${
            u.picture
              ? `<img src="${escapeAttr(u.picture)}" alt="" referrerpolicy="no-referrer" />`
              : escapeHtml(u.initials || "T")
          }
        </div>
        <div>
          <p class="eyebrow">${isAdmin ? "TERPLINK APP ADMIN" : "UMD STUDENT"}</p>
          <h1>${escapeHtml(u.name)}</h1>
          <p class="profile-email">${escapeHtml(u.email)}</p>
          <span class="verified-pill">
            ${icon("shield", 13)}
            ${
              isAdmin
                ? "Administrator · Verified UMD account"
                : "Verified University of Maryland account"
            }
          </span>
        </div>
      </section>

      <section class="profile-stats">
        <div>
          <strong>${u.rsvps.length}</strong>
          <span>Going</span>
        </div>
        <div>
          <strong>${u.savedEvents.length}</strong>
          <span>Saved</span>
        </div>
        <div>
          <strong>${u.followedOrgs.length}</strong>
          <span>Groups</span>
        </div>
      </section>

      ${
        isAdmin
          ? `
        <section class="admin-callout">
          <div>
            <p class="eyebrow">ADMINISTRATION · ${escapeHtml(u.email.toUpperCase())}</p>
            <h2>Group Approval & Campus Management</h2>
            <p>
              Review and approve student organization creation requests and manage all campus groups & events.
            </p>
          </div>
          <button class="primary-button admin-open-btn" data-profile-action="admin">
            Open Admin Portal
            ${state.pendingCount > 0 ? `<span class="pending-pill">${state.pendingCount} pending</span>` : ""}
            ${icon("arrow", 17)}
          </button>
        </section>
      `
          : ""
      }

      <section class="settings-list">
        ${
          isAdmin
            ? `
          <button class="admin-link-row" data-profile-action="admin">
            ${icon("shield", 19)}
            <span>
              Admin Dashboard — Approve Group Requests${
                state.pendingCount > 0 ? ` (${state.pendingCount} pending)` : ""
              }
            </span>
            ${icon("chevron", 18)}
          </button>
        `
            : ""
        }
        <button data-profile-action="groups">
          ${icon("users", 19)}
          <span>My Groups & Events (${state.myOrganizations.length} created)</span>
          ${icon("chevron", 18)}
        </button>
        <button data-profile-action="new-group">
          ${icon("plus", 19)}
          <span>Request a new student group</span>
          ${icon("chevron", 18)}
        </button>
        <button data-profile-action="new-event">
          ${icon("calendar", 19)}
          <span>Publish a campus event</span>
          ${icon("chevron", 18)}
        </button>
        <button data-profile-action="notifications">
          ${icon("bell", 19)}
          <span>Notifications</span>
          ${icon("chevron", 18)}
        </button>
        <button data-profile-action="logout">
          ${icon("logout", 19)}
          <span>Sign out</span>
          ${icon("chevron", 18)}
        </button>
        <button data-profile-action="logout-all" class="danger">
          ${icon("shield", 19)}
          <span>Sign out of all devices</span>
          ${icon("chevron", 18)}
        </button>
      </section>

      <p class="profile-foot">TerpLink · Built for Terps, by Terps.</p>
    </main>
  `;

  outlet.querySelector("main").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-profile-action]");
    if (!btn) return;
    const action = btn.dataset.profileAction;
    if (action === "admin") navigate("/admin");
    else if (action === "groups") navigate("/groups");
    else if (action === "new-group") openGroupModal(null);
    else if (action === "new-event") openEventModal(null);
    else if (action === "notifications") notify("Event reminders are on");
    else if (action === "logout") logout();
    else if (action === "logout-all") logoutEverywhere(btn);
  });
}

// ============================================================================
// Page 6: Admin (/admin)
// ============================================================================
function renderAdminBody() {
  const bodyEl = document.getElementById("admin-body-container");
  if (!bodyEl) return;

  const { data, loading, error, tab, statusFilter, eventCatFilter, busyId } = state.admin;
  const pending = data?.pendingOrganizations || [];
  const allOrgs = data?.organizations || [];
  const allEvents = data?.events || [];

  const filteredOrgs =
    statusFilter === "all" ? allOrgs : allOrgs.filter((o) => o.status === statusFilter);
  const filteredEvents =
    eventCatFilter === "all" ? allEvents : allEvents.filter((e) => e.category === eventCatFilter);

  let html = "";
  if (error) {
    html += `<div class="login-error" role="alert">${escapeHtml(error)}</div>`;
  }

  if (loading) {
    html += `<p class="result-count">Loading live MongoDB data…</p>`;
  } else if (tab === "pending") {
    if (pending.length) {
      html += `
        <div class="schedule-list">
          ${pending
            .map(
              (org) => `
            <article class="schedule-item admin-request-card">
              <div class="admin-request-top">
                <span class="org-logo ${escapeAttr(org.color)}">${escapeHtml(org.letter)}</span>
                <div class="group-info">
                  <div class="group-title-row">
                    <b>${escapeHtml(org.name)}</b>
                    <span class="status-badge pending">Pending review</span>
                  </div>
                  <span>
                    ${escapeHtml(org.category)} · Requested by <b>${escapeHtml(org.createdByName || "UMD Student")}</b> (${escapeHtml(
                      org.createdByEmail || "UMD Student",
                    )})
                  </span>
                  ${org.description ? `<p>${escapeHtml(org.description)}</p>` : ""}
                </div>
              </div>
              <div class="schedule-actions">
                <button
                  class="chip-button approve-btn"
                  data-admin-action="approve-org"
                  data-org-id="${escapeAttr(org.id)}"
                  ${busyId === org.id ? "disabled" : ""}
                >
                  ${icon("check", 15)} Approve group
                </button>
                <button
                  class="chip-button danger"
                  data-admin-action="reject-org"
                  data-org-id="${escapeAttr(org.id)}"
                  ${busyId === org.id ? "disabled" : ""}
                >
                  ${icon("close", 15)} Reject
                </button>
                <button
                  class="chip-button"
                  data-admin-action="edit-org"
                  data-org-id="${escapeAttr(org.id)}"
                >
                  ${icon("edit", 14)} Edit details
                </button>
              </div>
            </article>
          `,
            )
            .join("")}
        </div>
      `;
    } else {
      html += `
        <div class="empty-state">
          ${icon("check", 28)}
          <h3>All caught up!</h3>
          <p>There are no pending group creation requests waiting for approval.</p>
        </div>
      `;
    }
  } else if (tab === "groups") {
    html += `
      <div class="group-list">
        ${filteredOrgs
          .map(
            (org) => `
          <article class="group-card manage-group-card">
            <span class="org-logo ${escapeAttr(org.color)}">${escapeHtml(org.letter)}</span>
            <div class="group-info">
              <div class="group-title-row">
                <b>${escapeHtml(org.name)}</b>
                <span class="status-badge ${escapeAttr(org.status)}">${escapeHtml(org.status)}</span>
              </div>
              <span>
                ${escapeHtml(org.category)} · ${formatMembers(org.members)} members · Owner: ${escapeHtml(
                  org.createdByEmail || org.createdByName || "UMD Student",
                )}
              </span>
              ${org.description ? `<p>${escapeHtml(org.description)}</p>` : ""}
              <div class="group-owner-bar">
                ${
                  org.status !== "approved"
                    ? `
                  <button
                    type="button"
                    class="chip-button approve-btn"
                    data-admin-action="approve-org"
                    data-org-id="${escapeAttr(org.id)}"
                    ${busyId === org.id ? "disabled" : ""}
                  >
                    ${icon("check", 14)} Approve
                  </button>
                `
                    : `
                  <button
                    type="button"
                    class="chip-button dark"
                    data-admin-action="post-event"
                    data-org-id="${escapeAttr(org.id)}"
                  >
                    ${icon("plus", 14)} Post event
                  </button>
                `
                }
                <button
                  type="button"
                  class="chip-button"
                  data-admin-action="edit-org"
                  data-org-id="${escapeAttr(org.id)}"
                >
                  ${icon("edit", 14)} Edit
                </button>
                <button
                  type="button"
                  class="chip-button danger"
                  data-admin-action="delete-org"
                  data-org-id="${escapeAttr(org.id)}"
                >
                  ${icon("trash", 14)} Delete
                </button>
              </div>
            </div>
          </article>
        `,
          )
          .join("")}
      </div>
    `;
  } else {
    html += `
      <div class="schedule-list">
        ${filteredEvents
          .map(
            (event) => `
          <article class="schedule-item">
            <div class="schedule-main">
              <div class="date-tile static">
                <strong>${dayNum(event.startsAt)}</strong>
                <span>${monthAbbr(event.startsAt)}</span>
              </div>
              <div class="schedule-info">
                <p class="card-org">
                  ${escapeHtml(event.org)} ${event.featured ? "· ★ FEATURED HERO" : ""}
                </p>
                <b>${escapeHtml(event.title)}</b>
                <div class="detail">
                  ${icon("clock", 15)} ${timeOf(event.startsAt)} · ${event.attendees} going
                </div>
                <div class="detail">
                  ${icon("pin", 15)} ${escapeHtml(event.location)}
                </div>
              </div>
              <img src="${escapeAttr(event.image)}" alt="" />
            </div>
            <div class="schedule-actions">
              <button
                class="chip-button dark"
                data-admin-action="edit-event"
                data-event-id="${escapeAttr(event.id)}"
              >
                ${icon("edit", 14)} Edit event
              </button>
              <button
                class="chip-button danger"
                data-admin-action="delete-event"
                data-event-id="${escapeAttr(event.id)}"
              >
                ${icon("trash", 14)} Delete
              </button>
            </div>
          </article>
        `,
          )
          .join("")}
      </div>
    `;
  }

  bodyEl.innerHTML = html;
}

function renderAdminPage() {
  if (!isAdminUser()) {
    navigate("/profile", { replace: true });
    return;
  }

  cleanupPageDropdowns();
  const outlet = document.getElementById("page-outlet");
  if (!outlet) return;

  const { data, tab, statusFilter, eventCatFilter } = state.admin;
  const pending = data?.pendingOrganizations || [];
  const allOrgs = data?.organizations || [];
  const allEvents = data?.events || [];
  const stats = data?.stats || {
    pendingOrgs: 0,
    approvedOrgs: 0,
    totalEvents: 0,
    totalUsers: 0,
  };

  outlet.innerHTML = `
    <main class="page">
      <section class="page-heading page-heading-row">
        <div>
          <p class="eyebrow">TERPLINK ADMIN PORTAL · ${escapeHtml(state.user.email.toUpperCase())}</p>
          <h1>Admin Dashboard</h1>
          <p>Approve student organization creation requests and manage all campus groups & events.</p>
        </div>
        <div class="heading-actions">
          <button class="action-pill" data-admin-action="new-group">
            ${icon("plus", 16)} New group
          </button>
          <button class="action-pill dark" data-admin-action="new-event">
            ${icon("plus", 16)} New event
          </button>
        </div>
      </section>

      <section class="profile-stats admin-stats">
        <div>
          <strong>${stats.pendingOrgs}</strong>
          <span>Pending Requests</span>
        </div>
        <div>
          <strong>${stats.approvedOrgs}</strong>
          <span>Approved Groups</span>
        </div>
        <div>
          <strong>${stats.totalEvents}</strong>
          <span>Campus Events</span>
        </div>
        <div>
          <strong>${stats.totalUsers}</strong>
          <span>UMD Users</span>
        </div>
      </section>

      <div class="admin-tab-bar">
        <div class="segmented" role="tablist">
          <button
            role="tab"
            data-tab="pending"
            aria-selected="${tab === "pending"}"
            class="${tab === "pending" ? "active" : ""}"
          >
            Pending Approvals <em>${pending.length}</em>
          </button>
          <button
            role="tab"
            data-tab="groups"
            aria-selected="${tab === "groups"}"
            class="${tab === "groups" ? "active" : ""}"
          >
            All Groups <em>${allOrgs.length}</em>
          </button>
          <button
            role="tab"
            data-tab="events"
            aria-selected="${tab === "events"}"
            class="${tab === "events" ? "active" : ""}"
          >
            All Events <em>${allEvents.length}</em>
          </button>
        </div>
        <span id="admin-filter-dd-slot"></span>
      </div>

      <div id="admin-body-container"></div>
    </main>
  `;

  const ddSlot = outlet.querySelector("#admin-filter-dd-slot");
  if (tab === "groups") {
    const statusDd = registerDropdown(
      createDropdown({
        variant: "pill",
        align: "right",
        value: statusFilter,
        onChange: (val) => {
          state.admin.statusFilter = val;
          renderAdminBody();
        },
        options: STATUS_FILTER_OPTIONS,
        ariaLabel: "Filter groups by approval status",
      }),
    );
    ddSlot.appendChild(statusDd);
  } else if (tab === "events") {
    const catDd = registerDropdown(
      createDropdown({
        variant: "pill",
        align: "right",
        value: eventCatFilter,
        onChange: (val) => {
          state.admin.eventCatFilter = val;
          renderAdminBody();
        },
        options: ADMIN_EVENT_CATEGORY_OPTIONS,
        ariaLabel: "Filter events by category",
      }),
    );
    ddSlot.appendChild(catDd);
  }

  outlet.querySelector(".segmented").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    state.admin.tab = btn.dataset.tab;
    renderAdminPage();
  });

  outlet.querySelector("main").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-admin-action]");
    if (!btn) return;
    const action = btn.dataset.adminAction;
    const findOrg = (id) =>
      (state.admin.data?.organizations || []).find((o) => o.id === id) ||
      state.organizations.find((o) => o.id === id);
    const findEvent = (id) =>
      (state.admin.data?.events || []).find((ev) => ev.id === id) ||
      state.events.find((ev) => ev.id === id);

    if (action === "new-group") {
      openGroupModal(null);
    } else if (action === "new-event") {
      openEventModal(null);
    } else if (action === "approve-org") {
      const org = findOrg(btn.dataset.orgId);
      if (!org) return;
      state.admin.busyId = org.id;
      renderAdminBody();
      try {
        await api.post(`/admin/organizations/${org.id}/approve`);
        notify(`Approved "${org.name}"`);
        await Promise.all([loadAdminOverview(), loadAppData()]);
      } catch (err) {
        notify(err?.message || "Could not approve group");
      } finally {
        state.admin.busyId = null;
        renderAdminBody();
      }
    } else if (action === "reject-org") {
      const org = findOrg(btn.dataset.orgId);
      if (!org) return;
      const reason = window.prompt(
        `Optional reason for rejecting "${org.name}":`,
        "Please add more details about your group’s mission and activities.",
      );
      if (reason === null) return;
      state.admin.busyId = org.id;
      renderAdminBody();
      try {
        await api.post(`/admin/organizations/${org.id}/reject`, { reason });
        notify(`Rejected "${org.name}"`);
        await Promise.all([loadAdminOverview(), loadAppData()]);
      } catch (err) {
        notify(err?.message || "Could not reject group");
      } finally {
        state.admin.busyId = null;
        renderAdminBody();
      }
    } else if (action === "edit-org") {
      const org = findOrg(btn.dataset.orgId);
      if (org) openGroupModal(org);
    } else if (action === "post-event") {
      openEventModal(null, btn.dataset.orgId);
    } else if (action === "delete-org") {
      const org = findOrg(btn.dataset.orgId);
      if (org) await deleteGroup(org);
    } else if (action === "edit-event") {
      const ev = findEvent(btn.dataset.eventId);
      if (ev) openEventModal(ev);
    } else if (action === "delete-event") {
      const ev = findEvent(btn.dataset.eventId);
      if (ev) await deleteEvent(ev);
    }
  });

  renderAdminBody();
}

// ============================================================================
// Route Synchronization & Boot
// ============================================================================
function refreshCurrentPage() {
  if (!shellMounted || state.status !== "authenticated") return;
  const pathname = getPathname();
  if (pathname === "/") renderHomePage();
  else if (pathname === "/discover") renderDiscoverPage();
  else if (pathname === "/calendar") renderCalendarPage();
  else if (pathname === "/groups") renderGroupsPage();
  else if (pathname === "/profile") renderProfilePage();
  else if (pathname === "/admin") renderAdminPage();
}

function syncApp() {
  ensureSplash();
  const ready = state.minElapsed && state.status !== "loading";
  if (!ready) return;

  const pathname = getPathname();

  if (state.status !== "authenticated") {
    if (pathname !== "/login") {
      state.returnTo = pathname;
      window.history.replaceState({}, "", "/login");
    }
    if (currentRoute !== "/login") {
      renderLoginScreen();
    }
    return;
  }

  // Authenticated
  if (pathname === "/login") {
    window.history.replaceState({}, "", "/");
  }
  const activePath = getPathname();
  if (activePath === "/admin" && !isAdminUser()) {
    window.history.replaceState({}, "", "/profile");
  }

  const finalPath = getPathname();
  ensureShellMounted();

  if (currentRoute !== finalPath) {
    currentRoute = finalPath;
    updateShellChrome();
    refreshCurrentPage();
    if (finalPath === "/admin" && isAdminUser()) {
      loadAdminOverview();
    }
  } else {
    updateShellChrome();
  }
}

async function boot() {
  appContainerEl = document.createElement("div");
  appContainerEl.id = "app-view";
  rootEl.innerHTML = "";
  rootEl.appendChild(appContainerEl);

  ensureSplash();

  window.setTimeout(() => {
    state.minElapsed = true;
    checkSplashTransition();
    syncApp();
  }, SPLASH_MIN_MS);

  const [cfg, me] = await Promise.allSettled([api.get("/auth/config"), api.get("/auth/me")]);
  if (cfg.status === "fulfilled" && cfg.value) {
    state.authConfig = cfg.value;
  } else {
    console.error("[auth] Failed to load /api/auth/config:", cfg.reason);
  }

  if (me.status === "fulfilled" && me.value?.user) {
    state.user = me.value.user;
    state.status = "authenticated";
    loadAppData();
  } else {
    state.status = "anonymous";
  }

  checkSplashTransition();
  syncApp();
}

let fadeScheduled = false;
function checkSplashTransition() {
  const ready = state.minElapsed && state.status !== "loading";
  if (!ready || fadeScheduled) return;
  fadeScheduled = true;
  ensureSplash();
  window.setTimeout(() => {
    state.splashGone = true;
    ensureSplash();
  }, SPLASH_FADE_MS);
}

boot();

