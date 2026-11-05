import {
  BusFront,
  Users,
  UserRound,
  ClipboardList,
  ArrowUpRight,
  Clock3,
  MapPin,
} from "lucide-react";

const stats = [
  {
    title: "Total Buses",
    value: "24",
    note: "Registered buses",
    icon: BusFront,
    color: "blue",
  },
  {
    title: "Total Drivers",
    value: "18",
    note: "Active drivers",
    icon: Users,
    color: "green",
  },
  {
    title: "Total Tours",
    value: "36",
    note: "All registered tours",
    icon: ClipboardList,
    color: "purple",
  },
  {
    title: "Bus Owners",
    value: "12",
    note: "Registered owners",
    icon: UserRound,
    color: "orange",
  },
];

function AdminDashboard() {
  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">OVERVIEW</span>
          <h2>Dashboard</h2>
          <p>Welcome back! Here is your bus pool system overview.</p>
        </div>

        <div className="date-label">
          <Clock3 size={16} />
          System Overview
        </div>
      </div>

      <div className="row g-4 mb-4">
        {stats.map((item) => {
          const Icon = item.icon;

          return (
            <div className="col-12 col-sm-6 col-xl-3" key={item.title}>
              <div className="stat-card">
                <div className="stat-card-top">
                  <div className={`stat-icon ${item.color}`}>
                    <Icon size={22} />
                  </div>
                  <ArrowUpRight size={18} className="stat-arrow" />
                </div>

                <h3>{item.value}</h3>
                <h6>{item.title}</h6>
                <p>{item.note}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-8">
          <div className="content-card">
            <div className="card-heading">
              <div>
                <h5>Recent Tours</h5>
                <p>Latest tour activities</p>
              </div>
              <button className="text-action" type="button">
                View all
              </button>
            </div>

            <div className="table-responsive">
              <table className="table custom-table align-middle">
                <thead>
                  <tr>
                    <th>Tour Name</th>
                    <th>Destination</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>Southern Tour</strong>
                      <small className="table-subtitle">TR-001</small>
                    </td>
                    <td>Galle</td>
                    <td>2026-11-05</td>
                    <td><span className="status-badge planned">Planned</span></td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Hill Country Tour</strong>
                      <small className="table-subtitle">TR-002</small>
                    </td>
                    <td>Nuwara Eliya</td>
                    <td>2026-11-08</td>
                    <td><span className="status-badge ongoing">Ongoing</span></td>
                  </tr>
                  <tr>
                    <td>
                      <strong>City Tour</strong>
                      <small className="table-subtitle">TR-003</small>
                    </td>
                    <td>Colombo</td>
                    <td>2026-11-12</td>
                    <td><span className="status-badge completed">Completed</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="content-card activity-card">
            <div className="card-heading">
              <div>
                <h5>Quick Overview</h5>
                <p>System activity summary</p>
              </div>
            </div>

            <div className="overview-item">
              <div className="overview-icon blue">
                <ClipboardList size={19} />
              </div>
              <div>
                <strong>Pending Assignments</strong>
                <small>Awaiting confirmation</small>
              </div>
              <span className="overview-number">05</span>
            </div>

            <div className="overview-item">
              <div className="overview-icon green">
                <BusFront size={19} />
              </div>
              <div>
                <strong>Available Buses</strong>
                <small>Ready for allocation</small>
              </div>
              <span className="overview-number">16</span>
            </div>

            <div className="overview-item">
              <div className="overview-icon purple">
                <MapPin size={19} />
              </div>
              <div>
                <strong>Active Tracking</strong>
                <small>Buses on active tours</small>
              </div>
              <span className="overview-number">03</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;