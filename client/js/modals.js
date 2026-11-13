import { icon } from "./icons.js";
import { createDropdown } from "./dropdown.js";
import {
  shortDate,
  timeOf,
  timeRange,
  dayNum,
  monthAbbr,
  formatMembers,
  googleCalendarUrl,
  downloadICS,
  escapeHtml,
  escapeAttr,
  EVENT_CATEGORIES,
  ORG_CATEGORIES,
} from "./format.js";

const PRESET_IMAGES = [
  { label: "Outdoor Movie", url: "/images/movie-night.jpg" },
  { label: "Live Concert", url: "/images/terps-after-dark.jpg" },
  { label: "Career Mixer", url: "/images/career-mixer.jpg" },
  { label: "Campus Festival", url: "/images/featured-maryland-day.jpg" },
];

const COLORS = [
  { value: "red", label: "Maryland Red", sublabel: "Classic crimson badge", badgeColor: "red" },
  { value: "yellow", label: "Terp Gold", sublabel: "High-contrast gold badge", badgeColor: "yellow" },
  { value: "black", label: "Obsidian", sublabel: "Stealth dark badge", badgeColor: "black" },
];

/** Deterministic 6x6 pattern from the pass code (keeps the prototype's look). */
function qrCells(code) {
  const str = typeof code === "string" ? code : "";
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return Array.from({ length: 36 }, (_, i) => {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) + i;
    return (h >>> 7) % 3 !== 0;
  });
}

function toLocalInputValue(dateLike) {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  if (Number.isNaN(+d)) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

function defaultStartValue() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  d.setHours(18);
  return toLocalInputValue(d);
}

function campusMapsUrl(location) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${location}, University of Maryland, College Park, MD`,
  )}`;
}

function bindModalDismiss(backdropEl, onClose) {
  const onKey = (e) => {
    if (e.key === "Escape") onClose();
  };
  document.addEventListener("keydown", onKey);
  document.body.style.overflow = "hidden";

  backdropEl.addEventListener("mousedown", (e) => {
    if (e.target === backdropEl) onClose();
  });

  return () => {
    document.removeEventListener("keydown", onKey);
    document.body.style.overflow = "";
  };
}

