import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  MapPin,
  UserRound,
  LogOut,
  BusFront,
} from "lucide-react";

const driverMenu = [
  { title: "Dashboard", path: "/driver/dashboard", icon: LayoutDashboard },
  { title: "My Tours", path: "/driver/tours", icon: ClipboardList },
  { title: "Tour Requests", path: "/driver/requests", icon: BusFront },
  { title: "Live Tracking", path: "/driver/tracking", icon: MapPin },
  { title: "My Profile", path: "/driver/profile", icon: UserRound },
];

function DriverLayout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <BusFront size={25} />
          </div>
          <div>
            <h5>BusPool</h5>
            <span>Driver Portal</span>
          </div>
        </div>

        <div className="sidebar-label">DRIVER MENU</div>

        <nav className="sidebar-nav">
          {driverMenu.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.title}
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? "active" : ""}`
                }
              >
                <Icon size={19} />
                <span>{item.title}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="profile-mini">
            <div className="avatar">DR</div>
            <div>
              <strong>Driver Account</strong>
              <small>Driver</small>
            </div>
          </div>
          <button className="logout-button" type="button">
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="topbar-subtitle">BUS POOL MANAGEMENT</span>
            <h6>Driver Portal</h6>
          </div>

          <div className="topbar-actions">
            <div className="topbar-user">
              <div className="avatar">DR</div>
              <div>
                <strong>Driver</strong>
                <small>Driver Account</small>
              </div>
            </div>
          </div>
        </header>

        <section className="page-content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}

export default DriverLayout;