import Icon from "./Icon.jsx";
import { dayNum, monthAbbr, timeOf } from "../lib/format.js";

// Markup & class names match the Figma Make prototype's event card.
export default function EventCard({ event, saved, going, onToggleSave, onRsvp, onEdit }) {
  return (
    <article className="event-card">
      <div className="card-image">
        <img src={event.image} alt="" loading="lazy" />
        <div className="date-tile">
          <strong>{dayNum(event.startsAt)}</strong>
          <span>{monthAbbr(event.startsAt)}</span>
        </div>
        <button
          className={`save-button ${saved ? "saved" : ""}`}
          onClick={() => onToggleSave(event.id)}
          aria-label={saved ? "Remove from saved" : "Save event"}
        >
          <Icon name="bookmark" size={19} filled={saved} />
        </button>
        {event.note && event.note.toLowerCase().includes("free") && (
          <span className="card-badge">{event.note}</span>
        )}
      </div>
      <div className="card-body">
        <p className="card-org">{event.org}</p>
        <h3>{event.title}</h3>
        <div className="detail">
          <Icon name="clock" size={16} /> {timeOf(event.startsAt)}
        </div>
        <div className="detail">
          <Icon name="pin" size={16} /> {event.location}
        </div>
        <div className="card-footer">
          <div className="attendees">
            <span className="mini-avatar">J</span>
            <span className="mini-avatar">K</span>
            <span className="mini-avatar">S</span>
            <span>
              {event.attendees} going{event.capacity ? ` · ${event.capacity} cap` : ""}
            </span>
          </div>
          <div className="card-footer-actions">
            {event.canManage && onEdit && (
              <button
                type="button"
                className="card-manage-btn"
                onClick={() => onEdit(event)}
                aria-label={`Edit ${event.title}`}
                title="Edit event"
              >
                <Icon name="edit" size={14} /> Edit
              </button>
            )}
            <button onClick={() => onRsvp(event)} className={going ? "is-going" : ""}>
              {going ? (
                <>
                  Going <Icon name="check" size={16} />
                </>
              ) : (
                <>
                  RSVP <Icon name="arrow" size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
