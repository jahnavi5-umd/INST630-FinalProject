import { useEffect, useMemo, useState } from "react";
import Icon from "./Icon.jsx";
import Dropdown from "./Dropdown.jsx";

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

const COLORS = [
  { value: "red", label: "Maryland Red", sublabel: "Classic crimson badge", badgeColor: "red" },
  { value: "yellow", label: "Terp Gold", sublabel: "High-contrast gold badge", badgeColor: "yellow" },
  { value: "black", label: "Obsidian", sublabel: "Stealth dark badge", badgeColor: "black" },
];

export default function GroupModal({ initialGroup = null, busy = false, error = "", onSubmit, onClose }) {
  const isEdit = Boolean(initialGroup);
  const [name, setName] = useState(initialGroup?.name || "");
  const [category, setCategory] = useState(initialGroup?.category || "Technology");
  const [color, setColor] = useState(initialGroup?.color || "red");
  const [description, setDescription] = useState(initialGroup?.description || "");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const previewLetter = (name.trim()[0] || "T").toUpperCase();

  const colorOptions = useMemo(
    () => COLORS.map((c) => ({ ...c, badgeText: previewLetter })),
    [previewLetter],
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ name: name.trim(), category, color, description: description.trim() });
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="rsvp-modal manage-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit group" : "Create group"}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>

        <div className="modal-preview-row">
          <span className={`org-logo ${color}`}>{previewLetter}</span>
          <div>
            <p className="eyebrow">{isEdit ? "MANAGE ORGANIZATION" : "NEW STUDENT ORGANIZATION"}</p>
            <h2>{isEdit ? "Edit group" : "Start a campus group"}</h2>
          </div>
        </div>

        {!isEdit && (
          <p className="modal-approval-banner">
            <Icon name="shield" size={15} />
            <span>
              New groups require approval from the App Admin (<b>jahnavi5@umd.edu</b>) before appearing in the public
              directory and hosting events.
            </span>
          </p>
        )}

        <form className="manage-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Organization name *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Terp AI Society"
              minLength={2}
              maxLength={140}
              required
              autoFocus
            />
          </label>

          <div className="form-row-2">
            <div className="form-field">
              <span>Category *</span>
              <Dropdown
                value={category}
                onChange={setCategory}
                options={ORG_CATEGORIES}
                ariaLabel="Organization category"
              />
            </div>

            <div className="form-field">
              <span>Badge style</span>
              <Dropdown
                value={color}
                onChange={setColor}
                options={colorOptions}
                ariaLabel="Organization badge style"
              />
            </div>
          </div>

          <label className="form-field">
            <span>Mission & description</span>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell Terps what your organization is all about, when you meet, and who can join."
              maxLength={2000}
            />
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="primary-button" disabled={busy || name.trim().length < 2}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Submit group for approval"}{" "}
            <Icon name="arrow" size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
