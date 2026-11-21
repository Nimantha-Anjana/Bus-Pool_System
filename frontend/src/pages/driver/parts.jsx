import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bus, CalendarDays, Check, Users, X } from "lucide-react";
import { Alert, Button, FormField, Modal } from "../../components/admin-ui/ui";
import { AssignmentBadge, TourStatusBadge, TourTypeBadge } from "../../components/driver-tour/badges";
import { formatRange } from "../../components/driver-tour/utils";
import { respondToAssignment, classify } from "../../services/driver/portalService";
import { getErrorMessage } from "../../services/admin/http";
import "./driver-portal.css";

// Tells the layout (badge counts) that something changed
export const announceChange = () => window.dispatchEvent(new Event("driver:refresh"));

// What the driver sees for one assignment: label + colour of the main badge
export const stateBadge = (a) => {
  const kind = classify(a);
  if (kind === "request") return <span className="bp-badge orange">Needs your answer</span>;
  if (kind === "awaiting") return <span className="bp-badge blue">Waiting for bus owner</span>;
  if (kind === "current") return <span className="bp-badge purple">In progress</span>;
  if (kind === "upcoming") return <span className="bp-badge green">Confirmed</span>;
  return <AssignmentBadge status={a.assignmentStatus} />;
};

export function AssignmentCard({ a, to, children }) {
  const t = a.tour;
  const body = (
    <>
      <div className="dp-card-top">
        <div>
          <h6>{t.tourName}</h6>
          <small>{t.tourCode}</small>
        </div>
        {stateBadge(a)}
      </div>
      <div className="dp-card-route">{t.startLocation} <ArrowRight size={14} /> {t.destination}</div>
      <div className="dp-meta">
        <span><CalendarDays size={14} />{formatRange(a.assignedStartAt, a.assignedEndAt)}</span>
        <span><Users size={14} />{t.passengerCount} passengers</span>
        {a.bus && <span><Bus size={14} />{a.bus.registrationNumber}</span>}
        <TourTypeBadge type={t.tourType} />
      </div>
      {a.assignmentStatus === "rejected" && a.rejectionReason && <div className="dp-note">Your reason: {a.rejectionReason}</div>}
      {children}
    </>
  );
  return to ? <Link className="dp-card" to={to}>{body}</Link> : <div className="dp-card">{body}</div>;
}

// Accept / Reject buttons. Rejecting needs a reason (3-1000 characters), like the API.
export function RespondActions({ assignment, notify, onDone, block }) {
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const accept = async () => {
    setBusy("accepted");
    try {
      const r = await respondToAssignment(assignment.id, "accepted");
      notify(r.assignmentStatus === "confirmed" ? "Accepted - the tour is confirmed." : "Accepted - waiting for the bus owner.");
      announceChange(); onDone?.();
    } catch (e) { notify(getErrorMessage(e), "error"); }
    finally { setBusy(""); }
  };

  const reject = async () => {
    const text = reason.trim();
    if (text.length < 3 || text.length > 1000) { setError("Please give a reason (3-1000 characters)."); return; }
    setBusy("rejected"); setError("");
    try {
      await respondToAssignment(assignment.id, "rejected", text);
      setOpen(false); setReason("");
      notify("Assignment rejected.");
      announceChange(); onDone?.();
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setBusy(""); }
  };

  return (
    <>
      <div className={block ? "dp-card-actions" : "bp-page-actions"}>
        <Button icon={Check} loading={busy === "accepted"} disabled={Boolean(busy)} onClick={accept}>Accept</Button>
        <Button variant="outline" icon={X} disabled={Boolean(busy)} onClick={() => { setError(""); setOpen(true); }}>Reject</Button>
      </div>
      <Modal
        open={open} size="sm" title="Reject this tour?" onClose={busy ? () => {} : () => setOpen(false)}
        footer={(<><Button variant="outline" onClick={() => setOpen(false)} disabled={Boolean(busy)}>Back</Button>
          <Button variant="danger" loading={busy === "rejected"} onClick={reject}>Reject tour</Button></>)}
      >
        {error && <Alert>{error}</Alert>}
        <FormField as="textarea" label="Reason" required value={reason} maxLength={1000}
          onChange={(e) => { setReason(e.target.value); setError(""); }} hint="The administrator will see this reason." />
      </Modal>
    </>
  );
}

export { TourStatusBadge };
