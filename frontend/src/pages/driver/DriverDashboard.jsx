import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Bell, BusFront, CalendarDays, CheckCheck, ClipboardList, Inbox, MapPin } from "lucide-react";
import { Alert, Button, EmptyState, useToast } from "../../components/admin-ui/ui";
import { useAsync } from "../../components/admin-ui/hooks";
import { formatDateTime, timeAgo } from "../../components/admin-ui/format";
import { formatRange } from "../../components/driver-tour/utils";
import { getDriverOverview, markAllNotificationsRead, markNotificationRead } from "../../services/driver/portalService";
import { getErrorMessage } from "../../services/admin/http";
import { announceChange } from "./parts";
import "./driver-portal.css";

const pad = (n) => String(n).padStart(2, "0");

export default function DriverDashboard() {
  const navigate = useNavigate();
  const [notify, toastNode] = useToast();
  const { data, loading, error, reload } = useAsync(getDriverOverview, []);

  const readAll = async () => {
    try { await markAllNotificationsRead(); announceChange(); reload(); }
    catch (e) { notify(getErrorMessage(e), "error"); }
  };
  const openNote = async (n) => {
    if (!n.isRead) { try { await markNotificationRead(n.id); announceChange(); } catch { /* ignore */ } }
    if (n.relatedType === "assignment" && n.relatedId) navigate(`/driver/tours/${n.relatedId}`);
    else reload();
  };

  const c = data?.counts;
  const stats = [
    { label: "Assigned Tours", value: c?.assigned, text: "Your total tour assignments", icon: ClipboardList, color: "blue", to: "/driver/tours" },
    { label: "Pending Requests", value: c?.pending, text: "Waiting for your response", icon: Inbox, color: "orange", to: "/driver/requests" },
    { label: "Upcoming Tours", value: c?.upcoming, text: "Confirmed or awaiting owner", icon: CalendarDays, color: "purple", to: "/driver/tours?tab=upcoming" },
    { label: "Completed Tours", value: c?.completed, text: "Successfully completed", icon: BusFront, color: "green", to: "/driver/tours?tab=completed" },
  ];
  const current = data?.currentTour;
  const upcoming = [...(data?.groups.upcoming || []), ...(data?.groups.awaiting || [])].slice(0, 4);
  const requests = (data?.groups.request || []).slice(0, 3);

  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">DRIVER OVERVIEW</span>
          <h2>My Dashboard</h2>
          <p>Your tours, requests and notifications at a glance.</p>
        </div>
      </div>

      {error && <Alert onRetry={reload}>{error}</Alert>}

      <div className="row g-4 mb-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div className="col-12 col-sm-6 col-xl-3" key={s.label}>
              <Link to={s.to} className="bp-stat-link">
                <div className="stat-card bp-stat">
                  <div className={`stat-icon ${s.color}`}><Icon size={22} /></div>
                  <h3>{loading && !data ? "–" : pad(s.value ?? 0)}</h3>
                  <h6>{s.label}</h6>
                  <p>{s.text}</p>
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-7">
          <div className="content-card mb-4">
            <div className="card-heading"><div><h5>Current Tour</h5><p>The tour you are driving right now</p></div></div>
            {current ? (
              <div className="dp-current">
                <span className="dp-live"><i /> IN PROGRESS</span>
                <div>
                  <h4>{current.tour.tourName}</h4>
                  <p>{current.tour.startLocation} → {current.tour.destination}</p>
                  <p style={{ marginTop: 6 }}>{formatRange(current.assignedStartAt, current.assignedEndAt)}{current.bus ? ` · ${current.bus.registrationNumber}` : ""}</p>
                </div>
                <div className="dp-current-actions">
                  <Button icon={MapPin} onClick={() => navigate("/driver/tracking")}>{data.gps?.canSend ? "Share live location" : "GPS controls"}</Button>
                  <Button variant="outline" onClick={() => navigate(`/driver/tours/${current.id}`)}>Tour details</Button>
                </div>
              </div>
            ) : (
              <EmptyState title="No tour in progress" text="When an administrator starts your confirmed tour it will appear here." />
            )}
          </div>

          <div className="content-card">
            <div className="card-heading">
              <div><h5>Upcoming Tours</h5><p>Your next scheduled assignments</p></div>
              <Link className="text-action" to="/driver/tours?tab=upcoming">View all</Link>
            </div>
            {upcoming.length === 0 ? <EmptyState title="Nothing scheduled" text="Accepted tours will show up here." /> : (
              <ul className="dp-list">
                {upcoming.map((a) => (
                  <li key={a.id}>
                    <div className="dp-list-icon"><BusFront size={18} /></div>
                    <div className="dp-list-body">
                      <Link to={`/driver/tours/${a.id}`}><strong>{a.tour.tourName}</strong></Link>
                      <small>{a.tour.startLocation} → {a.tour.destination} · {formatDateTime(a.assignedStartAt)}</small>
                    </div>
                    <span className={`bp-badge ${a.assignmentStatus === "confirmed" ? "green" : "blue"}`}>{a.assignmentStatus === "confirmed" ? "Confirmed" : "Awaiting owner"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="col-12 col-xl-5">
          <div className="content-card mb-4">
            <div className="card-heading">
              <div><h5>Pending Requests</h5><p>Please accept or reject</p></div>
              <Link className="text-action" to="/driver/requests">Open <ArrowRight size={13} /></Link>
            </div>
            {requests.length === 0 ? <EmptyState title="No pending requests" /> : (
              <ul className="dp-list">
                {requests.map((a) => (
                  <li key={a.id}>
                    <div className="dp-list-icon" style={{ background: "#fff4df", color: "#c18118" }}><Inbox size={18} /></div>
                    <div className="dp-list-body">
                      <Link to={`/driver/tours/${a.id}`}><strong>{a.tour.tourName}</strong></Link>
                      <small>{formatRange(a.assignedStartAt, a.assignedEndAt)}</small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="content-card" id="notifications">
            <div className="card-heading">
              <div><h5>Recent Notifications</h5><p>{data?.unread ? `${data.unread} unread` : "You are all caught up"}</p></div>
              {data?.unread > 0 && <button type="button" className="text-action" style={{ border: 0, background: "none" }} onClick={readAll}><CheckCheck size={14} /> Mark all read</button>}
            </div>
            {!data?.notifications.length ? <EmptyState title="No notifications yet" /> : (
              <ul className="dp-list">
                {data.notifications.map((n) => (
                  <li key={n.id} className={`dp-note-item ${n.isRead ? "" : "unread"}`}>
                    <div className="dp-list-icon"><Bell size={17} /></div>
                    <div className="dp-list-body" style={{ cursor: "pointer" }} onClick={() => openNote(n)}>
                      <strong>{n.title}</strong>
                      <small>{n.message}</small>
                      <small>{timeAgo(n.createdAt)}</small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      {toastNode}
    </div>
  );
}