// ============================================================================
// 1. Event Details & RSVP Modal
// ============================================================================
export function renderRsvpModal(container, { event, passCode, userName, onConfirm, onClose }) {
  container.innerHTML = "";
  let currentPassCode = passCode || null;
  let busy = false;
  let errorMsg = "";

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.setAttribute("role", "presentation");

  const dialog = document.createElement("div");
  dialog.className = "rsvp-modal";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", "Event Details and RSVP");
  dialog.tabIndex = -1;

  backdrop.appendChild(dialog);
  container.appendChild(backdrop);

  const cleanup = bindModalDismiss(backdrop, handleClose);

  function handleClose() {
    cleanup();
    container.innerHTML = "";
    if (onClose) onClose();
  }

  function renderContent() {
    const confirmed = Boolean(currentPassCode);
    if (!confirmed) {
      dialog.innerHTML = `
        <button class="modal-close" aria-label="Close">${icon("close")}</button>
        <div class="modal-icon">${icon("ticket", 27)}</div>
        <p class="eyebrow">EVENT DETAILS · ${escapeHtml((event.category || "CAMPUS").toUpperCase())}</p>
        <h2>Save your spot</h2>
        <div class="modal-event">
          <img src="${escapeAttr(event.image)}" alt="" />
          <div>
            <b>${escapeHtml(event.title)}</b>
            <span>Hosted by ${escapeHtml(event.org)}</span>
            <span>${shortDate(event.startsAt)} · ${timeRange(event.startsAt, event.endsAt)}</span>
            <span>${escapeHtml(event.location)}</span>
          </div>
        </div>
        ${
          event.description
            ? `<p class="modal-event-desc">${escapeHtml(event.description)}</p>`
            : ""
        }
        <div class="modal-event-meta-row">
          <span class="modal-meta-pill">
            ${icon("users", 14)}
            ${event.attendees || 0} going${event.capacity ? ` · ${event.capacity} cap` : ""}
          </span>
          ${
            event.note
              ? `<span class="modal-meta-pill highlight">${escapeHtml(event.note)}</span>`
              : ""
          }
          <a
            class="modal-meta-pill map-link"
            href="${escapeAttr(campusMapsUrl(event.location))}"
            target="_blank"
            rel="noopener noreferrer"
          >
            ${icon("pin", 14)} Campus map ${icon("arrow", 12)}
          </a>
        </div>
        <p class="modal-note">
          We’ll add this event to your TerpLink calendar, generate your digital QR pass, and remind you before it starts.
        </p>
        ${errorMsg ? `<p class="form-error" role="alert">${escapeHtml(errorMsg)}</p>` : ""}
        <button class="primary-button" id="rsvp-confirm-btn" ${busy ? "disabled" : ""}>
          ${busy ? "Confirming…" : "Confirm RSVP"} ${icon("arrow", 18)}
        </button>
      `;
      dialog.querySelector(".modal-close").addEventListener("click", handleClose);
      dialog.querySelector("#rsvp-confirm-btn").addEventListener("click", async () => {
        if (busy) return;
        busy = true;
        errorMsg = "";
        renderContent();
        try {
          const res = await onConfirm();
          if (res?.passCode) {
            currentPassCode = res.passCode;
            busy = false;
            renderContent();
          }
        } catch (err) {
          busy = false;
          errorMsg = err?.message || "Could not confirm RSVP";
          renderContent();
        }
      });
    } else {
      const cells = qrCells(currentPassCode);
      dialog.innerHTML = `
        <button class="modal-close" aria-label="Close">${icon("close")}</button>
        <div class="confirmation">
          <div class="success-check">${icon("check", 30)}</div>
          <p class="eyebrow">RSVP CONFIRMED</p>
          <h2>You’re on the list.</h2>
          <p>Your mobile pass is ready. Show it at the door when you arrive.</p>
          <div class="pass">
            <div class="fake-qr" aria-label="Pass code ${escapeAttr(currentPassCode)}">
              ${cells.map((dark) => `<i class="${dark ? "dark" : ""}"></i>`).join("")}
            </div>
            <div>
              <span>ADMIT ONE · ${escapeHtml(currentPassCode)}</span>
              <b>${escapeHtml(event.title)}</b>
              <small>${escapeHtml(userName)} · UMD Student</small>
            </div>
          </div>
          <div class="modal-cal-sync">
            <a
              class="chip-button"
              href="${escapeAttr(googleCalendarUrl(event))}"
              target="_blank"
              rel="noopener noreferrer"
            >
              ${icon("plus", 14)} Google Calendar
            </a>
            <button type="button" class="chip-button" id="rsvp-ics-btn">
              ${icon("calendar", 14)} Apple / .ics
            </button>
          </div>
          <button class="primary-button" id="rsvp-done-btn">Done</button>
        </div>
      `;
      dialog.querySelector(".modal-close").addEventListener("click", handleClose);
      dialog.querySelector("#rsvp-ics-btn").addEventListener("click", () => downloadICS(event));
      dialog.querySelector("#rsvp-done-btn").addEventListener("click", handleClose);
    }
  }

  renderContent();
  dialog.focus();
  return { close: handleClose };
}

