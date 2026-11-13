# INST 630 Final Project Checkpoint Report
**Project Name:** TerpLink Mobile (*TerpEvents*)  
**Author:** Jahnavi Sharma (`jahnavi5@umd.edu`)  
**Course:** INST 630 — Introduction to Programming for the Web (Fall 2026)  
**Date:** November 13, 2026  

---

## 1. Project Overview

* **Application Name:** **TerpLink Mobile** (*TerpEvents*)
* **Purpose of the Application:** TerpLink Mobile is a responsive, mobile-first web application (`client_sim` paired with the Node.js/Express + MongoDB backend `server`) designed to reimagine and streamline how University of Maryland (UMD) students discover, filter, RSVP to, and manage campus events and student organizations on their phones.
* **Problem It Solves:** While UMD's official TerpLink portal serves as the central administrative directory for registered student organizations and campus programming, its legacy desktop-oriented interface is cumbersome to navigate on mobile screens. Students frequently miss out on club meetings, career mixers, cultural showcases, and free-food events because finding relevant activities requires clicking through cluttered menus and slow page reloads. TerpLink Mobile bridges this campus engagement gap by delivering a fast, social-media-inspired mobile event feed where exploring campus life is as effortless as scrolling on a phone.
* **Intended Users:**
  1. **UMD Undergraduate & Graduate Students (`@umd.edu` / `@terpmail.umd.edu`):** Students looking to discover upcoming campus events, filter by perks (such as free food) or interests, RSVP for instant digital admission passes, sync events to their personal calendars, and join student organizations.
  2. **Student Organization Leaders:** Club officers who create student groups, publish new campus events, manage event capacities, and update event details.
  3. **Campus Administrators (`jahnavi5@umd.edu`):** Platform administrators who review and approve or reject new student organization requests and oversee all published campus events.
* **Major Functionality Planned:**
  * **UMD Campus Google OAuth Authentication Gate:** Secure sign-in via Google Identity Services (`POST /api/auth/google`) verified on the backend server and restricted strictly to University of Maryland email domains (`@umd.edu` and `@terpmail.umd.edu`).
  * **Mobile-First Home & Discover Feed:** A dynamic landing page featuring a hero spotlight (*Maryland Day*), time-aware student greeting, mobile search bar, category filter pills (*For you*, *Today*, *Free food*, *Social*, *Career*, *Arts & Music*), snap-scrolling event cards on mobile viewports (`<= 640px`), and a fixed 5-tab bottom navigation bar.
  * **Interactive Search, Filtering & Sorting:** Real-time keyword search across event titles, host organizations, categories, and campus buildings, paired with custom accessible dropdowns for category filtering and sorting (*Soonest first*, *Most popular*, *Title A–Z*).
  * **Event Details & One-Tap RSVP with Digital QR Pass:** Detailed mobile bottom-sheet modal displaying event descriptions, host organization info, live attendance/capacity counters, a direct Google Maps campus building link, 1-tap RSVP registration (`POST /api/events/:id/rsvp`), and a deterministically generated **Admit One** digital QR code pass.
  * **External Calendar Integration:** One-click export of RSVP'd events to **Google Calendar** (via template deep links) and **Apple / Outlook Calendar** (via dynamically generated RFC 5545 `.ics` calendar files with a 1-hour reminder alarm).
  * **Student Organization Hub & Approval Workflow:** Searchable directory of UMD clubs with 1-tap *Join / Leave* toggles (`PUT/DELETE /api/organizations/:id/follow`), organization profile modals showing upcoming event lineups, and forms to request new groups or publish events subject to administrator approval.
  * **Personal Schedule & Profile Preferences:** Dedicated *My Calendar* page (*Going* and *Saved* tabs) and a *Profile & Settings* screen where students view their live RSVP/Saved/Group statistics and customize favorite campus categories and notification preferences.

---

## 2. Progress Since the Proposal

Since submitting the initial project proposal, all core frontend (`client_sim`) and backend API integration (`server`) milestones have been completed:

