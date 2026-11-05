import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  BusFront,
  Users,
  UserRound,
  MapPin,
  ClipboardList,
  Settings,
  Bell,
  LogOut,
} from "lucide-react";

const menuItems = [
  { title: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Bus Owners", path: "/admin/owners", icon: Users },
  { title: "Buses", path: "/admin/buses", icon: BusFront },
  { title: "Drivers", path: "/admin/drivers", icon: UserRound },
  { title: "Tours", path: "/admin/tours", icon: ClipboardList },
  { title: "Assignments", path: "/admin/assignments", icon: ClipboardList },
  { title: "Live Tracking", path: "/admin/tracking", icon: MapPin },
  { title: "Settings", path: "/admin/settings", icon: Settings },
];

function AdminLayout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <BusFront size={25} />
          </div>
          <div>
            <h5>BusPool</h5>
            <span>Management System</span>
          </div>
        </div>

        <div className="sidebar-label">MAIN MENU</div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => {
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
            <div className="avatar">AD</div>
            <div>
              <strong>Administrator</strong>
              <small>System Admin</small>
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
            <h6>Admin Panel</h6>
          </div>

          <div className="topbar-actions">
            <button className="icon-button" type="button" aria-label="Notifications">
              <Bell size={20} />
              <span className="notification-dot"></span>
            </button>
            <div className="topbar-user">
              <div className="avatar">AD</div>
              <div>
                <strong>Admin</strong>
                <small>Administrator</small>
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

export default AdminLayout;