// ============================================================================
// 2. Organization Profile & Lineup Modal
// ============================================================================
export function renderOrgDetailModal(
  container,
  { org, events = [], following = false, onToggleFollow, onSelectEvent, onClose },
) {
  container.innerHTML = "";
  let isFollowing = Boolean(following);
  let memberCount = org.members || 1;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.setAttribute("role", "presentation");

  const dialog = document.createElement("div");
  dialog.className = "rsvp-modal manage-modal";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", `${org.name} organization profile`);
  dialog.tabIndex = -1;

  backdrop.appendChild(dialog);
  container.appendChild(backdrop);

  const cleanup = bindModalDismiss(backdrop, handleClose);

  function handleClose() {
    cleanup();
    container.innerHTML = "";
    if (onClose) onClose();
  }

  const orgEvents = events.filter(
    (e) => e.organizationId === org.id || e.org.toLowerCase() === org.name.toLowerCase(),
  );

  function renderContent() {
    dialog.innerHTML = `
      <button class="modal-close" aria-label="Close">${icon("close")}</button>
      <div class="modal-preview-row">
        <span class="org-logo ${escapeAttr(org.color || "red")}">${escapeHtml(
          org.letter || "T",
        )}</span>
        <div>
          <p class="eyebrow">${escapeHtml(org.category.toUpperCase())} · ${formatMembers(
            memberCount,
          )} MEMBERS</p>
          <h2>${escapeHtml(org.name)}</h2>
        </div>
      </div>
      <p class="modal-event-desc">
        ${escapeHtml(
          org.description ||
            "Official student organization registered with the University of Maryland.",
        )}
      </p>
      <div class="modal-org-actions">
        <button
          type="button"
          class="primary-button ${isFollowing ? "secondary-dark" : ""}"
          id="org-modal-follow-btn"
        >
          ${isFollowing ? `${icon("check", 17)} Joined Organization` : `${icon("plus", 17)} Join Organization`}
        </button>
      </div>
      <div class="modal-org-events">
        <p class="eyebrow">UPCOMING LINEUP (${orgEvents.length})</p>
        ${
          orgEvents.length
            ? `<div class="schedule-list">
                ${orgEvents
                  .map(
                    (ev) => `
                  <article class="schedule-item compact-schedule-item" data-event-id="${escapeAttr(
                    ev.id,
                  )}">
                    <div class="schedule-main">
                      <div class="date-tile static">
                        <strong>${dayNum(ev.startsAt)}</strong>
                        <span>${monthAbbr(ev.startsAt)}</span>
                      </div>
                      <div class="schedule-info">
                        <b>${escapeHtml(ev.title)}</b>
                        <div class="detail">${icon("clock", 14)} ${timeOf(ev.startsAt)}</div>
                        <div class="detail">${icon("pin", 14)} ${escapeHtml(ev.location)}</div>
                      </div>
                      <button type="button" class="chip-button dark" data-open-event="${escapeAttr(
                        ev.id,
                      )}">
                        RSVP ${icon("arrow", 14)}
                      </button>
                    </div>
                  </article>
                `,
                  )
                  .join("")}
              </div>`
            : `<p class="modal-note">No upcoming events scheduled yet. Follow this group for announcements!</p>`
        }
      </div>
    `;

    dialog.querySelector(".modal-close").addEventListener("click", handleClose);
    dialog.querySelector("#org-modal-follow-btn").addEventListener("click", async () => {
      if (onToggleFollow) {
        await onToggleFollow(org);
        isFollowing = !isFollowing;
        memberCount = Math.max(0, memberCount + (isFollowing ? 1 : -1));
        renderContent();
      }
    });
    dialog.querySelectorAll("button[data-open-event]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ev = orgEvents.find((x) => x.id === btn.dataset.openEvent);
        handleClose();
        if (ev && onSelectEvent) onSelectEvent(ev);
      });
    });
  }

  renderContent();
  dialog.focus();
  return { close: handleClose };
}

