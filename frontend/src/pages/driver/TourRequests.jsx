import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Alert, EmptyState, useToast } from "../../components/admin-ui/ui";
import { useAsync } from "../../components/admin-ui/hooks";
import { classify, getMyAssignments } from "../../services/driver/portalService";
import { AssignmentCard, RespondActions } from "./parts";
import "./driver-portal.css";

export default function TourRequests() {
  const [notify, toastNode] = useToast();
  const { data, loading, error, reload } = useAsync(() => getMyAssignments(), []);

  const by = (kind) => (data || []).filter((a) => classify(a) === kind).sort((x, y) => new Date(x.assignedStartAt) - new Date(y.assignedStartAt));
  const requests = by("request");
  const awaiting = by("awaiting");
  const rejected = (data || []).filter((a) => a.assignmentStatus === "rejected" || (a.driverStatus === "rejected"));

  return (
    <div>
      <div className="page-heading">
        <div><span className="eyebrow">TOUR REQUESTS</span><h2>Tour Requests</h2><p>Accept or reject the tours the administrator assigned to you.</p></div>
      </div>
      {error && <Alert onRetry={reload}>{error}</Alert>}

      <div className="content-card mb-4">
        <div className="card-heading"><div><h5>Waiting for your answer</h5><p>{requests.length} request{requests.length === 1 ? "" : "s"}</p></div></div>
        {loading && !data ? <span className="bp-skeleton" style={{ width: "50%" }} /> : requests.length === 0 ? (
          <EmptyState title="No pending requests" text="New assignments will appear here." />
        ) : (
          <div className="dp-grid">
            {requests.map((a) => (
              <AssignmentCard key={a.id} a={a}>
                <Link className="text-action" to={`/driver/tours/${a.id}`}>View full details <ArrowRight size={13} /></Link>
                <RespondActions assignment={a} notify={notify} onDone={reload} block />
              </AssignmentCard>
            ))}
          </div>
        )}
      </div>

      {awaiting.length > 0 && (
        <div className="content-card mb-4">
          <div className="card-heading"><div><h5>Accepted - waiting for the bus owner</h5><p>No action needed</p></div></div>
          <div className="dp-grid">{awaiting.map((a) => <AssignmentCard key={a.id} a={a} to={`/driver/tours/${a.id}`} />)}</div>
        </div>
      )}

      {rejected.length > 0 && (
        <div className="content-card">
          <div className="card-heading"><div><h5>Rejected by you</h5><p>For your records</p></div></div>
          <div className="dp-grid">{rejected.map((a) => <AssignmentCard key={a.id} a={a} to={`/driver/tours/${a.id}`} />)}</div>
        </div>
      )}
      {toastNode}
    </div>
  );
}