1. **All Core Mobile Pages & Bottom-Sheet Modals Created:**
   * Implemented the animated **Splash Screen**, **UMD Google Sign-In Screen (`/login`)**, **Mobile Home Feed (`/`)**, **Explore / Discover Directory (`/discover`)**, **My Calendar / Schedule Dashboard (`/calendar`)**, **Student Organizations Hub (`/groups`)**, **User Profile & Preferences (`/profile`)**, and **Admin Dashboard (`/admin`)**.
   * Built four interactive mobile-ready modal dialogs in `client_sim/js/modals.js`: **Event Details & RSVP QR Pass Modal**, **Organization Profile & Event Lineup Modal**, **Create / Edit Student Group Modal**, and **Create / Edit Campus Event Modal**.
2. **Semantic HTML5 Structure & Mobile App Shell Completed:**
   * Constructed `client_sim/index.html` and the dynamic SPA shell in `client_sim/js/main.js` using semantic landmarks (`<header class="topbar">`, `<main>`, `<section>`, `<article class="event-card">`, and `<nav class="mobile-nav">`) with ARIA attributes (`role="dialog"`, `role="tablist"`, `aria-selected`, `aria-expanded`, `aria-live`).
3. **Complete CSS Design System & Responsive Mobile-First Layout Implemented:**
   * Authored modular CSS across `css/reset.css` (modern CSS preflight reset), `css/index.css` (core Figma Make design tokens, typography, hero banner, event cards, and mobile breakpoints), and `css/app.css` (splash animations, login layout, custom dropdowns, schedule cards, admin portal, and preference toggles).
   * Designed specifically for mobile viewports (`390×844` / `<= 640px`), featuring a touch-friendly horizontal scroll-snap event carousel (`scroll-snap-type: x mandatory`), mobile bottom sheets (`align-items: flex-end`), and a fixed 5-tab bottom navigation bar (`Home`, `Discover`, `Calendar`, `Groups`, `Profile`).
4. **JavaScript Interactive Functionality & Live Backend Server Integration Completed:**
   * Connected `client_sim/js/api.js` and `client_sim/dev-server.js` (proxying `/api` to `http://localhost:5000/api`) to the working Express + MongoDB backend server (`server/`).
   * Integrated live endpoints for authentication (`/api/auth/config`, `/api/auth/google`, `/api/auth/me`, `/api/auth/logout`, `/api/auth/logout-all`), events (`/api/events`, `/api/events/:id/rsvp`, `/api/events/:id/save`), student organizations (`/api/organizations`, `/api/organizations/:id/follow`), and admin moderation (`/api/admin/overview`, `/api/admin/organizations/:id/approve`, `/api/admin/organizations/:id/reject`).
5. **Interactive Forms & Validation Completed:**
   * Integrated the **Google Identity Services Sign-In Flow** on `/login` (with backend verification of `@umd.edu` and `@terpmail.umd.edu` domains), the **Create/Edit Group Form**, and the **Create/Edit Event Form** (with cover photo presets, date/time validation, capacity bounds, and host organization selection).
6. **External APIs & Calendar Syncing Integrated:**
   * Implemented `googleCalendarUrl()` and `downloadICS()` in `client_sim/js/format.js` plus Google Maps building directions links in `client_sim/js/modals.js`.
7. **GitHub Repository Established:**
   * Version control initialized and pushed to GitHub (`https://github.com/jahnavi5-umd/INST630-FinalProject`) with static bundle build scripts (`client_sim/build.js`) and Vercel API proxy rewrites (`client_sim/vercel.json`).

---

## 3. Current Application Structure

The table below summarizes all pages and major features in `client_sim` (backed by `server`) and their current status:

