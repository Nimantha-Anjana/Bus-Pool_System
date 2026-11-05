import {
  BusFront,
  CalendarDays,
  ClipboardList,
  MapPin,
} from "lucide-react";


function DriverDashboard() {
  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">DRIVER OVERVIEW</span>
          <h2>My Dashboard</h2>
          <p>Welcome to your driver portal.</p>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-icon blue"><ClipboardList size={22} /></div>
            <h3>08</h3>
            <h6>Assigned Tours</h6>
            <p>Your total tour assignments</p>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-icon orange"><CalendarDays size={22} /></div>
            <h3>02</h3>
            <h6>Pending Requests</h6>
            <p>Waiting for your response</p>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-icon green"><BusFront size={22} /></div>
            <h3>06</h3>
            <h6>Completed Tours</h6>
            <p>Successfully completed</p>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-icon purple"><MapPin size={22} /></div>
            <h3>Off</h3>
            <h6>GPS Tracking</h6>
            <p>Not currently tracking</p>
          </div>
        </div>
      </div>

      <div className="content-card">
        <div className="card-heading">
          <div>
            <h5>Upcoming Tour</h5>
            <p>Your next scheduled assignment</p>
          </div>
          <span className="status-badge planned">Upcoming</span>
        </div>

        <div className="upcoming-tour">
          <div className="upcoming-tour-icon">
            <BusFront size={28} />
          </div>
          <div>
            <h4>Southern Tour</h4>
            <p>Colombo → Galle</p>
            <span><CalendarDays size={15} /> November 05, 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DriverDashboard;