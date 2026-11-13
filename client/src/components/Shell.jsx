import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import Icon from "./Icon.jsx";
import TerpMark, { Wordmark } from "./TerpMark.jsx";
import RsvpModal from "./RsvpModal.jsx";
import GroupModal from "./GroupModal.jsx";
import EventModal from "./EventModal.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";

const MOBILE_TABS = [
  { to: "/", icon: "home", label: "Home" },
  { to: "/discover", icon: "compass", label: "Discover" },
  { to: "/calendar", icon: "calendar", label: "Calendar" },
  { to: "/groups", icon: "users", label: "Groups" },
  { to: "/profile", icon: "user", label: "Profile" },
];

/** App chrome from the Figma prototype: sticky top bar, bottom tab bar, toast & modals. */
export default function Shell() {
  const { user, setUser, handleAuthError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [events, setEvents] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [myOrganizations, setMyOrganizations] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef();

  const [rsvp, setRsvp] = useState(null); // { event, passCode, busy, error }
  const [groupModal, setGroupModal] = useState(null); // { initialGroup, busy, error }
  const [eventModal, setEventModal] = useState(null); // { initialEvent, defaultOrgId, busy, error }

  const notify = useCallback((message) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  }, []);

  const fail = useCallback(
    (err) => {
      if (!handleAuthError(err)) notify(err.message || "Something went wrong");
    },
    [handleAuthError, notify],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [ev, orgs] = await Promise.all([api.get("/events"), api.get("/organizations")]);
      setEvents(ev.events);
      setOrganizations(orgs.organizations);
      setMyOrganizations(orgs.myOrganizations || []);
      setPendingCount(orgs.pendingCount || 0);
    } catch (err) {
      if (!handleAuthError(err)) setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [handleAuthError]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const savedSet = useMemo(() => new Set(user.savedEvents), [user.savedEvents]);
  const rsvpMap = useMemo(() => new Map(user.rsvps.map((r) => [r.eventId, r.passCode])), [user.rsvps]);
  const followSet = useMemo(() => new Set(user.followedOrgs), [user.followedOrgs]);

  // Organizations that the current user is allowed to post events under
  const postableOrgs = useMemo(() => {
    if (user.isAdmin || user.role === "admin") return organizations;
    return myOrganizations.filter((o) => o.status === "approved");
  }, [user.isAdmin, user.role, organizations, myOrganizations]);

  const toggleSave = useCallback(
    async (id) => {
      const isSaved = savedSet.has(id);
      setUser((u) => ({
        ...u,
        savedEvents: isSaved ? u.savedEvents.filter((x) => x !== id) : [...u.savedEvents, id],
      }));
      try {
        const res = isSaved ? await api.del(`/events/${id}/save`) : await api.put(`/events/${id}/save`);
        setUser(res.user);
      } catch (err) {
        setUser((u) => ({
          ...u,
          savedEvents: isSaved ? [...u.savedEvents, id] : u.savedEvents.filter((x) => x !== id),
        }));
        fail(err);
      }
    },
    [savedSet, setUser, fail],
  );

  const openRsvp = useCallback(
    (event) => setRsvp({ event, passCode: rsvpMap.get(event.id) || null, busy: false, error: "" }),
    [rsvpMap],
  );
  const closeRsvp = useCallback(() => setRsvp(null), []);

  const confirmRsvp = useCallback(async () => {
    if (!rsvp) return;
    setRsvp((r) => ({ ...r, busy: true, error: "" }));
    try {
      const res = await api.post(`/events/${rsvp.event.id}/rsvp`);
      setUser(res.user);
      if (res.event) setEvents((list) => list.map((e) => (e.id === res.event.id ? res.event : e)));
      setRsvp((r) => r && { ...r, busy: false, passCode: res.passCode });
    } catch (err) {
      if (!handleAuthError(err)) setRsvp((r) => r && { ...r, busy: false, error: err.message });
    }
  }, [rsvp, setUser, handleAuthError]);

  const cancelRsvp = useCallback(
    async (event) => {
      try {
        const res = await api.del(`/events/${event.id}/rsvp`);
        setUser(res.user);
        setEvents((list) =>
          list.map((e) => (e.id === event.id ? { ...e, attendees: Math.max(0, e.attendees - 1) } : e)),
        );
        notify("RSVP cancelled");
      } catch (err) {
        fail(err);
      }
    },
    [setUser, notify, fail],
  );

  const toggleFollow = useCallback(
    async (org) => {
      const following = followSet.has(org.id);
      try {
        const res = following
          ? await api.del(`/organizations/${org.id}/follow`)
          : await api.put(`/organizations/${org.id}/follow`);
        setUser(res.user);
        setOrganizations((list) =>
          list.map((o) => (o.id === org.id ? { ...o, members: Math.max(0, o.members + (following ? -1 : 1)) } : o)),
        );
        notify(following ? `Left ${org.name}` : `Joined ${org.name}`);
      } catch (err) {
        fail(err);
      }
    },
    [followSet, setUser, notify, fail],
  );

  // ---- Group Creation & Management ----
  const openGroupModal = useCallback((initialGroup = null) => {
    setGroupModal({ initialGroup, busy: false, error: "" });
  }, []);

  const submitGroupModal = useCallback(
    async (payload) => {
      if (!groupModal) return;
      setGroupModal((m) => ({ ...m, busy: true, error: "" }));
      try {
        if (groupModal.initialGroup) {
          await api.put(`/organizations/${groupModal.initialGroup.id}`, payload);
          notify("Group updated");
        } else {
          const res = await api.post("/organizations", payload);
          if (res.user) setUser(res.user);
          notify("Group submitted for Admin approval (jahnavi5@umd.edu)");
        }
        setGroupModal(null);
        await load();
      } catch (err) {
        if (!handleAuthError(err)) setGroupModal((m) => m && { ...m, busy: false, error: err.message });
      }
    },
    [groupModal, load, notify, setUser, handleAuthError],
  );

  const deleteGroup = useCallback(
    async (org) => {
      if (!window.confirm(`Delete "${org.name}" and all of its events?`)) return;
      try {
        const res = await api.del(`/organizations/${org.id}`);
        if (res.user) setUser(res.user);
        notify(`Deleted ${org.name}`);
        await load();
      } catch (err) {
        fail(err);
      }
    },
    [load, notify, setUser, fail],
  );

  // ---- Event Creation & Management ----
  const openEventModal = useCallback(
    (initialEvent = null, defaultOrgId = "") => {
      if (!initialEvent && postableOrgs.length === 0) {
        const hasPending = myOrganizations.some((o) => o.status === "pending");
        if (hasPending) {
          notify("Your group is awaiting approval from Admin (jahnavi5@umd.edu) before posting events.");
        } else {
          notify("Create a student group first (and get it approved) to publish events.");
          setGroupModal({ initialGroup: null, busy: false, error: "" });
        }
        return;
      }
      setEventModal({ initialEvent, defaultOrgId, busy: false, error: "" });
    },
    [postableOrgs.length, myOrganizations, notify],
  );

  const submitEventModal = useCallback(
    async (payload) => {
      if (!eventModal) return;
      setEventModal((m) => ({ ...m, busy: true, error: "" }));
      try {
        if (eventModal.initialEvent) {
          await api.put(`/events/${eventModal.initialEvent.id}`, payload);
          notify("Event updated");
        } else {
          await api.post("/events", payload);
          notify("Event published to TerpLink");
        }
        setEventModal(null);
        await load();
      } catch (err) {
        if (!handleAuthError(err)) setEventModal((m) => m && { ...m, busy: false, error: err.message });
      }
    },
    [eventModal, load, notify, handleAuthError],
  );

  const deleteEvent = useCallback(
    async (event) => {
      if (!window.confirm(`Delete the event "${event.title}"?`)) return;
      try {
        const res = await api.del(`/events/${event.id}`);
        if (res.user) setUser(res.user);
        notify(`Deleted "${event.title}"`);
        await load();
      } catch (err) {
        fail(err);
      }
    },
    [load, notify, setUser, fail],
  );

  const ctx = {
    user,
    events,
    organizations,
    myOrganizations,
    postableOrgs,
    pendingCount,
    loading,
    loadError,
    reload: load,
    search,
    setSearch,
    savedSet,
    rsvpMap,
    followSet,
    toggleSave,
    openRsvp,
    cancelRsvp,
    toggleFollow,
    openGroupModal,
    deleteGroup,
    openEventModal,
    deleteEvent,
    notify,
  };

  const isActive = (to) => (to === "/" ? location.pathname === "/" : location.pathname.startsWith(to));

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="TerpLink home">
          <TerpMark />
          <Wordmark />
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          <NavLink to="/" end className={({ isActive: a }) => (a ? "active" : "")}>
            Discover
          </NavLink>
          <NavLink to="/groups" className={({ isActive: a }) => (a ? "active" : "")}>
            Organizations
          </NavLink>
          <NavLink to="/calendar" className={({ isActive: a }) => (a ? "active" : "")}>
            My calendar
          </NavLink>
          {(user.isAdmin || user.role === "admin") && (
            <NavLink to="/admin" className={({ isActive: a }) => (a ? "active" : "")}>
              Admin{pendingCount > 0 ? ` (${pendingCount})` : ""}
            </NavLink>
          )}
        </nav>
        <div className="header-actions">
          <label className="desktop-search">
            <Icon name="search" size={18} />
            <input
              value={search}
              maxLength={80}
              onChange={(e) => {
                setSearch(e.target.value);
                if (location.pathname !== "/" && location.pathname !== "/discover") navigate("/discover");
              }}
              placeholder="Search events & groups"
              aria-label="Search events and groups"
            />
          </label>
          <button
            className="icon-button notification"
            aria-label="Notifications"
            onClick={() =>
              pendingCount > 0 && (user.isAdmin || user.role === "admin")
                ? navigate("/admin")
                : notify("You’re all caught up")
            }
          >
            <Icon name="bell" />
            <i />
          </button>
          <button className="avatar" aria-label="Open profile" onClick={() => navigate("/profile")}>
            {user.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" /> : user.initials}
          </button>
        </div>
      </header>

      <Outlet context={ctx} />

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {MOBILE_TABS.map((tab) => (
          <button
            key={tab.to}
            className={isActive(tab.to) ? "active" : ""}
            aria-current={isActive(tab.to) ? "page" : undefined}
            onClick={() => navigate(tab.to)}
          >
            <Icon name={tab.icon} />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={17} />
          {toast}
        </div>
      )}

      {rsvp && (
        <RsvpModal
          event={rsvp.event}
          passCode={rsvp.passCode}
          busy={rsvp.busy}
          error={rsvp.error}
          userName={user.name}
          onConfirm={confirmRsvp}
          onClose={closeRsvp}
        />
      )}

      {groupModal && (
        <GroupModal
          initialGroup={groupModal.initialGroup}
          busy={groupModal.busy}
          error={groupModal.error}
          onSubmit={submitGroupModal}
          onClose={() => setGroupModal(null)}
        />
      )}

      {eventModal && (
        <EventModal
          initialEvent={eventModal.initialEvent}
          availableOrgs={postableOrgs}
          defaultOrgId={eventModal.defaultOrgId}
          isAdmin={Boolean(user.isAdmin || user.role === "admin")}
          busy={eventModal.busy}
          error={eventModal.error}
          onSubmit={submitEventModal}
          onClose={() => setEventModal(null)}
        />
      )}
    </div>
  );
}
