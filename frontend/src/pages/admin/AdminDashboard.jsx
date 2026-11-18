import { Link, useNavigate } from "react-router-dom";
import {
  Activity, BusFront, CalendarClock, CircleCheck, ClipboardList, Clock3, Link2, UserRound,
} from "lucide-react";
import { Alert, DataTable, EmptyState, StatusBadge } from "../../components/admin-ui/ui";
import { useAsync } from "../../components/admin-ui/hooks";
import { formatDate, timeAgo } from "../../components/admin-ui/format";
import { getDashboard, getRecentActivities, getUpcomingTours } from "../../services/admin/dashboardService";
import { CHART_COLORS, ColumnChart, DonutChart, HorizontalBars } from "./dashboard/charts";

function StatCard({ title, value, note, icon: Icon, color, to, loading }) {
  const body = (
    <div className="stat-card bp-stat">
      <div className="stat-card-top">
        <div className={`stat-icon ${color}`}><Icon size={22} /></div>
      </div>
      <h3>{loading ? <span className="bp-skeleton" style={{ width: 54, height: 28 }} /> : value}</h3>
      <h6>{title}</h6>
      <p>{note}</p>
    </div>
  );
  return to ? <Link to={to} className="bp-stat-link">{body}</Link> : body;
}

function CardHeading({ title, subtitle, action }) {
  return (
    <div className="card-heading">
      <div><h5>{title}</h5><p>{subtitle}</p></div>
      {action}
    </div>
  );
}

const activityTitle = (a) => a.description || a.action;
const actorName = (a) => [a.user?.firstName, a.user?.lastName].filter(Boolean).join(" ") || "System";

function AdminDashboard() {
  const navigate = useNavigate();
  const dashboard = useAsync(getDashboard, []);
  const tours = useAsync(() => getUpcomingTours(5), []);
  const activities = useAsync(() => getRecentActivities(6), []);

  const d = dashboard.data;
  const busy = dashboard.loading && !d;

  const tourColumns = [
    { key: "tourName", header: "Tour", render: (t) => (<div className="text-start"><strong>{t.tourName}</strong><small className="table-subtitle">{t.tourCode}</small></div>) },
    { key: "destination", header: "Destination" },
    { key: "startAt", header: "Start date", render: (t) => formatDate(t.startAt) },
    { key: "status", header: "Status", render: (t) => <StatusBadge status={t.status} /> },
  ];

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
          {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
        </div>
      </div>

      {dashboard.error && <Alert onRetry={dashboard.reload}>{dashboard.error}</Alert>}

      <div className="row g-4 mb-4">
        <div className="col-12 col-sm-6 col-xl-4"><StatCard loading={busy} title="Total Buses" value={d?.summary.totalBuses} note="Registered buses" icon={BusFront} color="blue" to="/admin/buses" /></div>
        <div className="col-12 col-sm-6 col-xl-4"><StatCard loading={busy} title="Available Buses" value={d?.summary.availableBuses} note="Ready for allocation" icon={CircleCheck} color="green" to="/admin/buses" /></div>
        <div className="col-12 col-sm-6 col-xl-4"><StatCard loading={busy} title="Assigned Buses" value={d?.buses.assigned} note="On confirmed / pending tours" icon={Link2} color="purple" to="/admin/buses" /></div>
        <div className="col-12 col-sm-6 col-xl-4"><StatCard loading={busy} title="Total Drivers" value={d?.summary.totalDrivers} note="Registered drivers" icon={UserRound} color="orange" to="/admin/drivers" /></div>
        <div className="col-12 col-sm-6 col-xl-4"><StatCard loading={busy} title="Total Tours" value={d?.summary.totalTours} note="All registered tours" icon={ClipboardList} color="blue" to="/admin/tours" /></div>
        <div className="col-12 col-sm-6 col-xl-4"><StatCard loading={busy} title="Upcoming Tours" value={d?.tours.planned} note="Planned, not started yet" icon={CalendarClock} color="green" to="/admin/tours" /></div>
      </div>

      {/* Statistics charts */}
      <div className="row g-4 mb-4">
        <div className="col-12 col-md-6 col-xl-4">
          <div className="content-card h-100">
            <CardHeading title="Bus Status" subtitle="Fleet by availability" />
            {busy ? <span className="bp-skeleton" style={{ height: 140 }} /> : d && (
              <DonutChart
                centerLabel="Buses" centerValue={d.buses.total}
                segments={[
                  { label: "Available", value: d.buses.available, color: CHART_COLORS.green },
                  { label: "Assigned", value: d.buses.assigned, color: CHART_COLORS.blue },
                  { label: "Maintenance", value: d.buses.maintenance, color: CHART_COLORS.orange },
                  { label: "Inactive", value: d.buses.inactive, color: CHART_COLORS.gray },
                ]}
              />
            )}
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-4">
          <div className="content-card h-100">
            <CardHeading title="Tours by Status" subtitle="All tours in the system" />
            {busy ? <span className="bp-skeleton" style={{ height: 140 }} /> : d && (
              <ColumnChart
                items={[
                  { label: "Planned", value: d.tours.planned, color: CHART_COLORS.orange },
                  { label: "Ongoing", value: d.tours.ongoing, color: CHART_COLORS.blue },
                  { label: "Completed", value: d.tours.completed, color: CHART_COLORS.green },
                  { label: "Cancelled", value: d.tours.cancelled, color: CHART_COLORS.red },
                ]}
              />
            )}
          </div>
        </div>
        <div className="col-12 col-xl-4">
          <div className="content-card h-100">
            <CardHeading title="Top Owners" subtitle="Owners with the most buses" />
            {busy ? <span className="bp-skeleton" style={{ height: 140 }} /> : d && (
              d.topOwnersByBuses.length
                ? <HorizontalBars items={d.topOwnersByBuses.map((o) => ({ label: o.ownerName, value: o.busCount }))} unit=" buses" />
                : <EmptyState title="No data yet" />
            )}
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-7">
          <div className="content-card h-100">
            <CardHeading title="Upcoming Tours" subtitle="Next planned tours" action={<button className="text-action" type="button" onClick={() => navigate("/admin/tours")}>View all</button>} />
            {tours.error && <Alert onRetry={tours.reload}>{tours.error}</Alert>}
            <DataTable
              columns={tourColumns} rows={tours.data || []} loading={tours.loading && !tours.data} skeletonRows={3}
              empty={!tours.error && <EmptyState title="No upcoming tours" text="Planned tours will show up here." />}
            />
          </div>
        </div>

        <div className="col-12 col-xl-5">
          <div className="content-card h-100">
            <CardHeading title="Recent Activities" subtitle="Latest actions in the system" />
            {activities.error && <Alert onRetry={activities.reload}>{activities.error}</Alert>}
            {activities.loading && !activities.data && [0, 1, 2, 3].map((i) => <span key={i} className="bp-skeleton" style={{ margin: "18px 0" }} />)}
            {activities.data?.length === 0 && <EmptyState title="No activity yet" />}
            <ul className="bp-activity">
              {(activities.data || []).map((a) => (
                <li key={a.id}>
                  <div className="bp-activity-icon"><Activity size={15} /></div>
                  <div>
                    <strong>{activityTitle(a)}</strong>
                    <small>{actorName(a)} · {timeAgo(a.createdAt)}</small>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
