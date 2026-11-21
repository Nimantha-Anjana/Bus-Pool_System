import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, ClipboardList, MapPin, UserRound, LogOut, BusFront, Bell, Inbox } from "lucide-react";
import { initials } from "../components/admin-ui/format";
import { fullName } from "../components/driver-tour/utils";
import { classify, getMyAssignments, getUnreadCount } from "../services/driver/portalService";
import { logoutDriver, restoreSession, useDriverSession } from "../services/driver/session";
import "../pages/driver/driver-portal.css";

const driverMenu = [
  { title: "Dashboard", path: "/driver/dashboard", icon: LayoutDashboard },
  { title: "My Tours", path: "/driver/tours", icon: ClipboardList },
  { title: "Tour Requests", path: "/driver/requests", icon: Inbox, badge: "pending" },
  { title: "Live Tracking", path: "/driver/tracking", icon: MapPin },
  { title: "My Profile", path: "/driver/profile", icon: UserRound },
];

const titles = [
  ["/driver/tours", "My Tours"], ["/driver/requests", "Tour Requests"], ["/driver/tracking", "Live Tracking"],
  ["/driver/profile", "My Profile"], ["/driver/dashboard", "Dashboard"],
];

// Driver Portal shell. Redirects to /driver/login when nobody is signed in.
function DriverLayout() {
  const { user, status } = useDriverSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ pending: 0, unread: 0 });
  const [leaving, setLeaving] = useState(false);

  useEffect(() => { restoreSession(); }, []);

  const refresh = useCallback(async () => {
    try {
      const [list, unread] = await Promise.all([getMyAssignments(), getUnreadCount()]);
      setCounts({ pending: list.filter((a) => classify(a) === "request").length, unread });
    } catch { /* badges are optional */ }
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    refresh();
    window.addEventListener("driver:refresh", refresh);
    return () => window.removeEventListener("driver:refresh", refresh);
  }, [user, location.pathname, refresh]);

  const logout = async () => {
    setLeaving(true);
    await logoutDriver();
    navigate("/driver/login", { replace: true });
  };

  if (status !== "ready") return <div className="dp-boot">Loading…</div>;
  if (!user) return <Navigate to="/driver/login" replace state={{ from: location.pathname }} />;

  const name = fullName(user);
  const title = titles.find(([p]) => location.pathname.startsWith(p))?.[1] || "Driver Portal";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><BusFront size={25} /></div>
          <div><h5>BusPool</h5><span>Driver Portal</span></div>
        </div>

        <div className="sidebar-label">DRIVER MENU</div>
        <nav className="sidebar-nav">
          {driverMenu.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.title} to={item.path} className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
                <Icon size={19} />
                <span>{item.title}</span>
                {item.badge === "pending" && counts.pending > 0 && <span className="dp-link-badge">{counts.pending}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="profile-mini">
            <div className="avatar">{initials(name)}</div>
            <div><strong>{name}</strong><small>Driver</small></div>
          </div>
          <button className="logout-button" type="button" onClick={logout} disabled={leaving}>
            <LogOut size={18} /><span>{leaving ? "Signing out…" : "Logout"}</span>
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div><span className="topbar-subtitle">BUS POOL MANAGEMENT</span><h6>{title}</h6></div>
          <div className="topbar-actions">
            <Link className="icon-button dp-bell" to="/driver/dashboard#notifications" aria-label="Notifications">
              <Bell size={20} />
              {counts.unread > 0 && <span className="dp-bell-count">{counts.unread > 9 ? "9+" : counts.unread}</span>}
            </Link>
            <div className="topbar-user">
              <div className="avatar">{initials(name)}</div>
              <div><strong>{name}</strong><small>Driver Account</small></div>
            </div>
            <button type="button" className="icon-button dp-mobile-logout" aria-label="Logout" onClick={logout} disabled={leaving}><LogOut size={19} /></button>
          </div>
        </header>

        <section className="page-content"><Outlet /></section>
      </main>
    </div>
  );
}

export default DriverLayout;