| Page / Feature | Route / Component | Purpose | Status |
| :--- | :--- | :--- | :--- |
| **Animated Splash Screen** | `ensureSplash()` (`main.js`) | Displays animated UMD TerpLink brand mark while verifying `/api/auth/config` and `/api/auth/me` | **Complete** |
| **UMD Google Login Screen** | `/login` (`main.js`) | Authenticates UMD students (`@umd.edu` / `@terpmail.umd.edu`) via Google OAuth and `/api/auth/google` | **Complete** |
| **Mobile Home Feed** | `/` (`main.js`) | Showcases time-based greeting, mobile search bar, *Maryland Day* hero card, *Picked For You* category pills, snap-scroll event cards, and club spotlight | **Complete** |
| **Explore / Search Page** | `/discover` (`main.js`) | Full-catalog keyword search, category filter dropdown, sort menu, and 10 horizontal category filter pills | **Complete** |
| **Event Details & RSVP Pass** | `renderRsvpModal()` (`modals.js`) | Displays event description, host org, capacity counter, campus map link, 1-tap server RSVP (`POST /api/events/:id/rsvp`), and digital QR pass | **Complete** |
| **My Calendar / Schedule** | `/calendar` (`main.js`) | Organizes user's *Going* (RSVP'd) and *Saved* (bookmarked) events with QR pass viewer, Google Calendar link, and `.ics` download | **Complete** |
| **Organizations Directory** | `/groups` (`main.js`, `modals.js`) | Searchable UMD club directory with *Join/Joined* toggle, club profile modal with event lineup, and *My Groups & Events* tab | **Complete** |
| **Create Group & Event Forms** | `renderGroupModal()`, `renderEventModal()` | Validated modal forms for requesting new student groups (`POST /api/organizations`) and publishing/editing campus events (`POST /api/events`) | **Complete** |
| **Profile & Settings Page** | `/profile` (`main.js`) | Displays verified UMD student badge, live Going/Saved/Group stats from server, favorite category pills, notification toggles, and session sign-out | **Complete** |
| **Admin Approval Portal** | `/admin` (`main.js`) | Allows admin (`jahnavi5@umd.edu`) to approve or reject pending student group requests and manage all campus events via `/api/admin/*` | **Complete** |
| **Multi-Device Polish & Final QA** | All views (`css/app.css`) | Final accessibility audit, additional campus seed events, and end-to-end mobile usability walkthrough | **In Progress** |

---

## 4. Design / Mockups

All screenshots below were captured in **mobile view (`390×844` iPhone viewport)** from the running `client_sim` application connected to the live Express + MongoDB backend server (`server`). The UI translates the **TerpLink Mobile** Figma Make design system into semantic HTML, CSS, and Vanilla JavaScript using UMD's color palette (`--red: #e21833`, `--ink: #171615`, Terp Gold `#ffcf15`, warm paper `#f7f6f2`) and geometric typography (`Manrope` and `DM Sans`).

### Screenshot 1: Mobile Home Page — Hero Spotlight & Picked For You Event Feed (`/`)
![Mobile Home Page - Hero Spotlight](./client_sim/screenshots/screenshot-home.png)

![Mobile Home Page - Picked For You Feed](./client_sim/screenshots/screenshot-mobile.png)

*Figure 1 (Top): Mobile Home view (`390×844`) showing the top header, personalized student greeting ("Good morning, Jahnavi."), mobile search input, Featured on Campus hero card ("Maryland Day"), and fixed 5-tab bottom navigation bar. Figure 2 (Bottom): Scrolled Mobile Home view showing the "Picked For You" category pills, sort dropdown, and snap-scrolling event cards ("Spring Outdoor Movie Night") loaded from the backend server.*

---

### Screenshot 2: Mobile Login Screen (`/login`) & Discover Events Page (`/discover`)
![Mobile UMD Google Login Screen](./client_sim/screenshots/screenshot-login.png)

![Mobile Discover Events Page](./client_sim/screenshots/screenshot-discover.png)

*Figure 3 (Top): Mobile Login screen (`/login`) featuring the UMD concert hero banner, "Sign in to TerpLink" bottom sheet, live Google Identity Services button ("Continue with Google"), and `@umd.edu` / `@terpmail.umd.edu` domain restriction notice. Figure 4 (Bottom): Mobile Discover page (`/discover`) filtered by the "Free food" category pill, showing live server results and the "+ Create event" action button.*

---

### Screenshot 3: Mobile Interactive Features — One-Tap RSVP Digital QR Pass & Create Event Modal
![Mobile One-Tap RSVP Digital QR Pass](./client_sim/screenshots/screenshot-rsvp-pass.png)

![Mobile Create Campus Event Form Modal](./client_sim/screenshots/screenshot-create-event.png)

*Figure 5 (Top): Mobile bottom-sheet RSVP confirmation modal displaying the server-issued `ADMIT ONE` digital QR pass (`W3_DCF-23ZVV`) alongside 1-tap Google Calendar and Apple `.ics` export buttons. Figure 6 (Bottom): Mobile "Create an event" form modal (`renderEventModal`) with custom host organization and category dropdowns, date-time pickers, location input, and cover photo presets.*