// ============================================================================
// 3. Group Modal (Create / Edit Organization)
// ============================================================================
export function renderGroupModal(container, { initialGroup = null, onSubmit, onClose }) {
  container.innerHTML = "";
  const isEdit = Boolean(initialGroup);

  let name = initialGroup?.name || "";
  let category = initialGroup?.category || "Technology";
  let color = initialGroup?.color || "red";
  let description = initialGroup?.description || "";
  let busy = false;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.setAttribute("role", "presentation");

  const dialog = document.createElement("div");
  dialog.className = "rsvp-modal manage-modal";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", isEdit ? "Edit group" : "Create group");

  const previewLetter = () => (name.trim()[0] || "T").toUpperCase();
  const getColorOptions = () => COLORS.map((c) => ({ ...c, badgeText: previewLetter() }));

  dialog.innerHTML = `
    <button class="modal-close" aria-label="Close">${icon("close")}</button>

    <div class="modal-preview-row">
      <span class="org-logo ${escapeAttr(color)}" id="group-preview-logo">${escapeHtml(previewLetter())}</span>
      <div>
        <p class="eyebrow">${isEdit ? "MANAGE ORGANIZATION" : "NEW STUDENT ORGANIZATION"}</p>
        <h2>${isEdit ? "Edit group" : "Start a campus group"}</h2>
      </div>
    </div>

    ${
      !isEdit
        ? `
      <p class="modal-approval-banner">
        ${icon("shield", 15)}
        <span>
          New groups require approval from the App Admin (<b>jahnavi5@umd.edu</b>) before appearing in the public
          directory and hosting events.
        </span>
      </p>
    `
        : ""
    }

    <form class="manage-form" id="group-modal-form">
      <label class="form-field">
        <span>Organization name *</span>
        <input
          type="text"
          id="group-name-input"
          value="${escapeAttr(name)}"
          placeholder="e.g. Terp AI Society"
          minlength="2"
          maxlength="140"
          required
        />
      </label>

      <div class="form-row-2">
        <div class="form-field">
          <span>Category *</span>
          <div id="group-category-dd"></div>
        </div>

        <div class="form-field">
          <span>Badge style</span>
          <div id="group-color-dd"></div>
        </div>
      </div>

      <label class="form-field">
        <span>Mission & description</span>
        <textarea
          rows="3"
          id="group-desc-input"
          placeholder="Tell Terps what your organization is all about, when you meet, and who can join."
          maxlength="2000"
        >${escapeHtml(description)}</textarea>
      </label>

      <p class="form-error" id="group-form-error" role="alert" hidden></p>

      <button type="submit" class="primary-button" id="group-submit-btn">
        <span id="group-submit-label">${isEdit ? "Save changes" : "Submit group for approval"}</span>
        ${icon("arrow", 18)}
      </button>
    </form>
  `;

  backdrop.appendChild(dialog);
  container.appendChild(backdrop);

  const logoEl = dialog.querySelector("#group-preview-logo");
  const nameInput = dialog.querySelector("#group-name-input");
  const descInput = dialog.querySelector("#group-desc-input");
  const errorEl = dialog.querySelector("#group-form-error");
  const submitBtn = dialog.querySelector("#group-submit-btn");
  const submitLabel = dialog.querySelector("#group-submit-label");

  const categoryDd = createDropdown({
    value: category,
    onChange: (val) => {
      category = val;
    },
    options: ORG_CATEGORIES,
    ariaLabel: "Organization category",
  });
  dialog.querySelector("#group-category-dd").appendChild(categoryDd);

  const colorDd = createDropdown({
    value: color,
    onChange: (val) => {
      color = val;
      logoEl.className = `org-logo ${color}`;
    },
    options: getColorOptions(),
    ariaLabel: "Organization badge style",
  });
  dialog.querySelector("#group-color-dd").appendChild(colorDd);

  function updateSubmitState() {
    submitBtn.disabled = busy || name.trim().length < 2;
    submitLabel.textContent = busy
      ? "Saving…"
      : isEdit
        ? "Save changes"
        : "Submit group for approval";
  }

  nameInput.addEventListener("input", (e) => {
    name = e.target.value;
    logoEl.textContent = previewLetter();
    colorDd.setOptions(getColorOptions());
    updateSubmitState();
  });

  descInput.addEventListener("input", (e) => {
    description = e.target.value;
  });

  const cleanup = bindModalDismiss(backdrop, handleClose);

  function handleClose() {
    categoryDd.destroy();
    colorDd.destroy();
    cleanup();
    container.innerHTML = "";
    if (onClose) onClose();
  }

  dialog.querySelector(".modal-close").addEventListener("click", handleClose);

  dialog.querySelector("#group-modal-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy || name.trim().length < 2) return;
    busy = true;
    errorEl.hidden = true;
    errorEl.textContent = "";
    updateSubmitState();
    try {
      await onSubmit({
        name: name.trim(),
        category,
        color,
        description: description.trim(),
      });
      handleClose();
    } catch (err) {
      busy = false;
      errorEl.textContent = err?.message || "Could not save group";
      errorEl.hidden = false;
      updateSubmitState();
    }
  });

  updateSubmitState();
  nameInput.focus();
  return { close: handleClose };
}

