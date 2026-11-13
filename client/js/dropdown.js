import { icon } from "./icons.js";
import { escapeHtml, escapeAttr } from "./format.js";

let dropdownSeq = 0;

function normalizeOptions(options = []) {
  return options.map((opt) => (typeof opt === "string" ? { value: opt, label: opt } : opt));
}

/**
 * Custom accessible, viewport-aware dropdown matching the TerpLink Figma design system.
 * Automatically flips/clamps horizontal and vertical placement so the menu never overflows the screen.
 */
export function createDropdown({
  value,
  onChange,
  options = [],
  placeholder = "Select…",
  variant = "field", // "field" | "pill"
  align = "left", // "left" | "right"
  prefix = null,
  ariaLabel = "",
  disabled = false,
}) {
  let currentVal = value;
  let items = normalizeOptions(options);
  let open = false;
  let activeIndex = -1;
  const listId = `tl-dd-list-${++dropdownSeq}`;

  const root = document.createElement("div");
  root.className = `tl-dropdown ${variant}`;

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "tl-dropdown-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  if (ariaLabel) trigger.setAttribute("aria-label", ariaLabel);
  trigger.disabled = Boolean(disabled);

  root.appendChild(trigger);

  let menuEl = null;
  let cleanupListeners = null;

  function getSelected() {
    return items.find((item) => item.value === currentVal) || null;
  }

  function renderTrigger() {
    const selected = getSelected();
    let valHtml = "";
    if (selected?.badgeColor) {
      valHtml += `<span class="tl-dropdown-swatch ${escapeAttr(selected.badgeColor)}">${escapeHtml(
        selected.badgeText || "",
      )}</span>`;
    }
    if (selected?.dotColor) {
      valHtml += `<span class="tl-dropdown-dot" style="background: ${escapeAttr(selected.dotColor)}"></span>`;
    }
    if (prefix) {
      valHtml += `<span class="tl-dropdown-prefix">${escapeHtml(prefix)}</span>`;
    }
    valHtml += `<span class="tl-dropdown-label">${escapeHtml(
      selected ? selected.label : placeholder,
    )}</span>`;
    if (selected?.sublabel && variant === "field") {
      valHtml += `<small class="tl-dropdown-sub">${escapeHtml(selected.sublabel)}</small>`;
    }

    trigger.innerHTML = `
      <span class="tl-dropdown-value">${valHtml}</span>
      <span class="tl-dropdown-caret" aria-hidden="true">${icon("chevron", 16)}</span>
    `;
  }

  function updatePosition() {
    if (!open || !menuEl) return;
    const triggerRect = root.getBoundingClientRect();
    const menuRect = menuEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 12;

    menuEl.style.maxWidth = `${Math.max(180, vw - margin * 2)}px`;

    let leftOffset = align === "right" ? triggerRect.width - menuRect.width : 0;
    const projectedLeft = triggerRect.left + leftOffset;
    const projectedRight = projectedLeft + menuRect.width;

    if (projectedLeft < margin) {
      leftOffset += margin - projectedLeft;
    } else if (projectedRight > vw - margin) {
      leftOffset -= projectedRight - (vw - margin);
    }

    menuEl.style.left = `${Math.round(leftOffset)}px`;
    menuEl.style.right = "auto";

    const spaceBelow = vh - triggerRect.bottom - margin;
    const spaceAbove = triggerRect.top - margin;
    if (menuRect.height > spaceBelow && spaceAbove > spaceBelow) {
      menuEl.style.top = "auto";
      menuEl.style.bottom = "calc(100% + 6px)";
      menuEl.style.maxHeight = `${Math.max(140, Math.min(260, spaceAbove - 8))}px`;
    } else {
      menuEl.style.top = "calc(100% + 6px)";
      menuEl.style.bottom = "auto";
      menuEl.style.maxHeight = `${Math.max(140, Math.min(260, spaceBelow - 8))}px`;
    }
  }

  function renderMenuOptions() {
    if (!menuEl) return;
    menuEl.innerHTML = items
      .map((item, idx) => {
        const isSelected = item.value === currentVal;
        const isFocused = idx === activeIndex;
        let inner = "";
        if (item.badgeColor) {
          inner += `<span class="tl-dropdown-swatch ${escapeAttr(item.badgeColor)}">${escapeHtml(
            item.badgeText || "",
          )}</span>`;
        }
        if (item.dotColor) {
          inner += `<span class="tl-dropdown-dot" style="background: ${escapeAttr(item.dotColor)}"></span>`;
        }
        inner += `<span class="tl-dropdown-option-text"><b>${escapeHtml(item.label)}</b>${
          item.sublabel ? `<small>${escapeHtml(item.sublabel)}</small>` : ""
        }</span>`;
        if (isSelected) {
          inner += `<span class="tl-dropdown-check" aria-hidden="true">${icon("check", 15)}</span>`;
        }
        return `<li role="option" data-index="${idx}" aria-selected="${isSelected}" class="tl-dropdown-option ${
          isSelected ? "selected" : ""
        } ${isFocused ? "focused" : ""}">${inner}</li>`;
      })
      .join("");
  }

  function closeMenu() {
    if (!open) return;
    open = false;
    root.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    trigger.removeAttribute("aria-controls");
    if (menuEl) {
      menuEl.remove();
      menuEl = null;
    }
    if (cleanupListeners) {
      cleanupListeners();
      cleanupListeners = null;
    }
  }

  function selectAt(idx) {
    const item = items[idx];
    if (!item || item.disabled) return;
    currentVal = item.value;
    renderTrigger();
    closeMenu();
    if (onChange) onChange(item.value);
  }

  function openMenu() {
    if (open || trigger.disabled) return;
    open = true;
    root.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    trigger.setAttribute("aria-controls", listId);

    const idx = items.findIndex((item) => item.value === currentVal);
    activeIndex = idx >= 0 ? idx : 0;

    menuEl = document.createElement("ul");
    menuEl.id = listId;
    menuEl.setAttribute("role", "listbox");
    menuEl.className = "tl-dropdown-menu";
    menuEl.tabIndex = -1;

    renderMenuOptions();

    menuEl.addEventListener("mouseover", (e) => {
      const li = e.target.closest(".tl-dropdown-option");
      if (!li) return;
      const newIdx = Number(li.dataset.index);
      if (!Number.isNaN(newIdx) && newIdx !== activeIndex) {
        activeIndex = newIdx;
        menuEl.querySelectorAll(".tl-dropdown-option").forEach((el, i) => {
          el.classList.toggle("focused", i === activeIndex);
        });
      }
    });

    menuEl.addEventListener("mousedown", (e) => {
      const li = e.target.closest(".tl-dropdown-option");
      if (!li) return;
      e.preventDefault();
      selectAt(Number(li.dataset.index));
    });

    root.appendChild(menuEl);
    updatePosition();

    const onPointerDown = (e) => {
      if (!root.contains(e.target)) {
        closeMenu();
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeMenu();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    cleanupListeners = () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }

  trigger.addEventListener("click", () => {
    if (open) closeMenu();
    else openMenu();
  });

  trigger.addEventListener("keydown", (e) => {
    if (trigger.disabled) return;
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      openMenu();
      return;
    }
    if (!open) return;
    const len = Math.max(1, items.length);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % len;
      renderMenuOptions();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + len) % len;
      renderMenuOptions();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectAt(activeIndex);
    }
  });

  renderTrigger();

  root.setValue = (newVal) => {
    currentVal = newVal;
    renderTrigger();
    if (open) renderMenuOptions();
  };

  root.setOptions = (newOptions) => {
    items = normalizeOptions(newOptions);
    renderTrigger();
    if (open) {
      renderMenuOptions();
      updatePosition();
    }
  };

  root.getValue = () => currentVal;
  root.destroy = () => closeMenu();

  return root;
}