---

### Screenshot 4: Mobile Student Organizations Hub (`/groups`) & My Calendar (`/calendar`)
![Mobile Student Organizations Hub](./client_sim/screenshots/screenshot-groups.png)

![Mobile My Calendar Page](./client_sim/screenshots/screenshot-calendar.png)

*Figure 7 (Top): Mobile Student Organizations Hub (`/groups`) showing the "Campus Directory" and "My Groups & Events" segmented tabs, organization search & filters, and club cards with live member counts and 1-tap Join/Joined toggles. Figure 8 (Bottom): Mobile My Calendar page (`/calendar`) displaying the user's RSVP'd events with 1-tap Pass viewing, Google Calendar sync, and `.ics` download.*

---

## 5. JavaScript / Interactive Functionality

TerpLink Mobile (`client_sim`) implements five major interactive JavaScript features powered by modular ES6 scripts (`main.js`, `api.js`, `modals.js`, `dropdown.js`, and `format.js`) communicating with the Express + MongoDB backend (`server`):

### Feature 1: Real-Time Event Search, Category Filtering & Multi-Mode Sorting
* **User Action:** On mobile, the user types a keyword (e.g., `"pizza"`, `"career"`, `"Stamp"`, or `"SEE"`) into the mobile search bar, taps a category pill (*For you*, *Today*, *Free food*, *Social*, *Career*, *Arts & Music*, *Academic*, *Cultural*, *Sports*, *Technology*), or selects a sort order (*Soonest first*, *Most popular*, *Title A–Z*) from the custom pill dropdown.
* **JavaScript Behavior:** Input and click listeners update `state.search`, `state.discover.activeCategory`, and `state.discover.sortBy`, synchronizing all search inputs across the DOM (`syncSearchInputs()`). The script invokes `filterEvents()` and `sortEvents()` in `js/format.js`—which match the query against `title`, `org`, `category`, and `location`, evaluate special predicates such as `"Free food"` (checking if `event.note` contains `"free"`) and `"Today"` (comparing `Intl.DateTimeFormat` dates in `America/New_York`), sort the filtered array, update the live result counter (`"3 events"`), and dynamically re-render the `.event-grid` without reloading the page.

### Feature 2: One-Tap Event RSVP & Deterministic Digital QR Pass Generator
* **User Action:** The user taps an event card's **RSVP →** button to open the mobile Event Details bottom sheet, reviews the description, capacity counter, and campus map link, and taps **Confirm RSVP**.
* **JavaScript Behavior:** `openRsvp()` mounts `renderRsvpModal()` (`js/modals.js`). When the user taps **Confirm RSVP**, `api.post('/events/:id/rsvp')` sends an authenticated `POST` request to the Express server (`server/src/routes/events.js`). The server atomically increments `attendees` in MongoDB (verifying `attendees < capacity`), generates a cryptographic `base64url` pass code (`crypto.randomBytes(9)`), saves the RSVP to the `User` document, and returns the updated user, event, and `passCode`. On the client, `qrCells(passCode)` hashes the pass code into a deterministic 6×6 bit matrix to render the visual QR pass alongside 1-tap calendar export buttons.

### Feature 3: UMD Google OAuth Sign-In & Server-Verified Domain Gate
* **User Action:** On `/login`, the user taps **Continue with Google** and selects their University of Maryland Google account (`@umd.edu` or `@terpmail.umd.edu`).
* **JavaScript Behavior:** On boot, `main.js` fetches `GET /api/auth/config` to obtain the server's `googleClientId` and `allowedDomain`, then initializes Google Identity Services (`window.google.accounts.id.renderButton`). When the Google popup returns a signed ID token credential, `onGoogleCredential()` posts `{ credential }` to `POST /api/auth/google`. The backend (`server/src/routes/auth.js`) verifies the token signature and audience using `google-auth-library` (`googleClient.verifyIdToken`), enforces `isAllowedEmail(payload.email)` (`@umd.edu` or `*.umd.edu`), upserts the `User` in MongoDB, issues a signed `HS256` JWT in both an `httpOnly` cookie and response token (`setSessionToken(token)`), and navigates the user to `/`.

