import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Pencil, Play, Trash2, CircleCheck, Ban } from "lucide-react";
import { Alert, Button, ConfirmDialog, EmptyState, Modal, PageHeader, useToast } from "../../../components/admin-ui/ui";
import { useAsync } from "../../../components/admin-ui/hooks";
import { formatDate, formatDateTime } from "../../../components/admin-ui/format";
import { AssignmentBadge, TourStatusBadge, TourTypeBadge } from "../../../components/driver-tour/badges";
import RouteTimeline from "../../../components/driver-tour/RouteTimeline";
import { fullName } from "../../../components/driver-tour/utils";
import { deleteTour, getTour, setTourStatus } from "../../../services/admin/toursService";
import { listAllDrivers } from "../../../services/admin/driversService";
import { getErrorMessage } from "../../../services/admin/http";
import "../../../components/driver-tour/driver-tour.css";

const ACTIONS = {
  ongoing: { label: "Start tour", icon: Play, variant: "primary", title: "Start this tour?", text: "The tour becomes ongoing. Confirmed drivers can then share their GPS location. The dates can no longer be changed." },
  completed: { label: "Mark completed", icon: CircleCheck, variant: "primary", title: "Mark tour as completed?", text: "Confirmed assignments are completed and pending ones lapse. This cannot be undone." },
  cancelled: { label: "Cancel tour", icon: Ban, variant: "danger", title: "Cancel this tour?", text: "All pending and confirmed assignments are cancelled and the buses are released. This cannot be undone." },
};
const NEXT = { planned: ["ongoing", "cancelled"], ongoing: ["completed", "cancelled"], completed: [], cancelled: [] };

