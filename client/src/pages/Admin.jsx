import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useOutletContext } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import Dropdown from "../components/Dropdown.jsx";
import { EVENT_CATEGORIES } from "../components/EventModal.jsx";
import { api } from "../lib/api.js";
import { dayNum, formatMembers, monthAbbr, timeOf } from "../lib/format.js";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending review", dotColor: "#d99b00" },
  { value: "approved", label: "Approved", dotColor: "#147943" },
  { value: "rejected", label: "Rejected", dotColor: "#e21833" },
];

const ADMIN_EVENT_CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  ...EVENT_CATEGORIES.map((c) => ({ value: c, label: c })),
];

export default function Admin() {
  const {
    user,
    reload: reloadShell,
    openGroupModal,
    deleteGroup,
    openEventModal,
    deleteEvent,
    notify,
  } = useOutletContext();

  const isAdmin = Boolean(user?.isAdmin || user?.role === "admin");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("pending"); // pending | groups | events
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventCatFilter, setEventCatFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/overview");
      setData(res);
    } catch (err) {
      setError(err.message || "Failed to load admin overview");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadOverview();
  }, [isAdmin, loadOverview]);

  if (!isAdmin) {
    return <Navigate to="/profile" replace />;
  }

  const handleApprove = async (org) => {
    setBusyId(org.id);
    try {
      await api.post(`/admin/organizations/${org.id}/approve`);
      notify(`Approved "${org.name}"`);
      await Promise.all([loadOverview(), reloadShell()]);
    } catch (err) {
      notify(err.message || "Could not approve group");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (org) => {
    const reason = window.prompt(
      `Optional reason for rejecting "${org.name}":`,
      "Please add more details about your group’s mission and activities.",
    );
    if (reason === null) return;
    setBusyId(org.id);
    try {
      await api.post(`/admin/organizations/${org.id}/reject`, { reason });
      notify(`Rejected "${org.name}"`);
      await Promise.all([loadOverview(), reloadShell()]);
    } catch (err) {
      notify(err.message || "Could not reject group");
    } finally {
      setBusyId(null);
    }
  };

  const pending = data?.pendingOrganizations || [];
  const allOrgs = data?.organizations || [];
  const allEvents = data?.events || [];
  const stats = data?.stats || { pendingOrgs: 0, approvedOrgs: 0, totalEvents: 0, totalUsers: 0 };

  const filteredOrgs = useMemo(
    () => (statusFilter === "all" ? allOrgs : allOrgs.filter((o) => o.status === statusFilter)),
    [allOrgs, statusFilter],
  );

  const filteredEvents = useMemo(
    () => (eventCatFilter === "all" ? allEvents : allEvents.filter((e) => e.category === eventCatFilter)),
    [allEvents, eventCatFilter],
  );

  return (
    <main className="page">
      <section className="page-heading page-heading-row">
        <div>
          <p className="eyebrow">TERPLINK ADMIN PORTAL · {user.email.toUpperCase()}</p>
          <h1>Admin Dashboard</h1>
          <p>Approve student organization creation requests and manage all campus groups & events.</p>
        </div>
        <div className="heading-actions">
          <button className="action-pill" onClick={() => openGroupModal(null)}>
            <Icon name="plus" size={16} /> New group
          </button>
          <button className="action-pill dark" onClick={() => openEventModal(null)}>
            <Icon name="plus" size={16} /> New event
          </button>
        </div>
      </section>

      <section className="profile-stats admin-stats">
        <div>
          <strong>{stats.pendingOrgs}</strong>
          <span>Pending Requests</span>
        </div>
        <div>
          <strong>{stats.approvedOrgs}</strong>
          <span>Approved Groups</span>
        </div>
        <div>
          <strong>{stats.totalEvents}</strong>
          <span>Campus Events</span>
        </div>
        <div>
          <strong>{stats.totalUsers}</strong>
          <span>UMD Users</span>
        </div>
      </section>

      <div className="admin-tab-bar">
        <div className="segmented" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "pending"}
            className={tab === "pending" ? "active" : ""}
            onClick={() => setTab("pending")}
          >
            Pending Approvals <em>{pending.length}</em>
          </button>
          <button
            role="tab"
            aria-selected={tab === "groups"}
            className={tab === "groups" ? "active" : ""}
            onClick={() => setTab("groups")}
          >
            All Groups <em>{allOrgs.length}</em>
          </button>
          <button
            role="tab"
            aria-selected={tab === "events"}
            className={tab === "events" ? "active" : ""}
            onClick={() => setTab("events")}
          >
            All Events <em>{allEvents.length}</em>
          </button>
        </div>

        {tab === "groups" && (
          <Dropdown
            variant="pill"
            align="right"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTER_OPTIONS}
            ariaLabel="Filter groups by approval status"
          />
        )}
        {tab === "events" && (
          <Dropdown
            variant="pill"
            align="right"
            value={eventCatFilter}
            onChange={setEventCatFilter}
            options={ADMIN_EVENT_CATEGORY_OPTIONS}
            ariaLabel="Filter events by category"
          />
        )}
      </div>

      {error && (
        <div className="login-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="result-count">Loading live MongoDB data…</p>
      ) : tab === "pending" ? (
        pending.length ? (
          <div className="schedule-list">
            {pending.map((org) => (
              <article className="schedule-item admin-request-card" key={org.id}>
                <div className="admin-request-top">
                  <span className={`org-logo ${org.color}`}>{org.letter}</span>
                  <div className="group-info">
                    <div className="group-title-row">
                      <b>{org.name}</b>
                      <span className="status-badge pending">Pending review</span>
                    </div>
                    <span>
                      {org.category} · Requested by <b>{org.createdByName}</b> (
                      {org.createdByEmail || "UMD Student"})
                    </span>
                    {org.description && <p>{org.description}</p>}
                  </div>
                </div>
                <div className="schedule-actions">
                  <button
                    className="chip-button approve-btn"
                    disabled={busyId === org.id}
                    onClick={() => handleApprove(org)}
                  >
                    <Icon name="check" size={15} /> Approve group
                  </button>
                  <button
                    className="chip-button danger"
                    disabled={busyId === org.id}
                    onClick={() => handleReject(org)}
                  >
                    <Icon name="close" size={15} /> Reject
                  </button>
                  <button className="chip-button" onClick={() => openGroupModal(org)}>
                    <Icon name="edit" size={14} /> Edit details
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Icon name="check" size={28} />
            <h3>All caught up!</h3>
            <p>There are no pending group creation requests waiting for approval.</p>
          </div>
        )
      ) : tab === "groups" ? (
        <div className="group-list">
          {filteredOrgs.map((org) => (
            <article className="group-card manage-group-card" key={org.id}>
              <span className={`org-logo ${org.color}`}>{org.letter}</span>
              <div className="group-info">
                <div className="group-title-row">
                  <b>{org.name}</b>
                  <span className={`status-badge ${org.status}`}>{org.status}</span>
                </div>
                <span>
                  {org.category} · {formatMembers(org.members)} members · Owner:{" "}
                  {org.createdByEmail || org.createdByName}
                </span>
                {org.description && <p>{org.description}</p>}
                <div className="group-owner-bar">
                  {org.status !== "approved" && (
                    <button
                      type="button"
                      className="chip-button approve-btn"
                      disabled={busyId === org.id}
                      onClick={() => handleApprove(org)}
                    >
                      <Icon name="check" size={14} /> Approve
                    </button>
                  )}
                  {org.status === "approved" && (
                    <button type="button" className="chip-button dark" onClick={() => openEventModal(null, org.id)}>
                      <Icon name="plus" size={14} /> Post event
                    </button>
                  )}
                  <button type="button" className="chip-button" onClick={() => openGroupModal(org)}>
                    <Icon name="edit" size={14} /> Edit
                  </button>
                  <button
                    type="button"
                    className="chip-button danger"
                    onClick={async () => {
                      await deleteGroup(org);
                      await loadOverview();
                    }}
                  >
                    <Icon name="trash" size={14} /> Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="schedule-list">
          {filteredEvents.map((event) => (
            <article className="schedule-item" key={event.id}>
              <div className="schedule-main">
                <div className="date-tile static">
                  <strong>{dayNum(event.startsAt)}</strong>
                  <span>{monthAbbr(event.startsAt)}</span>
                </div>
                <div className="schedule-info">
                  <p className="card-org">
                    {event.org} {event.featured ? "· ★ FEATURED HERO" : ""}
                  </p>
                  <b>{event.title}</b>
                  <div className="detail">
                    <Icon name="clock" size={15} /> {timeOf(event.startsAt)} · {event.attendees} going
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
                <button
                  className="chip-button danger"
                  onClick={async () => {
                    await deleteEvent(event);
                    await loadOverview();
                  }}
                >
                  <Icon name="trash" size={14} /> Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