### Feature 4: Student Group & Event Publishing Forms with Admin Approval Workflow
* **User Action:** A user taps **+ Create group** or **+ Create event** on `/discover` or `/groups`, completes the mobile bottom-sheet form fields, and submits. An administrator (`jahnavi5@umd.edu`) then opens `/admin` and taps **Approve group** or **Reject**.
* **JavaScript Behavior:** `renderGroupModal()` and `renderEventModal()` validate input lengths (`minlength="2"`, valid start/end timestamps, and positive integer capacities) in real time, enabling the submit button only when all constraints are satisfied. Submitting a new group sends `POST /api/organizations` to the server, creating the organization in MongoDB with `status: "pending"`. When the admin taps **Approve group** on `/admin`, `api.post('/admin/organizations/:id/approve')` updates the MongoDB document to `status: "approved"`, immediately making it visible in the public directory and eligible to host campus events.

### Feature 5: External Calendar Syncing (Google Calendar Deep Links & `.ics` File Download)
* **User Action:** Inside the confirmed RSVP pass sheet or on the `/calendar` page (*Going* tab), the user taps **+ Google Calendar** or **Apple / .ics**.
* **JavaScript Behavior:** `googleCalendarUrl(event)` formats the start and end timestamps into UTC ISO basic format (`YYYYMMDDTHHMMSSZ`) and opens a parameterized `https://calendar.google.com/calendar/render?action=TEMPLATE` URL with the event title, host organization, and College Park location. Tapping **Apple / .ics** invokes `downloadICS(event)`, which dynamically builds an RFC 5545 `VCALENDAR` / `VEVENT` file with a 1-hour `VALARM` reminder (`-PT1H`), wraps it in a `Blob` (`text/calendar`), and triggers a download via `URL.createObjectURL()`.

---

## 6. Technical Components

The project uses the following technologies across `client_sim` and `server`:

* **HTML5 (`client_sim/index.html` & template literals):** Provides the semantic document structure, mobile viewport configuration (`width=device-width, initial-scale=1.0, viewport-fit=cover`), accessibility landmarks, and form inputs.
* **CSS3 (`css/reset.css`, `css/index.css`, `css/app.css`):** Implements the mobile-first visual design system using CSS Custom Properties (`--red`, `--ink`, `--muted`, `--line`, `--paper`), CSS Grid/Flexbox, scroll-snap carousels, `backdrop-filter` glassmorphism, and responsive media queries (`<= 900px` and `<= 640px`).
* **Vanilla JavaScript / ES6 Modules (`js/main.js`, `js/api.js`, `js/modals.js`, `js/dropdown.js`, `js/format.js`, `js/icons.js`):** Powers client-side SPA routing, state management, DOM rendering, event delegation, form validation, and modal lifecycles with zero frontend framework overhead.
* **Node.js, Express & MongoDB / Mongoose REST API (`server/`):** Powers the backend API (`http://localhost:5000/api`) used for authentication, user sessions (`JWT` + `httpOnly` cookies), event CRUD, atomic RSVP capacity enforcement, organization directory management, and admin approvals.
* **JSON:** Used as the data exchange format for all REST API requests and responses between `client_sim` (`js/api.js`) and the Express backend (`server`), as well as for persisting user personalization preferences.
* **Google Identity Services API & External Calendar/Maps APIs:**
  * **Google Identity Services (`https://accounts.google.com/gsi/client` + `google-auth-library`):** Provides secure 1-tap campus Google Sign-In verified on the server.
  * **iCalendar (`.ics`) & Google Calendar URL APIs:** Enable 1-tap calendar exporting across iOS, Android, macOS, and Windows.
  * **Google Maps Search URLs:** Link every event's campus building directly to interactive College Park walking directions.
* **Web Storage API (`sessionStorage` & `localStorage`):** `sessionStorage` (`tl_session_token`) provides a Bearer token fallback alongside the server's `httpOnly` session cookie, while `localStorage` (`tl_user_prefs_<userId>`) stores per-user category and notification preferences.
* **Git, GitHub & Vercel (`build.js`, `dev-server.js`, `vercel.json`):** Git and GitHub provide version control, while `dev-server.js` (local `/api` proxy to `:5000`) and `vercel.json` (production `/api/*` edge rewrite) connect the static frontend to the backend API.

