import { useEffect, useMemo, useState } from "react";
import Icon from "./Icon.jsx";
import Dropdown from "./Dropdown.jsx";

export const EVENT_CATEGORIES = ["Social", "Career", "Arts & Music", "Academic", "Cultural", "Sports", "Technology"];

const PRESET_IMAGES = [
  { label: "Outdoor Movie", url: "/images/movie-night.jpg" },
  { label: "Live Concert", url: "/images/terps-after-dark.jpg" },
  { label: "Career Mixer", url: "/images/career-mixer.jpg" },
  { label: "Campus Festival", url: "/images/featured-maryland-day.jpg" },
];

function toLocalInputValue(dateLike) {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  if (Number.isNaN(+d)) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultStartValue() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  d.setHours(18);
  return toLocalInputValue(d);
}

export default function EventModal({
  initialEvent = null,
  availableOrgs = [],
  defaultOrgId = "",
  isAdmin = false,
  busy = false,
  error = "",
  onSubmit,
  onClose,
}) {
  const isEdit = Boolean(initialEvent);
  const [organizationId, setOrganizationId] = useState(
    initialEvent?.organizationId || defaultOrgId || availableOrgs[0]?.id || "",
  );
  const [title, setTitle] = useState(initialEvent?.title || "");
  const [category, setCategory] = useState(initialEvent?.category || "Social");
  const [startsAt, setStartsAt] = useState(
    initialEvent?.startsAt ? toLocalInputValue(initialEvent.startsAt) : defaultStartValue(),
  );
  const [endsAt, setEndsAt] = useState(initialEvent?.endsAt ? toLocalInputValue(initialEvent.endsAt) : "");
  const [location, setLocation] = useState(initialEvent?.location || "");
  const [note, setNote] = useState(initialEvent?.note || "");
  const [capacity, setCapacity] = useState(initialEvent?.capacity ?? "");
  const [image, setImage] = useState(initialEvent?.image || PRESET_IMAGES[0].url);
  const [description, setDescription] = useState(initialEvent?.description || "");
  const [featured, setFeatured] = useState(Boolean(initialEvent?.featured));

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const orgOptions = useMemo(
    () =>
      availableOrgs.map((org) => ({
        value: org.id,
        label: org.name,
        sublabel: org.category,
        badgeColor: org.color || "red",
        badgeText: org.letter || org.name[0]?.toUpperCase() || "T",
      })),
    [availableOrgs],
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
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
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="rsvp-modal manage-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit event" : "Create event"}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>

        <p className="eyebrow">{isEdit ? "MANAGE EVENT" : "PUBLISH CAMPUS EVENT"}</p>
        <h2>{isEdit ? "Edit event" : "Create an event"}</h2>

        <form className="manage-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <span>Host organization (approved) *</span>
            <Dropdown
              value={organizationId}
              onChange={setOrganizationId}
              options={orgOptions}
              placeholder="Select host organization"
              ariaLabel="Host organization"
            />
          </div>

          <label className="form-field">
            <span>Event title *</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fall Hack Night & Pizza"
              minLength={2}
              maxLength={140}
              required
            />
          </label>

          <div className="form-row-2">
            <div className="form-field">
              <span>Category *</span>
              <Dropdown
                value={category}
                onChange={setCategory}
                options={EVENT_CATEGORIES}
                ariaLabel="Event category"
              />
            </div>

            <label className="form-field">
              <span>Campus location *</span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Iribe Center 0318"
                minLength={2}
                maxLength={140}
                required
              />
            </label>
          </div>

          <div className="form-row-2">
            <label className="form-field">
              <span>Starts at *</span>
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
            </label>

            <label className="form-field">
              <span>Ends at (optional)</span>
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </label>
          </div>

          <div className="form-row-2">
            <label className="form-field">
              <span>Perk / highlight tag</span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Free food, Free popcorn"
                maxLength={60}
              />
            </label>

            <label className="form-field">
              <span>Max capacity (optional)</span>
              <input
                type="number"
                min={1}
                max={50000}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="Unlimited"
              />
            </label>
          </div>

          <div className="form-field">
            <span>Cover photo</span>
            <div className="image-preset-row">
              {PRESET_IMAGES.map((preset) => (
                <button
                  key={preset.url}
                  type="button"
                  className={`image-preset ${image === preset.url ? "selected" : ""}`}
                  onClick={() => setImage(preset.url)}
                >
                  <img src={preset.url} alt={preset.label} />
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
            <input
              type="text"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="Or paste an https:// image URL"
              maxLength={500}
            />
          </div>

          <label className="form-field">
            <span>Event description</span>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Share event schedule, speakers, food details, or what students should bring."
              maxLength={4000}
            />
          </label>

          {isAdmin && (
            <label className="form-checkbox">
              <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
              <span>Feature this event as the Home page hero banner</span>
            </label>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="primary-button"
            disabled={busy || !organizationId || title.trim().length < 2 || location.trim().length < 2}
          >
            {busy ? "Saving…" : isEdit ? "Save event changes" : "Publish event"} <Icon name="arrow" size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
