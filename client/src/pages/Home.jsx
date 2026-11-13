import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import EventCard from "../components/EventCard.jsx";
import Dropdown from "../components/Dropdown.jsx";
import { dayNum, formatMembers, greeting, isSameDay, longToday, monthAbbr, timeRange } from "../lib/format.js";

export const CATEGORIES = ["For you", "Today", "Free food", "Social", "Career", "Arts & Music"];

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
    const queryMatch = `${event.title} ${event.org} ${event.category} ${event.location}`.toLowerCase().includes(q);
    return categoryMatch && queryMatch;
  });
}

/** The Home / feed screen — driven by live MongoDB data. */
export default function Home() {
  const navigate = useNavigate();
  const {
    user,
    events,
    organizations,
    loading,
    loadError,
    reload,
    search,
    setSearch,
    savedSet,
    rsvpMap,
    toggleSave,
    openRsvp,
    openEventModal,
  } = useOutletContext();
  const [activeCategory, setActiveCategory] = useState("For you");
  const [sortBy, setSortBy] = useState("soonest");

  const featured = events.find((e) => e.featured) || events[0] || null;
  const feed = useMemo(
    () => (featured ? events.filter((e) => e.id !== featured.id) : events),
    [events, featured],
  );
  const visibleEvents = useMemo(
    () => sortEvents(filterEvents(feed, activeCategory, search), sortBy),
    [feed, activeCategory, search, sortBy],
  );

  return (
    <main id="feed">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">{longToday()}</p>
          <h1>
            {greeting()}, {user.givenName}.
          </h1>
          <p>There’s a lot happening around campus today.</p>
        </div>
        <div className="week-glance" id="calendar">
          <div>
            <strong>{events.length}</strong>
            <span>campus events</span>
          </div>
          <button onClick={() => navigate("/calendar")}>
            View calendar <Icon name="arrow" size={17} />
          </button>
        </div>
      </section>

      <label className="mobile-search">
        <Icon name="search" size={19} />
        <input
          value={search}
          maxLength={80}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events & organizations"
          aria-label="Search events and organizations"
        />
      </label>

      {loadError && (
        <div className="empty-state">
          <Icon name="close" size={28} />
          <h3>Couldn’t load events</h3>
          <p>{loadError}</p>
          <button className="text-button retry" onClick={reload}>
            Try again <Icon name="arrow" size={17} />
          </button>
        </div>
      )}

      {featured ? (
        <section className="featured">
          <img src={featured.image} alt={featured.title} />
          <div className="featured-shade" />
          <div className="featured-date">
            <b>{dayNum(featured.startsAt)}</b>
            <span>{monthAbbr(featured.startsAt)}</span>
          </div>
          <div className="featured-copy">
            <div className="live-pill">
              <i /> {featured.featuredLabel || "FEATURED ON CAMPUS"}
            </div>
            <p>{featured.title}</p>
            <h2>
              {(featured.featuredHeadline || "One campus.\nA thousand ways to explore.")
                .split("\n")
                .map((line, i) => (
                  <span key={i}>
                    {i > 0 && <br />}
                    {line}
                  </span>
                ))}
            </h2>
            <div className="featured-meta">
              <span>
                <Icon name="clock" size={17} /> {timeRange(featured.startsAt, featured.endsAt)}
              </span>
              <span>
                <Icon name="pin" size={17} /> {featured.location}
              </span>
            </div>
            <button onClick={() => openRsvp(featured)}>
              Explore event <Icon name="arrow" size={18} />
            </button>
          </div>
        </section>
      ) : (
        loading && <section className="featured skeleton" aria-busy="true" />
      )}

      <section className="feed-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PICKED FOR YOU</p>
            <h2>Find your next thing</h2>
          </div>
          <div className="section-heading-actions">
            <Dropdown
              variant="pill"
              align="right"
              value={sortBy}
              onChange={setSortBy}
              options={EVENT_SORT_OPTIONS}
              ariaLabel="Sort feed events"
            />
            <button className="text-button" onClick={() => navigate("/discover")}>
              See all <Icon name="arrow" size={17} />
            </button>
          </div>
        </div>
        <div className="category-scroll">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              className={activeCategory === category ? "active" : ""}
              onClick={() => setActiveCategory(category)}
            >
              {category === "Free food" && <span className="tiny-dot" />}
              {category}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="event-grid">
            {[0, 1, 2].map((i) => (
              <div className="event-card skeleton-card" key={i} />
            ))}
          </div>
        ) : visibleEvents.length ? (
          <div className="event-grid">
            {visibleEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                saved={savedSet.has(event.id)}
                going={rsvpMap.has(event.id)}
                onToggleSave={toggleSave}
                onRsvp={openRsvp}
                onEdit={openEventModal}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Icon name="search" size={28} />
            <h3>No events found</h3>
            <p>Try another search or category.</p>
          </div>
        )}
      </section>

      <section className="org-section" id="organizations">
        <div className="org-copy">
          <p className="eyebrow">MAKE CAMPUS YOURS</p>
          <h2>Find your people.</h2>
          <p>
            Explore {organizations.length ? `${organizations.length} active` : "student"} organizations built around
            the things you care about, or start your own.
          </p>
          <button onClick={() => navigate("/groups")}>
            Explore organizations <Icon name="arrow" size={18} />
          </button>
        </div>
        <div className="org-list">
          {organizations.slice(0, 3).map((org) => (
            <div
              className="org-item"
              key={org.id}
              role="link"
              tabIndex={0}
              onClick={() => navigate("/groups")}
              onKeyDown={(e) => e.key === "Enter" && navigate("/groups")}
            >
              <span className={`org-logo ${org.color}`}>{org.letter}</span>
              <div>
                <b>{org.name}</b>
                <span>
                  {org.category} · {formatMembers(org.members)} members
                </span>
              </div>
              <Icon name="chevron" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