---

## 7. Challenges / Problems

### Challenge 1: Cross-Origin Cookie & Popup Security Between `client_sim` and the Express Server
* **What was the problem?** Google Identity Services popup sign-in requires the `Cross-Origin-Opener-Policy: same-origin-allow-popups` HTTP header so the Google popup window can `postMessage` the ID token credential back to `/login`. Additionally, modern browsers can block cross-origin cookies when the frontend and backend run on different origins or ports.
* **What did you try?** In `client_sim/dev-server.js` and `client_sim/vercel.json`, we configured `Cross-Origin-Opener-Policy: same-origin-allow-popups` and set up a same-origin `/api` proxy rewrite to `http://localhost:5000/api` (and `https://terplink-backend.vercel.app/api/$1` in production). We also implemented a dual session mechanism in `client_sim/js/api.js` and `server/src/middleware/auth.js` that supports both `httpOnly` cookies and `Authorization: Bearer <token>` headers stored in `sessionStorage`, alongside the `X-Requested-With: XMLHttpRequest` CSRF header required by `server/src/middleware/security.js`.
* **Did you solve it?** **Yes.** Google Sign-In and authenticated API requests work reliably both in local development (`:5173` -> `:5000`) and on Vercel.

### Challenge 2: Custom Dropdown Menus Overflowing Narrow Mobile Viewports (`390px`)
* **What was the problem?** Native `<select>` elements could not render custom organization color badges (`Maryland Red`, `Terp Gold`, `Obsidian`) or status indicator dots. However, custom dropdown menus initially clipped off the right or bottom edge of `390px`-wide mobile screens.
* **What did you try?** In `client_sim/js/dropdown.js`, we implemented `updatePosition()` using `getBoundingClientRect()` to measure available viewport width and height above and below the trigger button, clamping horizontal offsets within a `12px` screen margin and automatically flipping the menu upward when bottom space is tight.
* **Did you solve it?** **Yes.** All filter and form dropdowns stay cleanly within mobile viewport bounds and support full keyboard and touch interaction.

### Challenge 3: Synchronizing Search Inputs & Maintaining Input Focus Across Route Transitions
* **What was the problem?** TerpLink includes search inputs on both the Home and Discover mobile views (as well as the header search bar). Typing a search query needed to filter events in real time without re-mounting the active `<input>` element and losing the mobile on-screen keyboard focus.
* **What did you try?** We separated the static search bar markup in `renderHomePage()` and `renderDiscoverPage()` from the dynamic results containers (`#home-feed-container` and `#discover-results-container`), updating only the results DOM on `input` events and syncing values via `syncSearchInputs()`.
* **Did you solve it?** **Yes.** Mobile users can type continuously with smooth real-time filtering and zero keyboard focus loss.

### Challenge 4: Mobile Bottom-Sheet Ergonomics & Scroll-Snap Event Feed
* **What was the problem?** On mobile screens (`390×844`), stacking large event cards vertically on the Home page required excessive scrolling before reaching the Student Organizations section, and centered desktop modals were harder to reach with one thumb.
* **What did you try?** In `css/index.css` and `css/app.css` under `@media (max-width: 640px)`, we styled `.event-grid` on the Home feed as a horizontal `scroll-snap-type: x mandatory` carousel (`grid-auto-columns: 82%`) while keeping `.event-grid.event-list` on `/discover` as a vertical 1-column stack, and anchored `.modal-backdrop` to `align-items: flex-end` so all modals slide up as native-feeling mobile bottom sheets.
* **Did you solve it?** **Yes.** Both the horizontal Home carousel and bottom-sheet modals work smoothly on mobile viewports.

---

## 8. Remaining Work

Although all core pages, backend API integrations, and interactive features are working in `client_sim` + `server`, the following tasks are scheduled prior to final project submission:

