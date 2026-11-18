import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  Alert, Button, ConfirmDialog, DataTable, EmptyState, PageHeader, StatusBadge, useToast,
} from "../../../components/admin-ui/ui";
import { useAsync } from "../../../components/admin-ui/hooks";
import { formatDate, initials } from "../../../components/admin-ui/format";
import { deleteOwner, getOwner } from "../../../services/admin/ownersService";
import { listBusesByOwner } from "../../../services/admin/busesService";
import { getErrorMessage } from "../../../services/admin/http";
import OwnerFormModal from "./OwnerFormModal";

export default function OwnerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [notify, toastNode] = useToast();
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const owner = useAsync(() => getOwner(id), [id]);
  const buses = useAsync(() => listBusesByOwner(id), [id]);

  const remove = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteOwner(id);
      navigate("/admin/owners", { replace: true });
    } catch (e) {
      setDeleteError(getErrorMessage(e));
      setDeleting(false);
    }
  };

  const back = () => navigate("/admin/owners");

  if (owner.error) {
    return (
      <div>
        <PageHeader title="Owner Details" onBack={back} backLabel="Back to owners" />
        <Alert onRetry={owner.reload}>{owner.error}</Alert>
      </div>
    );
  }
  if (!owner.data) {
    return (
      <div>
        <PageHeader title="Owner Details" onBack={back} backLabel="Back to owners" />
        <div className="content-card"><span className="bp-skeleton" style={{ width: "40%", marginBottom: 14 }} /><span className="bp-skeleton" style={{ width: "70%" }} /></div>
      </div>
    );
  }

  const o = owner.data;
  const busColumns = [
    {
      key: "registrationNumber", header: "Bus",
      render: (b) => (
        <Link to={`/admin/buses/${b.id}`} className="text-decoration-none">
          <strong>{b.busName || b.registrationNumber}</strong>
          <small className="table-subtitle">{b.registrationNumber}</small>
        </Link>
      ),
    },
    { key: "busType", header: "Type" },
    { key: "seatingCapacity", header: "Seats" },
    { key: "status", header: "Status", render: (b) => <StatusBadge status={b.status} /> },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="BUS OWNERS"
        title={o.ownerName}
        subtitle="Owner details and registered buses"
        onBack={back}
        backLabel="Back to owners"
        actions={(
          <>
            <Button variant="outline" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>
            <Button variant="danger" icon={Trash2} onClick={() => { setDeleteError(""); setConfirmOpen(true); }}>Delete</Button>
          </>
        )}
      />

      <div className="row g-4">
        <div className="col-12 col-xl-5">
          <div className="content-card">
            <div className="d-flex align-items-center gap-3 mb-4">
              <div className="bp-avatar-lg">{initials(o.ownerName)}</div>
              <div>
                <h5 className="mb-2">{o.ownerName}</h5>
                <StatusBadge status={o.status} />
              </div>
            </div>
            <dl className="bp-kv">
              <div><dt>Phone</dt><dd>{o.phone}</dd></div>
              <div><dt>Email</dt><dd>{o.email}</dd></div>
              <div><dt>NIC</dt><dd>{o.nic || "—"}</dd></div>
              <div><dt>Business reg. no.</dt><dd>{o.businessRegistrationNo || "—"}</dd></div>
              <div className="full"><dt>Address</dt><dd>{o.address || "—"}</dd></div>
              <div className="full"><dt>Notes</dt><dd>{o.notes || "—"}</dd></div>
              <div><dt>Added on</dt><dd>{formatDate(o.createdAt)}</dd></div>
            </dl>
          </div>
        </div>

        <div className="col-12 col-xl-7">
          <div className="content-card">
            <div className="card-heading">
              <div>
                <h5>Buses</h5>
                <p>{buses.data ? `${buses.data.length} registered` : "Loading..."}</p>
              </div>
              <Button size="sm" icon={Plus} disabled={o.status !== "active"} onClick={() => navigate(`/admin/buses/new?ownerId=${o.id}`)}>Add Bus</Button>
            </div>
            {buses.error && <Alert onRetry={buses.reload}>{buses.error}</Alert>}
            <DataTable
              columns={busColumns}
              rows={buses.data || []}
              loading={buses.loading && !buses.data}
              skeletonRows={3}
              empty={!buses.error && <EmptyState title="No buses yet" text="This owner has no buses registered." />}
            />
          </div>
        </div>
      </div>

      <OwnerFormModal
        open={editing}
        owner={o}
        onClose={() => setEditing(false)}
        onSaved={() => { setEditing(false); notify("Owner updated."); owner.reload(); }}
      />
      <ConfirmDialog
        open={confirmOpen}
        title="Delete bus owner?"
        message={`“${o.ownerName}” will be permanently removed. Owners that still have buses cannot be deleted.`}
        loading={deleting}
        error={deleteError}
        onConfirm={remove}
        onCancel={() => setConfirmOpen(false)}
      />
      {toastNode}
    </div>
  );
}
