const TZ = "America/New_York";

const part = (date, opts) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts }).format(new Date(date));

/** "APR 18" — same shape as the Figma data. */
export const shortDate = (d) => `${part(d, { month: "short" }).toUpperCase()} ${part(d, { day: "numeric" })}`;
export const dayNum = (d) => part(d, { day: "numeric" });
export const monthAbbr = (d) => part(d, { month: "short" }).toUpperCase();
/** "7:30 PM" */
export const timeOf = (d) => part(d, { hour: "numeric", minute: "2-digit" });
/** "10:00 AM – 4:00 PM" */
export const timeRange = (start, end) => (end ? `${timeOf(start)} – ${timeOf(end)}` : timeOf(start));
/** "THURSDAY, APRIL 17" */
export const longToday = () =>
  part(new Date(), { weekday: "long", month: "long", day: "numeric" }).toUpperCase();

export const isSameDay = (a, b) => part(a, { dateStyle: "short" }) === part(b, { dateStyle: "short" });

export function greeting() {
  const hour = Number(part(new Date(), { hour: "numeric", hourCycle: "h23" }));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export const formatMembers = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n));

// ---- Calendar integration ----
const toICSDate = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

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

const icsEscape = (s = "") => String(s).replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\r?\n/g, "\\n");

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