| Remaining Task | Description | Target Completion |
| :--- | :--- | :--- |
| **Expand MongoDB Seed Dataset** | Add 8–10 additional realistic UMD events across *Academic*, *Cultural*, *Sports*, and *Technology* categories in `server/src/seed/data.js` | Nov. 15, 2026 |
| **Enhanced Form Validation Feedback** | Add inline field-level helper text and live character counters on the *Create Event* and *Create Group* mobile bottom-sheet forms | Nov. 16, 2026 |
| **Mobile Touch & Device Testing** | Test horizontal snap-scrolling, bottom sheet modals, and safe-area insets across physical iOS Safari and Android Chrome devices | Nov. 18, 2026 |
| **Accessibility (WCAG 2.1 AA) Audit** | Run Lighthouse & WAVE mobile audits; verify focus trapping inside modals, `aria-live` announcements, and touch target sizes (`>= 44×44px`) | Nov. 20, 2026 |
| **Final Production Deployment & QA** | Final end-to-end testing of the deployed `client_sim` frontend and `server` backend on Vercel | Nov. 22, 2026 |

---

## 9. Testing Status

Testing has actively begun in mobile viewports (`390×844` and `375×812`) against the live Express + MongoDB backend server (`http://localhost:5000`):

| Test Area | What Was Tested | Result / Status |
| :--- | :--- | :--- |
| **Navigation & Routing** | Tested all 5 mobile bottom navigation tabs (`Home`, `Discover`, `Calendar`, `Groups`, `Profile`), Admin portal navigation (`/admin`), brand logo link, and browser Back/Forward buttons (`popstate`). | **Passed** — All routes transition cleanly without full-page reloads. |
| **Server Auth & Forms** | Tested Google Sign-In (`/api/auth/config` & `/api/auth/google`), `@umd.edu` domain verification, Create Group form (`POST /api/organizations`), and Create Event form (`POST /api/events` with date/time and capacity checks). | **Passed** — Server validates all payloads, blocks unauthorized domains/inputs, and persists records in MongoDB. |
| **JavaScript Interactivity** | Tested live search, category pills (`Free food`, `Today`, etc.), sort dropdowns, 1-tap bookmarking (`PUT/DELETE /api/events/:id/save`), RSVP confirmation & QR pass generation (`POST /api/events/:id/rsvp`), Google Calendar link, `.ics` download, and Join/Leave club toggle. | **Passed** — All mutations update MongoDB and immediately refresh mobile UI counters. |
| **Broken Links & Assets** | Verified all local event images (`/images/*.jpg`), `favicon.svg`, `manifest.webmanifest`, `/api/*` proxy routes, Google Calendar links, and Google Maps building links. | **Passed** — Zero `404` or `502` errors. |
| **Responsive / Mobile Layout** | Tested across mobile viewports (`390×844` iPhone 14/15 Pro and `375×812` iPhone Mini) in Chrome DevTools Device Mode. | **Passed** — Mobile header, horizontal snap cards, bottom-sheet modals, and fixed 5-tab bottom navigation render cleanly without horizontal overflow. |
| **Chrome & Edge Compatibility** | Tested application rendering, ES6 modules, `/api` fetch calls, and `.ics` Blob downloads in Google Chrome and Microsoft Edge on Windows. | **Passed** — Identical layout and interactive behavior across both browsers. |
| **Accessibility Basics** | Verified semantic landmarks, `aria-label` on icon buttons, `Escape` key dismissal on modals/dropdowns, `:focus-visible` outlines (`2px solid var(--red)`), and `role="alert"` on error banners. | **Passed (Initial)** — Core mobile and keyboard accessibility verified; full audit scheduled for Nov. 20. |
| **Invalid / Unexpected Input** | Tested empty whitespace strings in search/forms, non-UMD email addresses (`403 Forbidden`), negative/non-integer capacities (`400 Bad Request`), NoSQL operator sanitization (`express-mongo-sanitize`), and HTML special characters (`escapeHtml()`). | **Passed** — Validated on both client (`client_sim`) and server (`server`). |

---

## 10. Current Working Version

* **GitHub Repository URL:** [https://github.com/jahnavi5-umd/INST630-FinalProject](https://github.com/jahnavi5-umd/INST630-FinalProject)
* **Backend API Server URL:** `http://localhost:5000` (Deployed on Vercel at [https://terplink-backend.vercel.app](https://terplink-backend.vercel.app))
* **Client Application (`client_sim`) URL:** `http://localhost:5173` (Proxies `/api/*` to the backend server; deployable to Vercel via `client_sim/vercel.json`)
