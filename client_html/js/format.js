const TZ = "America/New_York";

const part = (date, opts) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts }).format(new Date(date));

/** "APR 18" — same shape as the Figma data. */
export const shortDate = (d) =>
  `${part(d, { month: "short" }).toUpperCase()} ${part(d, { day: "numeric" })}`;
export const dayNum = (d) => part(d, { day: "numeric" });
export const monthAbbr = (d) => part(d, { month: "short" }).toUpperCase();
/** "7:30 PM" */
export const timeOf = (d) => part(d, { hour: "numeric", minute: "2-digit" });
/** "10:00 AM – 4:00 PM" */
export const timeRange = (start, end) =>
  end ? `${timeOf(start)} – ${timeOf(end)}` : timeOf(start);
/** "THURSDAY, APRIL 17" */
export const longToday = () =>
  part(new Date(), { weekday: "long", month: "long", day: "numeric" }).toUpperCase();

export const isSameDay = (a, b) =>
  part(a, { dateStyle: "short" }) === part(b, { dateStyle: "short" });

export function greeting() {
  const hour = Number(part(new Date(), { hour: "numeric", hourCycle: "h23" }));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export const formatMembers = (n) =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n);

// ---- Calendar integration ----
const toICSDate = (d) =>
  new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function googleCalendarUrl(event) {
  const end = event.endsAt || new Date(new Date(event.startsAt).getTime() + 60 * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toICSDate(event.startsAt)}/${toICSDate(end)}`,
    details: `${event.description || ""}\n\nHosted by ${event.org} · via TerpLink`,
    location: `${event.location}, University of Maryland, College Park, MD`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

const icsEscape = (s = "") =>
  String(s)
    .replace(/[\\;,]/g, (m) => `\\${m}`)
    .replace(/\r?\n/g, "\\n");

export function downloadICS(event) {
  const end = event.endsAt || new Date(new Date(event.startsAt).getTime() + 60 * 60 * 1000);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TerpLink//Events//EN",
    "BEGIN:VEVENT",
    `UID:${event.id}@terplink`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(event.startsAt)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    `LOCATION:${icsEscape(event.location)}`,
    `DESCRIPTION:${icsEscape(`Hosted by ${event.org}`)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(event.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- HTML escaping ----
export function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const escapeAttr = escapeHtml;

// ---- Shared Event & Organization Constants & Helpers ----
export const CATEGORIES = ["For you", "Today", "Free food", "Social", "Career", "Arts & Music"];

export const DISCOVER_CATEGORIES = [
  ...CATEGORIES,
  "Academic",
  "Cultural",
  "Sports",
  "Technology",
];

export const EVENT_CATEGORIES = [
  "Social",
  "Career",
  "Arts & Music",
  "Academic",
  "Cultural",
  "Sports",
  "Technology",
];

export const ORG_CATEGORIES = [
  "Technology",
  "Arts",
  "Community",
  "Academic",
  "Cultural",
  "Career",
  "Social",
  "Sports",
  "Entertainment",
];

export const EVENT_SORT_OPTIONS = [
  { value: "soonest", label: "Soonest first" },
  { value: "popular", label: "Most popular" },
  { value: "az", label: "Title (A–Z)" },
];

export function sortEvents(list, sortBy = "soonest") {
  const arr = [...list];
  if (sortBy === "popular") {
    return arr.sort((a, b) => (b.attendees || 0) - (a.attendees || 0));
  }
  if (sortBy === "az") {
    return arr.sort((a, b) => a.title.localeCompare(b.title));
  }
  return arr.sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
}

export function filterEvents(list, category, search, now = new Date()) {
  const q = search.trim().toLowerCase();
  const hasTodayMatch = list.some((e) => isSameDay(e.startsAt, now));
  return list.filter((event) => {
    const categoryMatch =
      category === "For you" ||
      (category === "Today" && (!hasTodayMatch || isSameDay(event.startsAt, now))) ||
      (category === "Free food" && (event.note || "").toLowerCase().includes("free")) ||
      event.category === category;
    const queryMatch = `${event.title} ${event.org} ${event.category} ${event.location}`
      .toLowerCase()
      .includes(q);
    return categoryMatch && queryMatch;
  });
}

