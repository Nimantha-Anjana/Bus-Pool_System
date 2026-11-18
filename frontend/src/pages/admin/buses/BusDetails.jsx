import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Pencil, Snowflake, Trash2 } from "lucide-react";
import { Alert, Button, ConfirmDialog, EmptyState, FormField, PageHeader, StatusBadge, useToast } from "../../../components/admin-ui/ui";
import { useAsync } from "../../../components/admin-ui/hooks";
import { formatDate } from "../../../components/admin-ui/format";
import { deleteBus, getBus, setBusAvailability, updateBus } from "../../../services/admin/busesService";
import { listAllOwners } from "../../../services/admin/ownersService";
import { assetUrl, getErrorMessage } from "../../../services/admin/http";

const AVAILABILITY = [
  { value: "available", label: "Available" },
  { value: "maintenance", label: "Maintenance" },
  { value: "inactive", label: "Inactive" },
];

export default function BusDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [notify, toastNode] = useToast();

  const bus = useAsync(() => getBus(id), [id]);
  const owners = useAsync(listAllOwners, []);

  const [activeImage, setActiveImage] = useState(0);
  const [ownerId, setOwnerId] = useState("");
  const [savingOwner, setSavingOwner] = useState(false);
  const [savingStatus, setSavingStatus] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // message coming from the add / edit form
  useEffect(() => {
    if (location.state?.notice) {
      notify(location.state.notice, location.state.notice.includes("could not") ? "error" : "success");
      navigate(location.pathname, { replace: true, state: null }); // show the message only once
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (bus.data) setOwnerId(String(bus.data.ownerId)); }, [bus.data]);

  const back = () => navigate("/admin/buses");

  const changeAvailability = async (status) => {
    setSavingStatus(status);
    try {
      await setBusAvailability(id, status);
      notify("Availability updated.");
      bus.reload();
    } catch (e) {
      notify(getErrorMessage(e), "error");
    } finally {
      setSavingStatus("");
    }
  };

  const assignOwner = async () => {
    setSavingOwner(true);
    try {
      await updateBus(id, { ownerId: Number(ownerId) });
      notify("Bus owner changed.");
      bus.reload();
    } catch (e) {
      notify(getErrorMessage(e), "error");
    } finally {
      setSavingOwner(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteBus(id);
      navigate("/admin/buses", { replace: true });
    } catch (e) {
      setDeleteError(getErrorMessage(e));
      setDeleting(false);
    }
  };

  if (bus.error) return (<div><PageHeader title="Bus Details" onBack={back} backLabel="Back to buses" /><Alert onRetry={bus.reload}>{bus.error}</Alert></div>);
  if (!bus.data) return (<div><PageHeader title="Bus Details" onBack={back} backLabel="Back to buses" /><div className="content-card"><span className="bp-skeleton" style={{ width: "45%", marginBottom: 14 }} /><span className="bp-skeleton" style={{ width: "75%" }} /></div></div>);

  const b = bus.data;
  const images = b.images || [];
  const current = images[Math.min(activeImage, images.length - 1)];
  const isAssigned = b.status === "assigned";
  const activeOwners = (owners.data || []).filter((o) => o.status === "active" || o.id === b.ownerId);

  return (
    <div>
      <PageHeader
        eyebrow="BUS MANAGEMENT"
        title={b.busName || b.registrationNumber}
        subtitle={`${b.registrationNumber} · ${b.busType}`}
        onBack={back}
        backLabel="Back to buses"
        actions={(
          <>
            <Button variant="outline" icon={Pencil} onClick={() => navigate(`/admin/buses/${id}/edit`)}>Edit</Button>
            <Button variant="danger" icon={Trash2} onClick={() => { setDeleteError(""); setConfirmOpen(true); }}>Delete</Button>
          </>
        )}
      />

      <div className="row g-4">
        <div className="col-12 col-xl-7">
          <div className="content-card mb-4">
            <div className="card-heading"><div><h5>Photos</h5><p>{images.length ? `${images.length} image${images.length > 1 ? "s" : ""}` : "No images uploaded"}</p></div></div>
            {current ? (
              <>
                <img className="bp-gallery-main" src={assetUrl(current.imageUrl)} alt={b.busName || b.registrationNumber} />
                {images.length > 1 && (
                  <div className="bp-gallery-thumbs">
                    {images.map((img, i) => (
                      <button type="button" key={img.id} className={i === activeImage ? "active" : ""} onClick={() => setActiveImage(i)} aria-label={`Show image ${i + 1}`}>
                        <img src={assetUrl(img.imageUrl)} alt="" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <EmptyState title="No images yet" text="Upload photos from the edit page." action={<Button size="sm" variant="outline" icon={Pencil} onClick={() => navigate(`/admin/buses/${id}/edit`)}>Upload images</Button>} />
            )}
          </div>

          <div className="content-card">
            <div className="card-heading"><div><h5>Bus information</h5><p>Registered on {formatDate(b.createdAt)}</p></div><StatusBadge status={b.status} /></div>
            <dl className="bp-kv">
              <div><dt>Registration no.</dt><dd>{b.registrationNumber}</dd></div>
              <div><dt>Bus name</dt><dd>{b.busName || "—"}</dd></div>
              <div><dt>Type</dt><dd>{b.busType}</dd></div>
              <div><dt>Seating capacity</dt><dd>{b.seatingCapacity} seats</dd></div>
              <div><dt>Air conditioning</dt><dd>{b.airConditioned ? <span className="bp-ac"><Snowflake size={14} /> Air conditioned</span> : "Non-AC"}</dd></div>
              <div className="full"><dt>Description</dt><dd>{b.description || "—"}</dd></div>
              <div className="full">
                <dt>Facilities</dt>
                <dd>
                  {b.facilities?.length
                    ? <div className="bp-chips">{b.facilities.map((f) => <span className="bp-chip" key={f}>{f}</span>)}</div>
                    : "No facilities listed"}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="col-12 col-xl-5">
          <div className="content-card mb-4">
            <div className="card-heading"><div><h5>Availability</h5><p>Controls whether the bus can be assigned</p></div></div>
            {isAssigned ? (
              <Alert type="info">This bus has an active tour assignment. Its availability is managed automatically until the assignment ends.</Alert>
            ) : (
              <div className="bp-segmented" role="group" aria-label="Bus availability">
                {AVAILABILITY.map((o) => (
                  <button
                    type="button" key={o.value} disabled={Boolean(savingStatus)}
                    className={b.status === o.value ? "active" : ""}
                    onClick={() => b.status !== o.value && changeAvailability(o.value)}
                  >
                    {savingStatus === o.value ? "Saving..." : o.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="content-card">
            <div className="card-heading"><div><h5>Bus owner</h5><p>Assign this bus to a different owner</p></div></div>
            {b.owner && (
              <div className="bp-owner-box">
                <strong><Link to={`/admin/owners/${b.owner.id}`} className="text-decoration-none">{b.owner.ownerName}</Link></strong>
                <small>{b.owner.phone} · {b.owner.email}</small>
              </div>
            )}
            <FormField label="Change owner" as="select" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} disabled={isAssigned || owners.loading}
              hint={isAssigned ? "The owner cannot be changed while the bus has an active assignment." : undefined}>
              {activeOwners.map((o) => <option key={o.id} value={o.id}>{o.ownerName}</option>)}
            </FormField>
            <Button loading={savingOwner} disabled={isAssigned || String(b.ownerId) === ownerId} onClick={assignOwner}>Assign Owner</Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete bus?"
        message={`Bus ${b.registrationNumber} and its images will be permanently removed. Buses with active assignments cannot be deleted.`}
        loading={deleting}
        error={deleteError}
        onConfirm={remove}
        onCancel={() => setConfirmOpen(false)}
      />
      {toastNode}
    </div>
  );
}