export default function TourDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [notify, toastNode] = useToast();

  const tour = useAsync(() => getTour(id), [id]);
  const drivers = useAsync(listAllDrivers, []); // only to show driver names on the assignments

  const [pending, setPending] = useState(null); // status waiting for confirmation
  const [working, setWorking] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // message coming from the create / edit form
  useEffect(() => {
    if (location.state?.notice) {
      notify(location.state.notice);
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const driverName = useMemo(() => {
    const map = new Map((drivers.data || []).map((d) => [d.id, fullName(d.user)]));
    return (driverId) => map.get(driverId) || `Driver #${driverId}`;
  }, [drivers.data]);

  const applyStatus = async () => {
    setWorking(true);
    setDialogError("");
    try {
      const result = await setTourStatus(id, pending);
      setPending(null);
      notify(result.warning || `Tour is now ${pending}.`, result.warning ? "error" : "success");
      tour.reload();
    } catch (e) {
      setDialogError(getErrorMessage(e));
    } finally {
      setWorking(false);
    }
  };

  const confirmDelete = async () => {
    setWorking(true);
    setDialogError("");
    try {
      await deleteTour(id);
      navigate("/admin/tours");
    } catch (e) {
      setDialogError(getErrorMessage(e));
    } finally {
      setWorking(false);
    }
  };

  const back = () => navigate("/admin/tours");
  const t = tour.data;

  if (tour.loading && !t) {
    return <div className="content-card"><span className="bp-skeleton" style={{ width: "35%", marginBottom: 14 }} /><span className="bp-skeleton" style={{ width: "75%", marginBottom: 14 }} /><span className="bp-skeleton" style={{ width: "55%" }} /></div>;
  }
  if (tour.error || !t) {
    return (
      <div>
        <PageHeader eyebrow="TOURS" title="Tour Details" onBack={back} backLabel="Back to tours" />
        <div className="content-card"><Alert onRetry={tour.reload}>{tour.error || "Tour not found."}</Alert><EmptyState title="Tour not available" /></div>
      </div>
    );
  }

  const editable = !["completed", "cancelled"].includes(t.status);
  const action = pending ? ACTIONS[pending] : null;

  return (
    <div>
      <PageHeader
        eyebrow={t.tourCode}
        title={t.tourName}
        onBack={back}
        backLabel="Back to tours"
        actions={(
          <>
            <Button variant="outline" icon={Pencil} disabled={!editable} onClick={() => navigate(`/admin/tours/${t.id}/edit`)}>Edit</Button>
            <Button variant="danger" icon={Trash2} onClick={() => { setDialogError(""); setConfirmDeleteOpen(true); }}>Delete</Button>
          </>
        )}
      />

      <div className="dt-layout">
        <div className="dt-stack">
          <div className="content-card">
            <div className="dt-hero-badges" style={{ marginBottom: 18 }}>
              <TourStatusBadge status={t.displayStatus} />
              <TourTypeBadge type={t.tourType} />
            </div>
            <dl className="bp-kv">
              <div><dt>Starting location</dt><dd>{t.startLocation}</dd></div>
              <div><dt>Destination</dt><dd>{t.destination}</dd></div>
              <div><dt>Start</dt><dd>{formatDateTime(t.startAt)}</dd></div>
              <div><dt>End</dt><dd>{formatDateTime(t.endAt)}</dd></div>
              <div><dt>Pickup time</dt><dd>{t.pickupAt ? formatDateTime(t.pickupAt) : "—"}</dd></div>
              <div><dt>Return time</dt><dd>{t.returnAt ? formatDateTime(t.returnAt) : "—"}</dd></div>
              <div><dt>Passengers</dt><dd>{t.passengerCount}</dd></div>
              <div><dt>Created</dt><dd>{formatDate(t.createdAt)}{t.creator ? ` · ${fullName(t.creator)}` : ""}</dd></div>
              {t.description && <div className="full"><dt>Description</dt><dd>{t.description}</dd></div>}
              {t.specialNotes && <div className="full"><dt>Special notes</dt><dd><p className="dt-note">{t.specialNotes}</p></dd></div>}
            </dl>
          </div>

          <div className="content-card">
            <h6 className="dt-section-title">Route & stops</h6>
            <p className="dt-section-sub">{t.stops.length ? `${t.stops.length} location${t.stops.length === 1 ? "" : "s"} in visiting order.` : "No stops have been added to this tour."}</p>
            {t.stops.length === 0 ? (
              <EmptyState title="No stops yet" text="Edit the tour to add pickup, stop and drop-off locations." />
            ) : (
              <RouteTimeline stops={t.stops} />
            )}
          </div>
        </div>

        <div className="dt-stack">
          <div className="content-card">
            <h6 className="dt-section-title">Tour status</h6>
            <p className="dt-section-sub">
              {t.status === "planned"
                ? (t.hasConfirmedAssignment ? "A bus and driver are confirmed - the tour is scheduled." : "Waiting for a bus assignment to be confirmed.")
                : `This tour is ${t.status}.`}
            </p>
            {NEXT[t.status].length === 0 ? (
              <TourStatusBadge status={t.displayStatus} />
            ) : (
              <div className="dt-actions-row">
                {NEXT[t.status].map((status) => (
                  <Button key={status} variant={ACTIONS[status].variant === "danger" ? "outline" : "primary"} icon={ACTIONS[status].icon}
                    onClick={() => { setDialogError(""); setPending(status); }}>
                    {ACTIONS[status].label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="content-card">
            <h6 className="dt-section-title">Assignments</h6>
            <p className="dt-section-sub">Bus and driver pairs for this tour.</p>
            {t.assignments.length === 0 ? (
              <EmptyState title="Nobody assigned yet" text="Use the Assignments page to assign a bus and driver." action={<Link className="text-action" to="/admin/assignments">Go to assignments <ArrowRight size={13} /></Link>} />
            ) : (
              <ul className="dt-side-list">
                {t.assignments.map((a) => (
                  <li key={a.id}>
                    <div className="text-start"><strong>{driverName(a.driverId)}</strong><br /><span>Bus #{a.busId}</span></div>
                    <AssignmentBadge status={a.assignmentStatus} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={Boolean(action)} size="sm" title={action?.title || ""} onClose={working ? () => {} : () => setPending(null)}
        footer={(
          <>
            <Button variant="outline" onClick={() => setPending(null)} disabled={working}>Back</Button>
            <Button variant={action?.variant} loading={working} onClick={applyStatus}>{action?.label}</Button>
          </>
        )}
      >
        {dialogError && <Alert>{dialogError}</Alert>}
        <p>{action?.text}</p>
      </Modal>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete tour?"
        message={`“${t.tourName}” and its stops will be permanently removed. Tours with assignments cannot be deleted - cancel them instead.`}
        loading={working}
        error={dialogError}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
      {toastNode}
    </div>
  );
}
