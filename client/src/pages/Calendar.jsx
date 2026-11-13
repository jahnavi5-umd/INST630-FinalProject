import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import Dropdown from "../components/Dropdown.jsx";
import { EVENT_SORT_OPTIONS, sortEvents } from "./Home.jsx";
import { dayNum, downloadICS, googleCalendarUrl, monthAbbr, timeOf } from "../lib/format.js";

export default function Calendar() {
  const navigate = useNavigate();
  const { events, loading, savedSet, rsvpMap, openRsvp, cancelRsvp, toggleSave } = useOutletContext();
  const [tab, setTab] = useState("going");
  const [sortBy, setSortBy] = useState("soonest");

  const going = useMemo(() => sortEvents(events.filter((e) => rsvpMap.has(e.id)), sortBy), [events, rsvpMap, sortBy]);
  const saved = useMemo(() => sortEvents(events.filter((e) => savedSet.has(e.id)), sortBy), [events, savedSet, sortBy]);
  const list = tab === "going" ? going : saved;

  return (
    <main className="page">
      <section className="page-heading page-heading-row">
        <div>
          <p className="eyebrow">MY SCHEDULE</p>
          <h1>Your calendar</h1>
          <p>Everything you’ve RSVP’d to and saved, in one place.</p>
        </div>
        <Dropdown
          variant="pill"
          align="right"
          value={sortBy}
          onChange={setSortBy}
          options={EVENT_SORT_OPTIONS}
          ariaLabel="Sort calendar events"
        />
      </section>

      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={tab === "going"} className={tab === "going" ? "active" : ""} onClick={() => setTab("going")}>
          Going <em>{going.length}</em>
        </button>
        <button role="tab" aria-selected={tab === "saved"} className={tab === "saved" ? "active" : ""} onClick={() => setTab("saved")}>
          Saved <em>{saved.length}</em>
        </button>
      </div>

      {loading ? (
        <p className="result-count">Loading…</p>
      ) : list.length ? (
        <div className="schedule-list">
          {list.map((event) => (
            <article className="schedule-item" key={event.id}>
              <div className="schedule-main">
                <div className="date-tile static">
                  <strong>{dayNum(event.startsAt)}</strong>
                  <span>{monthAbbr(event.startsAt)}</span>
                </div>
                <div className="schedule-info">
                  <p className="card-org">{event.org}</p>
                  <b>{event.title}</b>
                  <div className="detail">
                    <Icon name="clock" size={15} /> {timeOf(event.startsAt)}
                  </div>
                  <div className="detail">
                    <Icon name="pin" size={15} /> {event.location}
                  </div>
                </div>
                <img src={event.image} alt="" />
              </div>
              <div className="schedule-actions">
                {tab === "going" ? (
                  <>
                    <button className="chip-button dark" onClick={() => openRsvp(event)}>
                      <Icon name="ticket" size={15} /> View pass
                    </button>
                    <a className="chip-button" href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
                      <Icon name="plus" size={15} /> Google Calendar
                    </a>
                    <button className="chip-button" onClick={() => downloadICS(event)}>
                      <Icon name="calendar" size={15} /> Apple / .ics
                    </button>
                    <button className="chip-button danger" onClick={() => cancelRsvp(event)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button className="chip-button dark" onClick={() => openRsvp(event)}>
                      {rsvpMap.has(event.id) ? "Going" : "RSVP"} <Icon name="arrow" size={15} />
                    </button>
                    <button className="chip-button" onClick={() => toggleSave(event.id)}>
                      <Icon name="bookmark" size={15} /> Remove
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Icon name={tab === "going" ? "ticket" : "bookmark"} size={28} />
          <h3>{tab === "going" ? "No RSVPs yet" : "Nothing saved yet"}</h3>
          <p>{tab === "going" ? "RSVP to an event and your pass will appear here." : "Tap the bookmark on any event to save it."}</p>
          <button className="text-button retry" onClick={() => navigate("/discover")}>
            Discover events <Icon name="arrow" size={17} />
          </button>
        </div>
      )}
    </main>
  );
}
