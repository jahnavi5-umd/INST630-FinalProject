import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import Dropdown from "../components/Dropdown.jsx";
import { ORG_CATEGORIES } from "../components/GroupModal.jsx";
import { dayNum, formatMembers, monthAbbr, timeOf } from "../lib/format.js";

const GROUP_CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  ...ORG_CATEGORIES.map((c) => ({ value: c, label: c })),
];

const GROUP_SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "members", label: "Most members" },
  { value: "az", label: "Name (A–Z)" },
];

function StatusBadge({ status }) {
  if (status === "pending") {
    return <span className="status-badge pending">Pending Admin approval (jahnavi5@umd.edu)</span>;
  }
  if (status === "rejected") {
    return <span className="status-badge rejected">Rejected</span>;
  }
  return <span className="status-badge approved">Approved</span>;
}

export default function Groups() {
  const {
    user,
    events,
    organizations,
    myOrganizations,
    loading,
    followSet,
    toggleFollow,
    openGroupModal,
    deleteGroup,
    openEventModal,
    deleteEvent,
  } = useOutletContext();

  const [tab, setTab] = useState("all"); // all | mine
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("featured");

  const visibleOrgs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = organizations.filter((o) => {
      const catMatch = categoryFilter === "all" || o.category === categoryFilter;
      const textMatch = `${o.name} ${o.category} ${o.description}`.toLowerCase().includes(q);
      return catMatch && textMatch;
    });
    if (sortBy === "members") {
      return [...filtered].sort((a, b) => (b.members || 0) - (a.members || 0));
    }
    if (sortBy === "az") {
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }
    return filtered;
  }, [organizations, query, categoryFilter, sortBy]);

  const myManagedEvents = useMemo(
    () =>
      events.filter(
        (e) => e.canManage && (e.createdBy === user.id || myOrganizations.some((o) => o.id === e.organizationId)),
      ),
    [events, user.id, myOrganizations],
  );

  return (
    <main className="page">
      <section className="page-heading page-heading-row">
        <div>
          <p className="eyebrow">MAKE CAMPUS YOURS</p>
          <h1>Find your people.</h1>
          <p>Join an approved student organization, or create your own group and publish campus events.</p>
        </div>
        <div className="heading-actions">
          <button className="action-pill" onClick={() => openGroupModal(null)}>
            <Icon name="plus" size={16} /> Create group
          </button>
          <button className="action-pill dark" onClick={() => openEventModal(null)}>
            <Icon name="calendar" size={16} /> Create event
          </button>
        </div>
      </section>

      <div className="segmented" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "all"}
          className={tab === "all" ? "active" : ""}
          onClick={() => setTab("all")}
        >
          Campus Directory <em>{organizations.length}</em>
        </button>
        <button
          role="tab"
          aria-selected={tab === "mine"}
          className={tab === "mine" ? "active" : ""}
          onClick={() => setTab("mine")}
        >
          My Groups & Events <em>{myOrganizations.length + myManagedEvents.length}</em>
        </button>
      </div>

      {tab === "all" ? (
        <>
          <div className="filter-toolbar">
            <label className="mobile-search search-field">
              <Icon name="search" size={19} />
              <input
                value={query}
                maxLength={80}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search organizations"
                aria-label="Search organizations"
              />
              {query && (
                <button className="clear-search" onClick={() => setQuery("")} aria-label="Clear search">
                  <Icon name="close" size={16} />
                </button>
              )}
            </label>

            <div className="filter-dropdowns">
              <Dropdown
                variant="pill"
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={GROUP_CATEGORY_OPTIONS}
                ariaLabel="Filter organizations by category"
              />
              <Dropdown
                variant="pill"
                align="right"
                value={sortBy}
                onChange={setSortBy}
                options={GROUP_SORT_OPTIONS}
                ariaLabel="Sort organizations"
              />
            </div>
          </div>

          {loading ? (
            <p className="result-count">Loading…</p>
          ) : visibleOrgs.length ? (
            <div className="group-list">
              {visibleOrgs.map((org) => {
                const following = followSet.has(org.id);
                return (
                  <article className="group-card" key={org.id}>
                    <span className={`org-logo ${org.color}`}>{org.letter}</span>
                    <div className="group-info">
                      <b>{org.name}</b>
                      <span>
                        {org.category} · {formatMembers(org.members)} members
                      </span>
                      {org.description && <p>{org.description}</p>}
                      {org.canManage && (
                        <div className="group-owner-bar">
                          <button type="button" className="chip-button dark" onClick={() => openEventModal(null, org.id)}>
                            <Icon name="plus" size={14} /> Post event
                          </button>
                          <button type="button" className="chip-button" onClick={() => openGroupModal(org)}>
                            <Icon name="edit" size={14} /> Edit
                          </button>
                          <button type="button" className="chip-button danger" onClick={() => deleteGroup(org)}>
                            <Icon name="trash" size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      className={`follow-button ${following ? "following" : ""}`}
                      onClick={() => toggleFollow(org)}
                      aria-pressed={following}
                    >
                      {following ? (
                        <>
                          <Icon name="check" size={15} /> Joined
                        </>
                      ) : (
                        <>
                          <Icon name="plus" size={15} /> Join
                        </>
                      )}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <Icon name="users" size={28} />
              <h3>No organizations found</h3>
              <p>Try a different search or start a new student group.</p>
            </div>
          )}
        </>
      ) : (
        <div className="manage-sections">
          <section>
            <div className="sub-heading">
              <h2>My created groups ({myOrganizations.length})</h2>
              <button className="text-button" onClick={() => openGroupModal(null)}>
                <Icon name="plus" size={16} /> New group
              </button>
            </div>

            {myOrganizations.length ? (
              <div className="group-list">
                {myOrganizations.map((org) => (
                  <article className="group-card manage-group-card" key={org.id}>
                    <span className={`org-logo ${org.color}`}>{org.letter}</span>
                    <div className="group-info">
                      <div className="group-title-row">
                        <b>{org.name}</b>
                        <StatusBadge status={org.status} />
                      </div>
                      <span>
                        {org.category} · {formatMembers(org.members)} members
                      </span>
                      {org.description && <p>{org.description}</p>}
                      {org.status === "rejected" && org.rejectionReason && (
                        <p className="reject-reason">Reason: {org.rejectionReason}</p>
                      )}
                      <div className="group-owner-bar">
                        {org.status === "approved" && (
                          <button type="button" className="chip-button dark" onClick={() => openEventModal(null, org.id)}>
                            <Icon name="plus" size={14} /> Create event
                          </button>
                        )}
                        <button type="button" className="chip-button" onClick={() => openGroupModal(org)}>
                          <Icon name="edit" size={14} /> {org.status === "rejected" ? "Edit & resubmit" : "Edit group"}
                        </button>
                        <button type="button" className="chip-button danger" onClick={() => deleteGroup(org)}>
                          <Icon name="trash" size={14} /> Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state compact">
                <Icon name="users" size={26} />
                <h3>You haven’t created a group yet</h3>
                <p>Request a new student organization. Once approved by jahnavi5@umd.edu, you can publish events.</p>
                <button className="text-button retry" onClick={() => openGroupModal(null)}>
                  Create your first group <Icon name="arrow" size={16} />
                </button>
              </div>
            )}
          </section>

          <section>
            <div className="sub-heading">
              <h2>My published events ({myManagedEvents.length})</h2>
              <button className="text-button" onClick={() => openEventModal(null)}>
                <Icon name="plus" size={16} /> New event
              </button>
            </div>

            {myManagedEvents.length ? (
              <div className="schedule-list">
                {myManagedEvents.map((event) => (
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
                          <Icon name="clock" size={15} /> {timeOf(event.startsAt)} · {event.attendees} going
                          {event.capacity ? ` / ${event.capacity}` : ""}
                        </div>
                        <div className="detail">
                          <Icon name="pin" size={15} /> {event.location}
                        </div>
                      </div>
                      <img src={event.image} alt="" />
                    </div>
                    <div className="schedule-actions">
                      <button className="chip-button dark" onClick={() => openEventModal(event)}>
                        <Icon name="edit" size={14} /> Edit event
                      </button>
                      <button className="chip-button danger" onClick={() => deleteEvent(event)}>
                        <Icon name="trash" size={14} /> Delete event
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state compact">
                <Icon name="calendar" size={26} />
                <h3>No published events yet</h3>
                <p>Once your organization is approved, publish events here to reach all UMD students.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
