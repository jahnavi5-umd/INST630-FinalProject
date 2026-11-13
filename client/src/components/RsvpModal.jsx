import { useEffect, useMemo, useRef } from "react";
import Icon from "./Icon.jsx";
import { shortDate, timeOf } from "../lib/format.js";

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

export default function RsvpModal({ event, passCode, userName, busy, error, onConfirm, onClose }) {
  const confirmed = Boolean(passCode);
  const cells = useMemo(() => qrCells(passCode), [passCode]);
  const dialogRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rsvp-modal" role="dialog" aria-modal="true" aria-label="Event RSVP" tabIndex={-1} ref={dialogRef}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
        {!confirmed ? (
          <>
            <div className="modal-icon">
              <Icon name="ticket" size={27} />
            </div>
            <p className="eyebrow">YOU’RE ALMOST THERE</p>
            <h2>Save your spot</h2>
            <div className="modal-event">
              <img src={event.image} alt="" />
              <div>
                <b>{event.title}</b>
                <span>
                  {shortDate(event.startsAt)} · {timeOf(event.startsAt)}
                </span>
                <span>{event.location}</span>
              </div>
            </div>
            <p className="modal-note">
              We’ll add this event to your TerpLink calendar and remind you before it starts.
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button" onClick={onConfirm} disabled={busy}>
              {busy ? "Confirming…" : "Confirm RSVP"} <Icon name="arrow" size={18} />
            </button>
          </>
        ) : (
          <div className="confirmation">
            <div className="success-check">
              <Icon name="check" size={30} />
            </div>
            <p className="eyebrow">RSVP CONFIRMED</p>
            <h2>You’re on the list.</h2>
            <p>Your mobile pass is ready. Show it at the door when you arrive.</p>
            <div className="pass">
              <div className="fake-qr" aria-label={`Pass code ${passCode}`}>
                {cells.map((dark, i) => (
                  <i key={i} className={dark ? "dark" : ""} />
                ))}
              </div>
              <div>
                <span>ADMIT ONE</span>
                <b>{event.title}</b>
                <small>{userName} · UMD Student</small>
              </div>
            </div>
            <button className="primary-button" onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

