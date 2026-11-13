import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import EventCard from "../components/EventCard.jsx";
import Dropdown from "../components/Dropdown.jsx";
import { CATEGORIES, EVENT_SORT_OPTIONS, filterEvents, sortEvents } from "./Home.jsx";

const DISCOVER_CATEGORIES = [...CATEGORIES, "Academic", "Cultural", "Sports", "Technology"];

const CATEGORY_DROPDOWN_OPTIONS = DISCOVER_CATEGORIES.map((c) => ({
  value: c,
  label: c === "For you" ? "All categories" : c,
  ...(c === "Free food" ? { dotColor: "#e21833" } : {}),
}));

export default function Discover() {
  const { events, loading, search, setSearch, savedSet, rsvpMap, toggleSave, openRsvp, openEventModal } =
    useOutletContext();
  const [activeCategory, setActiveCategory] = useState("For you");
  const [sortBy, setSortBy] = useState("soonest");
  const visible = useMemo(
    () => sortEvents(filterEvents(events, activeCategory, search), sortBy),
    [events, activeCategory, search, sortBy],
  );

  return (
    <main className="page">
      <section className="page-heading page-heading-row">
        <div>
          <p className="eyebrow">EXPLORE CAMPUS</p>
          <h1>Discover events</h1>
          <p>Search every upcoming event across UMD’s student organizations.</p>
        </div>
        <button className="action-pill dark" onClick={() => openEventModal(null)}>
          <Icon name="plus" size={16} /> Create event
        </button>
      </section>

      <div className="filter-toolbar">
        <label className="mobile-search search-field">
          <Icon name="search" size={19} />
          <input
            value={search}
            maxLength={80}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events & organizations"
            aria-label="Search events and organizations"
          />
          {search && (
            <button className="clear-search" onClick={() => setSearch("")} aria-label="Clear search">
              <Icon name="close" size={16} />
            </button>
          )}
        </label>

        <div className="filter-dropdowns">
          <Dropdown
            variant="pill"
            value={activeCategory}
            onChange={setActiveCategory}
            options={CATEGORY_DROPDOWN_OPTIONS}
            ariaLabel="Filter by category"
          />
          <Dropdown
            variant="pill"
            align="right"
            value={sortBy}
            onChange={setSortBy}
            options={EVENT_SORT_OPTIONS}
            ariaLabel="Sort events"
          />
        </div>
      </div>

      <div className="category-scroll">
        {DISCOVER_CATEGORIES.map((category) => (
          <button
            key={category}
            className={activeCategory === category ? "active" : ""}
            onClick={() => setActiveCategory(category)}
          >
            {category === "Free food" && <span className="tiny-dot" />}
            {category === "For you" ? "All events" : category}
          </button>
        ))}
      </div>

      <p className="result-count">
        {loading ? "Loading events…" : `${visible.length} ${visible.length === 1 ? "event" : "events"}`}
      </p>

      {visible.length ? (
        <div className="event-grid event-list">
          {visible.map((event) => (
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
        !loading && (
          <div className="empty-state">
            <Icon name="search" size={28} />
            <h3>No events found</h3>
            <p>Try another search or category.</p>
          </div>
        )
      )}
    </main>
  );
}
