// Icon set copied 1:1 from the TerpLink Figma Make file (+ action icons in identical stroke style).
const iconPaths = {
  home: `<path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" />`,
  compass: `<circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z" />`,
  calendar: `<rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" />`,
  users: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />`,
  user: `<circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />`,
  search: `<circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />`,
  bell: `<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" />`,
  bookmark: `<path d="M6 3h12v18l-6-4-6 4V3Z" />`,
  clock: `<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />`,
  pin: `<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" />`,
  arrow: `<path d="M5 12h14" /><path d="m14 7 5 5-5 5" />`,
  check: `<path d="m5 12 4 4L19 6" />`,
  close: `<path d="m6 6 12 12M18 6 6 18" />`,
  ticket: `<path d="M2 9a3 3 0 0 0 0 6v3h20v-3a3 3 0 0 0 0-6V6H2v3Z" /><path d="M13 6v12" />`,
  chevron: `<path d="m9 18 6-6-6-6" />`,
  logout: `<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" /><path d="m10 17 5-5-5-5M15 12H3" />`,
  plus: `<path d="M12 5v14M5 12h14" />`,
  shield: `<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />`,
  edit: `<path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />`,
  trash: `<path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" />`,
};

export function icon(name, size = 20, filled = false) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${
    filled ? "currentColor" : "none"
  }" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
    iconPaths[name] || ""
  }</svg>`;
}

export function terpMark(className = "") {
  const cls = className ? `brand-mark ${className}` : "brand-mark";
  return `<div class="${cls}" aria-hidden="true"><span></span><span></span><span></span><span></span></div>`;
}

export function wordmark() {
  return `<span>TERP<span>LINK</span></span>`;
}

