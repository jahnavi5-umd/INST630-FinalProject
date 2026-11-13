import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";

export default function Profile() {
  const navigate = useNavigate();
  const { user, myOrganizations, pendingCount, openGroupModal, openEventModal, notify } = useOutletContext();
  const { logout, handleAuthError } = useAuth();
  const [busy, setBusy] = useState(false);

  const isAdmin = Boolean(user.isAdmin || user.role === "admin");

  const logoutEverywhere = async () => {
    setBusy(true);
    try {
      await api.post("/auth/logout-all");
    } catch (err) {
      handleAuthError(err);
    } finally {
      await logout();
    }
  };

  return (
    <main className="page">
      <section className="profile-card">
        <div className="profile-avatar" aria-hidden="true">
          {user.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" /> : user.initials}
        </div>
        <div>
          <p className="eyebrow">{isAdmin ? "TERPLINK APP ADMIN" : "UMD STUDENT"}</p>
          <h1>{user.name}</h1>
          <p className="profile-email">{user.email}</p>
          <span className="verified-pill">
            <Icon name="shield" size={13} />{" "}
            {isAdmin ? "Administrator · Verified UMD account" : "Verified University of Maryland account"}
          </span>
        </div>
      </section>

      <section className="profile-stats">
        <div>
          <strong>{user.rsvps.length}</strong>
          <span>Going</span>
        </div>
        <div>
          <strong>{user.savedEvents.length}</strong>
          <span>Saved</span>
        </div>
        <div>
          <strong>{user.followedOrgs.length}</strong>
          <span>Groups</span>
        </div>
      </section>

      {isAdmin && (
        <section className="admin-callout">
          <div>
            <p className="eyebrow">ADMINISTRATION · {user.email.toUpperCase()}</p>
            <h2>Group Approval & Campus Management</h2>
            <p>
              Review and approve student organization creation requests and manage all campus groups & events.
            </p>
          </div>
          <button className="primary-button admin-open-btn" onClick={() => navigate("/admin")}>
            Open Admin Portal
            {pendingCount > 0 && <span className="pending-pill">{pendingCount} pending</span>}
            <Icon name="arrow" size={17} />
          </button>
        </section>
      )}

      <section className="settings-list">
        {isAdmin && (
          <button onClick={() => navigate("/admin")} className="admin-link-row">
            <Icon name="shield" size={19} />
            <span>
              Admin Dashboard — Approve Group Requests
              {pendingCount > 0 ? ` (${pendingCount} pending)` : ""}
            </span>
            <Icon name="chevron" size={18} />
          </button>
        )}
        <button onClick={() => navigate("/groups")}>
          <Icon name="users" size={19} />
          <span>My Groups & Events ({myOrganizations.length} created)</span>
          <Icon name="chevron" size={18} />
        </button>
        <button onClick={() => openGroupModal(null)}>
          <Icon name="plus" size={19} />
          <span>Request a new student group</span>
          <Icon name="chevron" size={18} />
        </button>
        <button onClick={() => openEventModal(null)}>
          <Icon name="calendar" size={19} />
          <span>Publish a campus event</span>
          <Icon name="chevron" size={18} />
        </button>
        <button onClick={() => notify("Event reminders are on")}>
          <Icon name="bell" size={19} />
          <span>Notifications</span>
          <Icon name="chevron" size={18} />
        </button>
        <button onClick={logout}>
          <Icon name="logout" size={19} />
          <span>Sign out</span>
          <Icon name="chevron" size={18} />
        </button>
        <button onClick={logoutEverywhere} disabled={busy} className="danger">
          <Icon name="shield" size={19} />
          <span>Sign out of all devices</span>
          <Icon name="chevron" size={18} />
        </button>
      </section>

      <p className="profile-foot">TerpLink · Built for Terps, by Terps.</p>
    </main>
  );
}
