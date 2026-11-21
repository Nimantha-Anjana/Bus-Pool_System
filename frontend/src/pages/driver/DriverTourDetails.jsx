import { Link, useNavigate, useParams } from "react-router-dom";
import { MapPin, Navigation } from "lucide-react";
import { Alert, EmptyState, PageHeader, useToast } from "../../components/admin-ui/ui";
import { useAsync } from "../../components/admin-ui/hooks";
import { formatDate, formatDateTime } from "../../components/admin-ui/format";
import { TourTypeBadge } from "../../components/driver-tour/badges";
import RouteTimeline from "../../components/driver-tour/RouteTimeline";
import { mapsLink } from "../../components/driver-tour/utils";
import { classify, getMyAssignment } from "../../services/driver/portalService";
import { RespondActions, stateBadge } from "./parts";
import "../../components/driver-tour/driver-tour.css";
import "./driver-portal.css";

// :id is the ASSIGNMENT id (what the driver API uses)
export default function DriverTourDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [notify, toastNode] = useToast();
  const { data: a, loading, error, reload } = useAsync(() => getMyAssignment(id), [id]);
  const back = () => navigate("/driver/tours");

  if (loading && !a) return <div className="content-card"><span className="bp-skeleton" style={{ width: "40%", marginBottom: 14 }} /><span className="bp-skeleton" style={{ width: "80%" }} /></div>;
  if (error || !a) {
    return (
      <div>
        <PageHeader eyebrow="MY TOURS" title="Tour Details" onBack={back} backLabel="Back to my tours" />
        <div className="content-card"><Alert onRetry={reload}>{error || "Tour not found."}</Alert><EmptyState title="Tour not available" /></div>
      </div>
    );
  }

  const t = a.tour;
  const kind = classify(a);
  const firstStop = t.stops?.[0];
  const navLink = mapsLink(firstStop?.latitude, firstStop?.longitude, t.startLocation);

  return (
    <div>
      <PageHeader eyebrow={t.tourCode} title={t.tourName} onBack={back} backLabel="Back to my tours"
        actions={kind === "request" ? <RespondActions assignment={a} notify={notify} onDone={reload} /> : null} />

      {kind === "request" && <Alert type="info">This tour is waiting for your answer. Accept it to confirm, or reject it with a reason.</Alert>}
      {kind === "awaiting" && <Alert type="info">You accepted this tour. It becomes confirmed once the bus owner accepts too.</Alert>}
      {a.assignmentStatus === "rejected" && a.rejectionReason && <Alert>You rejected this tour: {a.rejectionReason}</Alert>}

      <div className="dt-layout">
        <div className="dt-stack">
          <div className="content-card">
            <div className="dt-hero-badges" style={{ marginBottom: 18 }}>{stateBadge(a)}<TourTypeBadge type={t.tourType} /></div>
            <dl className="bp-kv">
              <div><dt>From</dt><dd>{t.startLocation}</dd></div>
              <div><dt>To</dt><dd>{t.destination}</dd></div>
              <div><dt>Start</dt><dd>{formatDateTime(a.assignedStartAt)}</dd></div>
              <div><dt>End</dt><dd>{formatDateTime(a.assignedEndAt)}</dd></div>
              <div><dt>Pickup time</dt><dd>{t.pickupAt ? formatDateTime(t.pickupAt) : "—"}</dd></div>
              <div><dt>Passengers</dt><dd>{t.passengerCount}</dd></div>
              {t.description && <div className="full"><dt>Description</dt><dd>{t.description}</dd></div>}
              {t.specialNotes && <div className="full"><dt>Special notes</dt><dd><p className="dt-note">{t.specialNotes}</p></dd></div>}
            </dl>
          </div>

          <div className="content-card">
            <h6 className="dt-section-title">Route & stops</h6>
            <p className="dt-section-sub">Pickup, stops and drop-off in order.</p>
            {t.stops?.length ? <RouteTimeline stops={t.stops} /> : <EmptyState title="No stops added" />}
          </div>
        </div>

        <div className="dt-stack">
          {a.bus && (
            <div className="content-card">
              <h6 className="dt-section-title">Your bus</h6>
              <ul className="dt-side-list">
                <li><span>Registration</span><strong>{a.bus.registrationNumber}</strong></li>
                <li><span>Name</span><strong>{a.bus.busName || "—"}</strong></li>
                <li><span>Type</span><strong>{a.bus.busType || "—"}</strong></li>
                <li><span>Seats</span><strong>{a.bus.seatingCapacity}</strong></li>
              </ul>
            </div>
          )}

          <div className="content-card">
            <h6 className="dt-section-title">Actions</h6>
            <div className="dt-actions-row" style={{ flexDirection: "column" }}>
              {kind === "current" && <Link className="bp-btn bp-btn-primary" to="/driver/tracking"><MapPin size={16} />Share live location</Link>}
              {navLink && <a className="bp-btn bp-btn-outline" href={navLink} target="_blank" rel="noreferrer"><Navigation size={16} />Navigate to pickup</a>}
            </div>
            <ul className="dt-side-list" style={{ marginTop: 14 }}>
              <li><span>Assigned</span><strong>{formatDate(a.createdAt)}</strong></li>
              <li><span>Owner response</span><strong style={{ textTransform: "capitalize" }}>{a.ownerStatus}</strong></li>
              <li><span>Your response</span><strong style={{ textTransform: "capitalize" }}>{a.driverStatus}</strong></li>
            </ul>
          </div>
        </div>
      </div>
      {toastNode}
    </div>
  );
}
