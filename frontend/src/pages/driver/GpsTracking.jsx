import { Link } from "react-router-dom";
import { Crosshair, MapPinOff, Navigation, Radio, Square } from "lucide-react";
import { Alert, Button, EmptyState, FormField } from "../../components/admin-ui/ui";
import { formatDateTime } from "../../components/admin-ui/format";
import useGpsSharing from "./useGpsSharing";
import "../../components/driver-tour/driver-tour.css";
import "./driver-portal.css";

// "Live Tracking" - GPS sharing controls
export default function GpsTracking() {
  const g = useGpsSharing();
  const canSend = Boolean(g.config?.canSend);
  const ringClass = g.sharing ? "on" : canSend ? "" : "blocked";
  const Icon = g.sharing ? Radio : canSend ? Crosshair : MapPinOff;

  const title = g.sharing ? "Sharing your location" : canSend ? "Ready to share" : "GPS sharing unavailable";
  const text = g.sharing
    ? `Sending your position about every ${g.config?.recommendedIntervalSeconds || 15} seconds. Keep this page open.`
    : canSend ? "Tap start so the administrator can follow your bus on the live map."
    : "Sharing is only possible for a confirmed assignment while the administrator has started the tour.";

  return (
    <div>
      <div className="page-heading">
        <div><span className="eyebrow">LIVE TRACKING</span><h2>GPS Sharing</h2><p>Share your live location while a tour is running.</p></div>
      </div>

      {g.configError && <Alert onRetry={g.reload}>{g.configError}</Alert>}
      {g.error && <Alert type={g.error.startsWith("No connection") ? "info" : "error"}>{g.error}</Alert>}
      {g.simulated && <Alert type="info">Demo mode: using a simulated location because real GPS is not available.</Alert>}

      <div className="row g-4">
        <div className="col-12 col-xl-7">
          <div className="content-card mb-4">
            {g.loading ? <span className="bp-skeleton" style={{ width: "60%" }} /> : (
              <div className="dp-gps">
                <div className={`dp-gps-ring ${ringClass}`}><Icon size={34} /></div>
                <div className="dp-gps-body"><h5>{title}</h5><p>{text}</p></div>
                {g.sharing
                  ? <Button variant="danger" icon={Square} onClick={g.stop}>Stop sharing</Button>
                  : <Button icon={Navigation} disabled={!canSend} onClick={g.start}>Start sharing</Button>}
              </div>
            )}

            {canSend && g.config.assignments.length > 1 && (
              <div style={{ marginTop: 20 }}>
                <FormField as="select" label="Tour to track" value={g.assignmentId ?? ""} disabled={g.sharing}
                  onChange={(e) => g.setAssignmentId(Number(e.target.value))}>
                  {g.config.assignments.map((a) => <option key={a.assignmentId} value={a.assignmentId}>{a.tourCode}</option>)}
                </FormField>
              </div>
            )}
            {canSend && g.config.assignments.length === 1 && (
              <p className="bp-hint" style={{ marginTop: 16 }}>Tracking tour {g.config.assignments[0].tourCode} · <Link to={`/driver/tours/${g.config.assignments[0].assignmentId}`}>view details</Link></p>
            )}
          </div>

          <div className="content-card">
            <div className="card-heading"><div><h5>Live details</h5><p>What the administrator receives</p></div></div>
            {g.position ? (
              <dl className="bp-kv">
                <div><dt>Latitude</dt><dd>{g.position.latitude.toFixed(6)}</dd></div>
                <div><dt>Longitude</dt><dd>{g.position.longitude.toFixed(6)}</dd></div>
                <div><dt>Accuracy</dt><dd>{g.position.accuracy != null ? `${Math.round(g.position.accuracy)} m` : "—"}</dd></div>
                <div><dt>Speed</dt><dd>{g.position.speed != null ? `${Math.round(g.position.speed * 3.6)} km/h` : "—"}</dd></div>
                <div><dt>Last sent</dt><dd>{g.lastSentAt ? formatDateTime(g.lastSentAt) : "—"}</dd></div>
                <div><dt>Points sent</dt><dd>{g.sentCount}{g.buffered ? ` · ${g.buffered} waiting (offline)` : ""}</dd></div>
              </dl>
            ) : <EmptyState title="No position yet" text="Start sharing to see your live coordinates here." />}
          </div>
        </div>

        <div className="col-12 col-xl-5">
          <div className="content-card">
            <div className="card-heading"><div><h5>Good to know</h5></div></div>
            <ul className="dp-tips">
              <li>Allow location access when your browser asks.</li>
              <li>Keep this page open and the screen on - the browser cannot track in the background.</li>
              <li>If you lose signal, points are saved and sent automatically afterwards.</li>
              <li>Sharing stops by itself when the tour is completed or cancelled.</li>
              <li>Location sharing needs a secure (HTTPS) connection.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