// ============================================================================
// 4. Event Modal (Create / Edit Campus Event)
// ============================================================================
export function renderEventModal(
  container,
  { initialEvent = null, availableOrgs = [], defaultOrgId = "", isAdmin = false, onSubmit, onClose },
) {
  container.innerHTML = "";
  const isEdit = Boolean(initialEvent);

  let organizationId = initialEvent?.organizationId || defaultOrgId || availableOrgs[0]?.id || "";
  let title = initialEvent?.title || "";
  let category = initialEvent?.category || "Social";
  let startsAt = initialEvent?.startsAt ? toLocalInputValue(initialEvent.startsAt) : defaultStartValue();
  let endsAt = initialEvent?.endsAt ? toLocalInputValue(initialEvent.endsAt) : "";
  let location = initialEvent?.location || "";
  let note = initialEvent?.note || "";
  let capacity = initialEvent?.capacity ?? "";
  let image = initialEvent?.image || PRESET_IMAGES[0].url;
  let description = initialEvent?.description || "";
  let featured = Boolean(initialEvent?.featured);
  let busy = false;

  const orgOptions = availableOrgs.map((org) => ({
    value: org.id,
    label: org.name,
    sublabel: org.category,
    badgeColor: org.color || "red",
    badgeText: org.letter || org.name[0]?.toUpperCase() || "T",
  }));

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.setAttribute("role", "presentation");

  const dialog = document.createElement("div");
  dialog.className = "rsvp-modal manage-modal";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", isEdit ? "Edit event" : "Create event");

  dialog.innerHTML = `
    <button class="modal-close" aria-label="Close">${icon("close")}</button>

    <p class="eyebrow">${isEdit ? "MANAGE EVENT" : "PUBLISH CAMPUS EVENT"}</p>
    <h2>${isEdit ? "Edit event" : "Create an event"}</h2>

    <form class="manage-form" id="event-modal-form">
      <div class="form-field">
        <span>Host organization (approved) *</span>
        <div id="event-org-dd"></div>
      </div>

      <label class="form-field">
        <span>Event title *</span>
        <input
          type="text"
          id="event-title-input"
          value="${escapeAttr(title)}"
          placeholder="e.g. Fall Hack Night & Pizza"
          minlength="2"
          maxlength="140"
          required
        />
      </label>

      <div class="form-row-2">
        <div class="form-field">
          <span>Category *</span>
          <div id="event-category-dd"></div>
        </div>

        <label class="form-field">
          <span>Campus location *</span>
          <input
            type="text"
            id="event-location-input"
            value="${escapeAttr(location)}"
            placeholder="e.g. Iribe Center 0318"
            minlength="2"
            maxlength="140"
            required
          />
        </label>
      </div>

      <div class="form-row-2">
        <label class="form-field">
          <span>Starts at *</span>
          <input type="datetime-local" id="event-starts-input" value="${escapeAttr(startsAt)}" required />
        </label>

        <label class="form-field">
          <span>Ends at (optional)</span>
          <input type="datetime-local" id="event-ends-input" value="${escapeAttr(endsAt)}" />
        </label>
      </div>

      <div class="form-row-2">
        <label class="form-field">
          <span>Perk / highlight tag</span>
          <input
            type="text"
            id="event-note-input"
            value="${escapeAttr(note)}"
            placeholder="e.g. Free food, Free popcorn"
            maxlength="60"
          />
        </label>

        <label class="form-field">
          <span>Max capacity (optional)</span>
          <input
            type="number"
            id="event-capacity-input"
            min="1"
            max="50000"
            value="${escapeAttr(capacity)}"
            placeholder="Unlimited"
          />
        </label>
      </div>

      <div class="form-field">
        <span>Cover photo</span>
        <div class="image-preset-row" id="event-preset-row">
          ${PRESET_IMAGES.map(
            (preset) => `
            <button
              type="button"
              data-url="${escapeAttr(preset.url)}"
              class="image-preset ${image === preset.url ? "selected" : ""}"
            >
              <img src="${escapeAttr(preset.url)}" alt="${escapeAttr(preset.label)}" />
              <span>${escapeHtml(preset.label)}</span>
            </button>
          `,
          ).join("")}
        </div>
        <input
          type="text"
          id="event-image-input"
          value="${escapeAttr(image)}"
          placeholder="Or paste an https:// image URL"
          maxlength="500"
        />
      </div>

      <label class="form-field">
        <span>Event description</span>
        <textarea
          rows="3"
          id="event-desc-input"
          placeholder="Share event schedule, speakers, food details, or what students should bring."
          maxlength="4000"
        >${escapeHtml(description)}</textarea>
      </label>

      ${
        isAdmin
          ? `
        <label class="form-checkbox">
          <input type="checkbox" id="event-featured-input" ${featured ? "checked" : ""} />
          <span>Feature this event as the Home page hero banner</span>
        </label>
      `
          : ""
      }

      <p class="form-error" id="event-form-error" role="alert" hidden></p>

      <button type="submit" class="primary-button" id="event-submit-btn">
        <span id="event-submit-label">${isEdit ? "Save event changes" : "Publish event"}</span>
        ${icon("arrow", 18)}
      </button>
    </form>
  `;

  backdrop.appendChild(dialog);
  container.appendChild(backdrop);

  const orgDd = createDropdown({
    value: organizationId,
    onChange: (val) => {
      organizationId = val;
      updateSubmitState();
    },
    options: orgOptions,
    placeholder: "Select host organization",
    ariaLabel: "Host organization",
  });
  dialog.querySelector("#event-org-dd").appendChild(orgDd);

  const categoryDd = createDropdown({
    value: category,
    onChange: (val) => {
      category = val;
    },
    options: EVENT_CATEGORIES,
    ariaLabel: "Event category",
  });
  dialog.querySelector("#event-category-dd").appendChild(categoryDd);

  const titleInput = dialog.querySelector("#event-title-input");
  const locationInput = dialog.querySelector("#event-location-input");
  const startsInput = dialog.querySelector("#event-starts-input");
  const endsInput = dialog.querySelector("#event-ends-input");
  const noteInput = dialog.querySelector("#event-note-input");
  const capacityInput = dialog.querySelector("#event-capacity-input");
  const imageInput = dialog.querySelector("#event-image-input");
  const descInput = dialog.querySelector("#event-desc-input");
  const featuredInput = dialog.querySelector("#event-featured-input");
  const presetRow = dialog.querySelector("#event-preset-row");
  const errorEl = dialog.querySelector("#event-form-error");
  const submitBtn = dialog.querySelector("#event-submit-btn");
  const submitLabel = dialog.querySelector("#event-submit-label");

  function syncPresetHighlight() {
    presetRow.querySelectorAll(".image-preset").forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.url === image);
    });
  }

  function updateSubmitState() {
    submitBtn.disabled =
      busy || !organizationId || title.trim().length < 2 || location.trim().length < 2;
    submitLabel.textContent = busy
      ? "Saving…"
      : isEdit
        ? "Save event changes"
        : "Publish event";
  }

  titleInput.addEventListener("input", (e) => {
    title = e.target.value;
    updateSubmitState();
  });
  locationInput.addEventListener("input", (e) => {
    location = e.target.value;
    updateSubmitState();
  });
  startsInput.addEventListener("input", (e) => {
    startsAt = e.target.value;
  });
  endsInput.addEventListener("input", (e) => {
    endsAt = e.target.value;
  });
  noteInput.addEventListener("input", (e) => {
    note = e.target.value;
  });
  capacityInput.addEventListener("input", (e) => {
    capacity = e.target.value;
  });
  imageInput.addEventListener("input", (e) => {
    image = e.target.value;
    syncPresetHighlight();
  });
  descInput.addEventListener("input", (e) => {
    description = e.target.value;
  });
  if (featuredInput) {
    featuredInput.addEventListener("change", (e) => {
      featured = e.target.checked;
    });
  }

  presetRow.addEventListener("click", (e) => {
    const btn = e.target.closest(".image-preset");
    if (!btn) return;
    image = btn.dataset.url;
    imageInput.value = image;
    syncPresetHighlight();
  });

  const cleanup = bindModalDismiss(backdrop, handleClose);

  function handleClose() {
    orgDd.destroy();
    categoryDd.destroy();
    cleanup();
    container.innerHTML = "";
    if (onClose) onClose();
  }

  dialog.querySelector(".modal-close").addEventListener("click", handleClose);

  dialog.querySelector("#event-modal-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy || !organizationId || title.trim().length < 2 || location.trim().length < 2) return;
    busy = true;
    errorEl.hidden = true;
    errorEl.textContent = "";
    updateSubmitState();
    try {
      await onSubmit({
        organizationId,
        title: title.trim(),
        category,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        location: location.trim(),
        note: note.trim(),
        capacity: capacity === "" || capacity === null ? null : Number(capacity),
        image: image.trim() || PRESET_IMAGES[0].url,
        description: description.trim(),
        ...(isAdmin ? { featured } : {}),
      });
      handleClose();
    } catch (err) {
      busy = false;
      errorEl.textContent = err?.message || "Could not save event";
      errorEl.hidden = false;
      updateSubmitState();
    }
  });

  updateSubmitState();
  return { close: handleClose };
}

