import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon.jsx";

function normalizeOptions(options = []) {
  return options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt,
  );
}

/**
 * Custom accessible, viewport-aware dropdown matching the TerpLink Figma design system.
 * Automatically flips/clamps horizontal and vertical placement so the menu never overflows the screen.
 */
export default function Dropdown({
  value,
  onChange,
  options = [],
  placeholder = "Select…",
  variant = "field", // "field" | "pill"
  align = "left", // preferred: "left" | "right"
  prefix = null,
  ariaLabel,
  disabled = false,
}) {
  const items = useMemo(() => normalizeOptions(options), [options]);
  const selected = useMemo(
    () => items.find((item) => item.value === value) || null,
    [items, value],
  );

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuStyle, setMenuStyle] = useState({});
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const listId = useId();

  // Compute collision-free placement whenever the menu opens or viewport resizes
  useLayoutEffect(() => {
    if (!open || !rootRef.current || !menuRef.current) return;

    const updatePosition = () => {
      if (!rootRef.current || !menuRef.current) return;
      const triggerRect = rootRef.current.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const margin = 12;

      const style = {
        maxWidth: `${Math.max(180, vw - margin * 2)}px`,
      };

      // Horizontal placement: start with preferred align, then clamp to viewport
      let leftOffset = align === "right" ? triggerRect.width - menuRect.width : 0;
      const projectedLeft = triggerRect.left + leftOffset;
      const projectedRight = projectedLeft + menuRect.width;

      if (projectedLeft < margin) {
        leftOffset += margin - projectedLeft;
      } else if (projectedRight > vw - margin) {
        leftOffset -= projectedRight - (vw - margin);
      }

      style.left = `${Math.round(leftOffset)}px`;
      style.right = "auto";

      // Vertical placement: flip upward if overflowing bottom and there is room above
      const spaceBelow = vh - triggerRect.bottom - margin;
      const spaceAbove = triggerRect.top - margin;
      if (menuRect.height > spaceBelow && spaceAbove > spaceBelow) {
        style.top = "auto";
        style.bottom = "calc(100% + 6px)";
        style.maxHeight = `${Math.max(140, Math.min(260, spaceAbove - 8))}px`;
      } else {
        style.top = "calc(100% + 6px)";
        style.bottom = "auto";
        style.maxHeight = `${Math.max(140, Math.min(260, spaceBelow - 8))}px`;
      }

      setMenuStyle(style);
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, align, items.length]);

  useEffect(() => {
    if (!open) return;
    const idx = items.findIndex((item) => item.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);

    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, items, value]);

  const selectAt = (idx) => {
    const item = items[idx];
    if (!item || item.disabled) return;
    onChange(item.value);
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % Math.max(1, items.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + Math.max(1, items.length)) % Math.max(1, items.length));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectAt(activeIndex);
    }
  };

  return (
    <div
      className={`tl-dropdown ${variant} ${open ? "is-open" : ""}`}
      ref={rootRef}
    >
      <button
        type="button"
        className="tl-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
      >
        <span className="tl-dropdown-value">
          {selected?.badgeColor && (
            <span className={`tl-dropdown-swatch ${selected.badgeColor}`}>
              {selected.badgeText || ""}
            </span>
          )}
          {selected?.dotColor && (
            <span
              className="tl-dropdown-dot"
              style={{ background: selected.dotColor }}
            />
          )}
          {prefix && <span className="tl-dropdown-prefix">{prefix}</span>}
          <span className="tl-dropdown-label">
            {selected ? selected.label : placeholder}
          </span>
          {selected?.sublabel && variant === "field" && (
            <small className="tl-dropdown-sub">{selected.sublabel}</small>
          )}
        </span>
        <span className="tl-dropdown-caret" aria-hidden="true">
          <Icon name="chevron" size={16} />
        </span>
      </button>

      {open && (
        <ul
          id={listId}
          ref={menuRef}
          role="listbox"
          className="tl-dropdown-menu"
          style={menuStyle}
          tabIndex={-1}
        >
          {items.map((item, idx) => {
            const isSelected = item.value === value;
            const isFocused = idx === activeIndex;
            return (
              <li
                key={String(item.value)}
                role="option"
                aria-selected={isSelected}
                className={`tl-dropdown-option ${isSelected ? "selected" : ""} ${
                  isFocused ? "focused" : ""
                }`}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectAt(idx);
                }}
              >
                {item.badgeColor && (
                  <span className={`tl-dropdown-swatch ${item.badgeColor}`}>
                    {item.badgeText || ""}
                  </span>
                )}
                {item.dotColor && (
                  <span
                    className="tl-dropdown-dot"
                    style={{ background: item.dotColor }}
                  />
                )}
                <span className="tl-dropdown-option-text">
                  <b>{item.label}</b>
                  {item.sublabel && <small>{item.sublabel}</small>}
                </span>
                {isSelected && (
                  <span className="tl-dropdown-check" aria-hidden="true">
                    <Icon name="check" size={15} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
